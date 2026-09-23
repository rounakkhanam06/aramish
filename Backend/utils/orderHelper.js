const mongoose = require('mongoose');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const CouponUsage = require('../Models/CouponUsage');

/**
 * Narrow, non-transactional stock/coupon restore used ONLY by the admin hard-delete path
 * (Backend/Controllers/orderController.js exports.deleteOrder), which removes the Order
 * document entirely right after calling this. Because the order is about to be deleted,
 * there is no "retry later" concept for it to be atomic against, and it does not touch
 * wallet/referral/reward balances (deleteOrder never has). Every other cancellation/refund
 * path should use handleOrderCancellationRefunds below instead, which folds this same
 * restoration into one atomic transaction alongside the financial refund.
 *
 * @param {Object} order - The Order Mongoose document
 */
const handleOrderCancellationStockAndCoupon = async (order) => {
  if (order.status === 'Cancelled') {
    return;
  }

  for (const item of order.items) {
    if (item.productId) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: {
          stock: item.quantity || 1,
          sales: -(item.quantity || 1)
        }
      });
    }
  }

  if (order.couponCode) {
    const couponCodeClean = order.couponCode.toUpperCase().trim();
    const coupon = await Coupon.findOneAndUpdate(
      { code: couponCodeClean },
      { $inc: { usage: -1 } },
      { new: true }
    );
    if (coupon) {
      await CouponUsage.findOneAndDelete({
        couponId: coupon._id,
        userId: order.userId
      });
    }
  }
};

/**
 * Checks if the order is Delivered and Paid, and awards referral coins
 * if this is the customer's first successfully completed order.
 *
 * @param {Object} order - The Order Mongoose document
 */
const checkAndTriggerReferral = async (order) => {
  if (order.status === 'Delivered' && order.paymentStatus === 'Paid') {
    const Order = require('../Models/Order');

    // Count how many orders have been successfully completed (Delivered + Paid) by this user
    const completedCount = await Order.countDocuments({
      userId: order.userId,
      status: 'Delivered',
      paymentStatus: 'Paid'
    });

    // If this is the first successfully completed order, trigger the referral
    if (completedCount === 1) {
      try {
        const { completeReferral } = require('../Controllers/referralController');
        const SystemConfig = require('../Models/SystemConfig');
        const config = await SystemConfig.findOne({});
        const referralCoins = config ? config.referralCoinsPerReferral : 100;

        console.log(`🎁 First order successfully completed for user ${order.userId}. Crediting referral coins.`);
        await completeReferral(order.userId, referralCoins);
      } catch (err) {
        console.error('❌ Error processing referral completion reward:', err.message);
      }
    }
  }
};

/**
 * Atomically processes a full order cancellation/refund. Runs in two phases:
 *
 * Phase 1 (DB-only, ONE MongoDB transaction): restores item stock, restores coupon usage,
 * refunds wallet balance + welcome-bonus coins, restores referral coins, and claws back any
 * order reward coins already credited — all as a single atomic unit, guarded by ONE claim
 * (Order.refundProcessed). Every step here either all commits together or all rolls back
 * together (including the claim itself), so a mid-flight failure can never leave stock/
 * coupons restored without a successful refund, or vice versa, and a retry after a failure
 * always sees refundProcessed:false and can safely reprocess the whole bundle exactly once.
 * On deployments without transaction support, we fall back to manual compensation (undoing
 * whatever already succeeded, in reverse order) so a retry is still safe.
 *
 * Phase 2 (external, best-effort, separate from the transaction above): the online payment
 * refund (Razorpay, or a store-credit fallback). This cannot be part of the Mongo
 * transaction because it's an external HTTP call — no database transaction can make "call
 * Razorpay" and "write to MongoDB" one atomic operation. It has its own idempotency claim
 * (Order.onlinePaymentRefundProcessed) and defensively checks for an existing refund on the
 * payment before creating a new one.
 *
 * @param {Object} order - The Order Mongoose document
 * @param {Object} [options]
 * @param {boolean} [options.restoreStock=true] - Restore item stock/sales and coupon usage.
 *   Pass false when the caller doesn't have full-order return-item granularity (e.g. a
 *   generic 'Refunded' status transition through the admin endpoint, which has no tracked
 *   partial-return quantities) — applying full-order stock restoration there would be wrong.
 */
const handleOrderCancellationRefunds = async (order, options = {}) => {
  const restoreStock = options.restoreStock !== false;
  const Order = require('../Models/Order');
  const User = require('../Models/User');
  const WalletTransaction = require('../Models/WalletTransaction');
  const CoinTransaction = require('../Models/CoinTransaction');
  const axios = require('axios');
  const { isTransientTransactionError, sleep } = require('./transactionRetry');

  const walletAmount = order.walletUsed || 0;
  const referralAmount = order.referralCoinsUsed || 0;

  // ---- Phase 1: stock + coupon + wallet + welcome-bonus + referral coins + reward clawback ----
  // Two genuinely simultaneous callers each running their own transaction can hit a real
  // MongoDB write conflict on the shared claim document — MongoDB aborts the losing
  // transaction automatically and tags the error 'TransientTransactionError', which is its
  // own documented signal that the whole transaction attempt should simply be retried (not
  // a correctness problem: nothing partial survives either way). We retry a few times so the
  // "losing" caller ends up cleanly seeing refundProcessed already true and no-ops, instead
  // of surfacing a transient conflict as a hard failure to its caller.
  const MAX_TRANSIENT_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    let transactionActive = false;
    let claimed = false;

    // Track what actually happened, for manual compensation on the non-transactional
    // fallback path (and to keep the compensation precise rather than guessing).
    const restoredStockItems = []; // { productId, variationSku, quantity }
    let couponRestored = null;     // { couponId, userId, usageCount } snapshot, if restored
    let walletCredited = false;
    let referralCredited = false;
    let rewardClawedBack = false;
    let rewardAmountForCompensation = 0;

    try {
      try {
        session.startTransaction();
        transactionActive = true;
      } catch (txErr) {
        console.warn('MongoDB transactions not supported by deployment. Processing order cancellation non-transactionally (with manual compensation on failure).');
      }
      const sessionOpt = transactionActive ? { session } : {};

      // Single atomic claim guards the ENTIRE bundle below. Concurrent/duplicate triggers
      // (a webhook and a manual admin action racing each other, a webhook retried by
      // Shiprocket, etc.) can never both win this claim — only one call proceeds past this
      // point, all others get null and return immediately, with zero side effects.
      const claimResult = await Order.findOneAndUpdate(
        { _id: order._id, refundProcessed: { $ne: true } },
        { $set: { refundProcessed: true } },
        sessionOpt
      );

      if (!claimResult) {
        // Phase 1 was already processed by a previous/concurrent call — skip straight to
        // Phase 2 below rather than returning outright. This matters when Phase 1 succeeded
        // on an earlier call but Phase 2 (the online payment refund) failed and needs to be
        // retried: Phase 2 has its own independent claim, so a retry of this whole function
        // must still be able to reach it even though Phase 1 has nothing left to do.
        if (transactionActive) { await session.abortTransaction(); transactionActive = false; }
        session.endSession();
        break;
      }
      claimed = true;

      // 1. Restore stock for each item
      if (restoreStock) {
        for (const item of order.items) {
          if (item.productId) {
            const qty = item.quantity || 1;
            if (item.variationSku) {
              await Product.findOneAndUpdate(
                { _id: item.productId, 'variations.sku': item.variationSku },
                { $inc: { 'variations.$.stock': qty, sales: -qty } },
                sessionOpt
              );
            } else {
              await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: qty, sales: -qty }
              }, sessionOpt);
            }
            restoredStockItems.push({ productId: item.productId, variationSku: item.variationSku || null, quantity: qty });
          }
        }

        // 2. Restore coupon usage if order has a coupon code
        if (order.couponCode) {
          const couponCodeClean = order.couponCode.toUpperCase().trim();
          const coupon = await Coupon.findOneAndUpdate(
            { code: couponCodeClean },
            { $inc: { usage: -1 } },
            { ...sessionOpt, new: true }
          );
          if (coupon) {
            const existingUsage = await CouponUsage.findOne({ couponId: coupon._id, userId: order.userId }, null, sessionOpt);
            if (existingUsage) {
              couponRestored = { couponId: coupon._id, userId: order.userId, usageCount: existingUsage.usageCount };
              await CouponUsage.findOneAndDelete({ couponId: coupon._id, userId: order.userId }, sessionOpt);
            }
          }
        }
      }

      // 3. Refund wallet balance (+ welcome-bonus split) if wallet was used
      if (walletAmount > 0) {
        const SystemConfig = require('../Models/SystemConfig');
        const systemConfig = await SystemConfig.findOne({}, null, sessionOpt);
        const welcomeBonusCoins = systemConfig && systemConfig.welcomeBonusCoins !== undefined ? systemConfig.welcomeBonusCoins : 1000;

        const currentUser = await User.findById(order.userId, null, sessionOpt);
        const coinsToRestore = order.welcomeCoinsUsed !== undefined && order.welcomeCoinsUsed !== null ? order.welcomeCoinsUsed : walletAmount;
        const restoredWelcomeRemaining = Math.min(welcomeBonusCoins, (currentUser?.welcomeBonusRemaining || 0) + coinsToRestore);

        await User.findByIdAndUpdate(order.userId, {
          $inc: { walletBalance: walletAmount },
          $set: { welcomeBonusRemaining: restoredWelcomeRemaining }
        }, sessionOpt);
        walletCredited = true;

        await WalletTransaction.create([{
          userId: order.userId,
          type: 'REFUND',
          amount: walletAmount,
          description: `Restored ${walletAmount} Wallet Coins for Cancelled Order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()}`
        }], sessionOpt);
      }

      // 4. Restore referral coins if any were used on this order
      if (referralAmount > 0) {
        await User.findByIdAndUpdate(order.userId, {
          $inc: { referralCoins: referralAmount }
        }, sessionOpt);
        referralCredited = true;

        await CoinTransaction.create([{
          userId: order.userId,
          type: 'earned',
          title: `Restored Referral Coins for Cancelled Order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()}`,
          amount: referralAmount
        }], sessionOpt);
      }

      // 5. Claw back order reward coins, if any were credited for this order and not yet deducted
      const freshOrder = await Order.findById(order._id, null, sessionOpt);
      if (freshOrder && freshOrder.rewardCredited && !freshOrder.rewardDeducted) {
        rewardAmountForCompensation = freshOrder.rewardCoinsAmount || 100;
        const orderNum = order._id.toString().substring(order._id.toString().length - 6).toUpperCase();

        await Order.updateOne({ _id: order._id }, { $set: { rewardDeducted: true, rewardDeductedAt: new Date() } }, sessionOpt);
        await User.findByIdAndUpdate(order.userId, { $inc: { walletBalance: -rewardAmountForCompensation } }, sessionOpt);
        await WalletTransaction.create([{
          userId: order.userId,
          orderId: order._id,
          type: 'ORDER_REWARD_REDUCE',
          amount: -rewardAmountForCompensation,
          description: `Deducted ${rewardAmountForCompensation} reward coins for returned Order #${orderNum}`
        }], sessionOpt);
        rewardClawedBack = true;
      }

      if (transactionActive) {
        await session.commitTransaction();
        transactionActive = false;
      }
      session.endSession();
      break; // success — exit the retry loop and proceed to Phase 2
    } catch (error) {
      if (transactionActive) {
        // Transaction rolls back everything atomically — claim, stock, coupon, wallet,
        // referral coins, and reward clawback are all undone together. Nothing to
        // compensate manually.
        try { await session.abortTransaction(); } catch (_) { /* ignore */ }
        session.endSession();

        if (isTransientTransactionError(error) && attempt < MAX_TRANSIENT_RETRIES) {
          console.warn(`Transient transaction conflict processing cancellation for order ${order._id} (attempt ${attempt}/${MAX_TRANSIENT_RETRIES}), retrying...`);
          await sleep(20 * attempt);
          continue; // retry the whole Phase 1 attempt with a fresh session
        }
      } else {
        session.endSession();
        // No transaction support: manually undo whatever already succeeded, in reverse
        // order, so the order is never left "refund processed" with only some of the
        // bundle actually applied, and so a retry can run cleanly.
        if (rewardClawedBack) {
          try {
            await User.findByIdAndUpdate(order.userId, { $inc: { walletBalance: rewardAmountForCompensation } });
            await Order.updateOne({ _id: order._id }, { $set: { rewardDeducted: false, rewardDeductedAt: null } });
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate reward clawback after partial cancellation failure for order ${order._id}. Manual reconciliation required.`, compErr);
          }
        }
        if (referralCredited) {
          try {
            await User.findByIdAndUpdate(order.userId, { $inc: { referralCoins: -referralAmount } });
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate referral coins after partial cancellation failure for order ${order._id}. Manual reconciliation required.`, compErr);
          }
        }
        if (walletCredited) {
          try {
            await User.findByIdAndUpdate(order.userId, { $inc: { walletBalance: -walletAmount } });
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate wallet balance after partial cancellation failure for order ${order._id}. Manual reconciliation required.`, compErr);
          }
        }
        if (couponRestored) {
          try {
            await Coupon.findByIdAndUpdate(couponRestored.couponId, { $inc: { usage: 1 } });
            await CouponUsage.create({ couponId: couponRestored.couponId, userId: couponRestored.userId, usageCount: couponRestored.usageCount });
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate coupon usage after partial cancellation failure for order ${order._id}. Manual reconciliation required.`, compErr);
          }
        }
        if (restoredStockItems.length > 0) {
          try {
            for (const item of restoredStockItems) {
              if (item.variationSku) {
                await Product.findOneAndUpdate(
                  { _id: item.productId, 'variations.sku': item.variationSku },
                  { $inc: { 'variations.$.stock': -item.quantity, sales: item.quantity } }
                );
              } else {
                await Product.findByIdAndUpdate(item.productId, {
                  $inc: { stock: -item.quantity, sales: item.quantity }
                });
              }
            }
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate stock restoration after partial cancellation failure for order ${order._id}. Manual reconciliation required.`, compErr);
          }
        }
        if (claimed) {
          try {
            await Order.updateOne({ _id: order._id }, { $set: { refundProcessed: false } });
          } catch (revertErr) {
            console.error(`CRITICAL: failed to revert refundProcessed claim after failure for order ${order._id}. Manual reconciliation required.`, revertErr);
          }
        }
      }
      console.error('Error processing order cancellation:', error);
      // Surface the failure to the caller instead of silently continuing to Phase 2 as if
      // the cancellation bundle succeeded.
      throw error;
    }
  }

  // ---- Phase 2: online payment refund (Razorpay, or store-credit fallback) ----
  if (order.paymentMethod === 'Online' && order.paymentStatus === 'Paid' && order.total > 0) {
    const onlineClaim = await Order.findOneAndUpdate(
      { _id: order._id, onlinePaymentRefundProcessed: { $ne: true } },
      { $set: { onlinePaymentRefundProcessed: true } }
    );

    if (onlineClaim) {
      let refundProcessedOnline = false;
      const rzpKeyId = process.env.RAZORPAY_KEY_ID;
      const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

      if (rzpKeyId && rzpKeySecret && order.paymentId) {
        try {
          const rzpAuth = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');

          // Idempotency guard: if a refund already exists for this payment (e.g. a previous
          // attempt reached Razorpay successfully but crashed before we recorded it), don't
          // issue a second one.
          const existingRefunds = await axios.get(`https://api.razorpay.com/v1/payments/${order.paymentId}/refunds`, {
            headers: { 'Authorization': `Basic ${rzpAuth}` }
          });
          const alreadyRefunded = existingRefunds.data && Array.isArray(existingRefunds.data.items) && existingRefunds.data.items.length > 0;

          if (alreadyRefunded) {
            refundProcessedOnline = true;
            console.log(`Razorpay refund already exists for payment ${order.paymentId}, skipping duplicate refund call.`);
          } else {
            await axios.post(`https://api.razorpay.com/v1/payments/${order.paymentId}/refund`, {
              amount: order.total * 100 // Razorpay amount in paise
            }, {
              headers: {
                'Authorization': `Basic ${rzpAuth}`,
                'Content-Type': 'application/json'
              }
            });
            refundProcessedOnline = true;
            console.log(`Razorpay refund processed successfully for payment: ${order.paymentId}`);
          }
        } catch (refundErr) {
          console.error('Razorpay refund API call failed during order cancellation, falling back to coins store credit:', refundErr.response?.data || refundErr.message);
        }
      }

      if (!refundProcessedOnline) {
        try {
          await User.findByIdAndUpdate(order.userId, {
            $inc: { walletBalance: order.total }
          });
          await WalletTransaction.create({
            userId: order.userId,
            type: 'Refund',
            amount: order.total,
            description: `Refund for Cancelled Order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()}`
          });
        } catch (fallbackErr) {
          // Neither Razorpay nor the store-credit fallback succeeded. Release the claim so
          // a retry can attempt this phase again — Phase 1 above already committed
          // successfully and is unaffected either way.
          try {
            await Order.updateOne({ _id: order._id }, { $set: { onlinePaymentRefundProcessed: false } });
          } catch (revertErr) {
            console.error(`CRITICAL: failed to revert onlinePaymentRefundProcessed claim after failure for order ${order._id}. Manual reconciliation required.`, revertErr);
          }
          console.error('Store-credit fallback refund failed after Razorpay refund also failed:', fallbackErr.message);
        }
      }
    }
  }

  // Set the payment status to Refunded
  order.paymentStatus = 'Refunded';
};

/**
 * Atomically processes a return request's refund (the returnController.updateReturnStatus
 * 'Refunded' branch). Mirrors handleOrderCancellationRefunds's two-phase design but is scoped
 * to the specific items/amount on the ReturnRequest rather than the whole order:
 *
 * Phase 1 (DB-only, ONE MongoDB transaction, guarded by ReturnRequest.stockRefundClaimed):
 * restores stock for the returned items, and refunds wallet balance + welcome-bonus coins +
 * referral coins that were used on the order (folded into the SAME claim/transaction so a
 * retry after a mid-flight failure can never double-restore stock or double-credit wallet
 * coins). Falls back to manual compensation when transactions aren't supported.
 *
 * Phase 2 (external, best-effort, separate claim: ReturnRequest.cashRefundProcessed): the
 * cash refund for the returned items — Razorpay refund for online payments, or a wallet
 * store-credit fallback when the customer chose 'Wallet' as their refund destination. Checks
 * for an existing Razorpay refund before issuing a new one, same as the order-cancellation path.
 *
 * @param {Object} returnRequest - The ReturnRequest Mongoose document
 * @param {Object} order - The associated Order Mongoose document
 */
const handleReturnRefund = async (returnRequest, order) => {
  const Order = require('../Models/Order');
  const User = require('../Models/User');
  const WalletTransaction = require('../Models/WalletTransaction');
  const CoinTransaction = require('../Models/CoinTransaction');
  const ReturnRequest = require('../Models/ReturnRequest');
  const axios = require('axios');
  const { isTransientTransactionError, sleep } = require('./transactionRetry');

  const walletAmount = order.walletUsed || 0;
  const referralAmount = order.referralCoinsUsed || 0;

  // ---- Phase 1: stock restoration + wallet/welcome-bonus + referral coin restore ----
  const MAX_TRANSIENT_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    let transactionActive = false;
    let claimed = false;

    const restoredStockItems = []; // { productId, quantity }
    let walletCredited = false;
    let referralCredited = false;

    try {
      try {
        session.startTransaction();
        transactionActive = true;
      } catch (txErr) {
        console.warn('MongoDB transactions not supported by deployment. Processing return refund non-transactionally (with manual compensation on failure).');
      }
      const sessionOpt = transactionActive ? { session } : {};

      // Single atomic claim guards stock restoration + wallet/referral restore together.
      // A retried 'Refunded' call (after a prior partial failure, or a duplicate admin
      // request) can never re-run this bundle once it has been claimed.
      const claimResult = await ReturnRequest.findOneAndUpdate(
        { _id: returnRequest._id, stockRefundClaimed: { $ne: true } },
        { $set: { stockRefundClaimed: true } },
        sessionOpt
      );

      if (!claimResult) {
        if (transactionActive) { await session.abortTransaction(); transactionActive = false; }
        session.endSession();
        break;
      }
      claimed = true;

      // 1. Restore stock for the returned items only
      for (const item of returnRequest.items) {
        if (item.productId) {
          const qty = item.quantity || 1;
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: qty, sales: -qty }
          }, sessionOpt);
          restoredStockItems.push({ productId: item.productId, quantity: qty });
        }
      }

      // 2. Restore redeemed wallet coins (+ welcome-bonus split) if wallet was used on the order
      if (walletAmount > 0) {
        const SystemConfig = require('../Models/SystemConfig');
        const systemConfig = await SystemConfig.findOne({}, null, sessionOpt);
        const welcomeBonusCoins = systemConfig && systemConfig.welcomeBonusCoins !== undefined ? systemConfig.welcomeBonusCoins : 1000;

        const currentUser = await User.findById(returnRequest.userId, null, sessionOpt);
        const coinsToRestore = order.welcomeCoinsUsed !== undefined && order.welcomeCoinsUsed !== null ? order.welcomeCoinsUsed : walletAmount;
        const restoredWelcomeRemaining = Math.min(welcomeBonusCoins, (currentUser?.welcomeBonusRemaining || 0) + coinsToRestore);

        await User.findByIdAndUpdate(returnRequest.userId, {
          $inc: { walletBalance: walletAmount },
          $set: { welcomeBonusRemaining: restoredWelcomeRemaining }
        }, sessionOpt);
        walletCredited = true;

        await WalletTransaction.create([{
          userId: returnRequest.userId,
          type: 'REFUND',
          amount: walletAmount,
          description: `Restored ${walletAmount} Wallet Coins for Returned Order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()}`
        }], sessionOpt);
      }

      // 3. Restore referral coins used on the order
      if (referralAmount > 0) {
        await User.findByIdAndUpdate(returnRequest.userId, {
          $inc: { referralCoins: referralAmount }
        }, sessionOpt);
        referralCredited = true;

        await CoinTransaction.create([{
          userId: returnRequest.userId,
          type: 'earned',
          title: `Restored Referral Coins for Returned Order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()}`,
          amount: referralAmount
        }], sessionOpt);
      }

      returnRequest.walletRefundProcessed = true;

      if (transactionActive) {
        await session.commitTransaction();
        transactionActive = false;
      }
      session.endSession();
      break;
    } catch (error) {
      if (transactionActive) {
        try { await session.abortTransaction(); } catch (_) { /* ignore */ }
        session.endSession();

        if (isTransientTransactionError(error) && attempt < MAX_TRANSIENT_RETRIES) {
          console.warn(`Transient transaction conflict processing return refund for return ${returnRequest._id} (attempt ${attempt}/${MAX_TRANSIENT_RETRIES}), retrying...`);
          await sleep(20 * attempt);
          continue;
        }
      } else {
        session.endSession();
        // No transaction support: manually undo whatever already succeeded, in reverse order.
        if (referralCredited) {
          try {
            await User.findByIdAndUpdate(returnRequest.userId, { $inc: { referralCoins: -referralAmount } });
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate referral coins after partial return-refund failure for return ${returnRequest._id}. Manual reconciliation required.`, compErr);
          }
        }
        if (walletCredited) {
          try {
            await User.findByIdAndUpdate(returnRequest.userId, { $inc: { walletBalance: -walletAmount } });
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate wallet balance after partial return-refund failure for return ${returnRequest._id}. Manual reconciliation required.`, compErr);
          }
        }
        if (restoredStockItems.length > 0) {
          try {
            for (const item of restoredStockItems) {
              await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity, sales: item.quantity }
              });
            }
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate stock restoration after partial return-refund failure for return ${returnRequest._id}. Manual reconciliation required.`, compErr);
          }
        }
        if (claimed) {
          try {
            await ReturnRequest.updateOne({ _id: returnRequest._id }, { $set: { stockRefundClaimed: false } });
          } catch (revertErr) {
            console.error(`CRITICAL: failed to revert stockRefundClaimed claim after failure for return ${returnRequest._id}. Manual reconciliation required.`, revertErr);
          }
        }
      }
      console.error('Error processing return refund:', error);
      throw error;
    }
  }

  // ---- Phase 2: cash refund for the returned items (Razorpay, or wallet store-credit fallback) ----
  const cashRefundAmount = Number(returnRequest.refundAmount) || 0;

  if (cashRefundAmount > 0) {
    const cashClaim = await ReturnRequest.findOneAndUpdate(
      { _id: returnRequest._id, cashRefundProcessed: { $ne: true } },
      { $set: { cashRefundProcessed: true } }
    );

    if (cashClaim) {
      let refundProcessedOnline = false;

      if (order.paymentMethod === 'Online' && order.paymentId) {
        const rzpKeyId = process.env.RAZORPAY_KEY_ID;
        const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

        if (rzpKeyId && rzpKeySecret) {
          try {
            const rzpAuth = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');

            // Idempotency guard: don't issue a second Razorpay refund for this payment if one
            // was already created by a previous attempt that crashed before we recorded it.
            const existingRefunds = await axios.get(`https://api.razorpay.com/v1/payments/${order.paymentId}/refunds`, {
              headers: { 'Authorization': `Basic ${rzpAuth}` }
            });
            const alreadyRefunded = existingRefunds.data && Array.isArray(existingRefunds.data.items) && existingRefunds.data.items.length > 0;

            if (alreadyRefunded) {
              refundProcessedOnline = true;
              console.log(`Razorpay refund already exists for payment ${order.paymentId}, skipping duplicate return refund call.`);
            } else {
              await axios.post(`https://api.razorpay.com/v1/payments/${order.paymentId}/refund`, {
                amount: Math.round(cashRefundAmount * 100)
              }, {
                headers: {
                  'Authorization': `Basic ${rzpAuth}`,
                  'Content-Type': 'application/json'
                }
              });
              refundProcessedOnline = true;
              console.log(`Razorpay refund processed successfully for payment: ${order.paymentId}`);
            }
          } catch (refundErr) {
            console.error('Razorpay refund API call failed, falling back to coins store credit:', refundErr.response?.data || refundErr.message);
          }
        }
      }

      const isWalletSelected = returnRequest.refundMethod === 'Wallet';

      if (!refundProcessedOnline && isWalletSelected) {
        try {
          await WalletTransaction.create({
            userId: returnRequest.userId,
            type: 'Refund',
            amount: cashRefundAmount,
            description: `Cash Refund for Return #${returnRequest._id.toString().substring(returnRequest._id.toString().length - 6).toUpperCase()}`
          });

          await User.findByIdAndUpdate(returnRequest.userId, {
            $inc: { walletBalance: cashRefundAmount }
          });
          console.log(`✅ Credited cash refund of ₹${cashRefundAmount} to wallet balance (Refund method: Wallet)`);
        } catch (fallbackErr) {
          try {
            await ReturnRequest.updateOne({ _id: returnRequest._id }, { $set: { cashRefundProcessed: false } });
          } catch (revertErr) {
            console.error(`CRITICAL: failed to revert cashRefundProcessed claim after failure for return ${returnRequest._id}. Manual reconciliation required.`, revertErr);
          }
          console.error('Wallet store-credit fallback refund failed for return:', fallbackErr.message);
        }
      } else {
        // Not processed online and the customer didn't choose Wallet as the refund
        // destination — this is an intentional manual (Bank/UPI) refund, not a failure, so
        // the claim stands: an admin handles it offline and there's nothing to retry.
        console.log(`ℹ️ Cash refund of ₹${cashRefundAmount} for return ${returnRequest._id} processed manually via ${returnRequest.refundMethod || 'Bank/UPI'} - skipped wallet credit.`);
      }
    }
  }
};

module.exports = {
  handleOrderCancellationStockAndCoupon,
  handleOrderCancellationRefunds,
  handleReturnRefund,
  checkAndTriggerReferral
};
