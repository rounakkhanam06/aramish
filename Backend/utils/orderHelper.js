const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const CouponUsage = require('../Models/CouponUsage');
const { runWalletTransaction, reverseOrderRewards, creditRefundWallet, restoreRefundWalletForOrder, roundMoney } = require('./walletService');

const orderLabel = (id) => id.toString().substring(id.toString().length - 6).toUpperCase();

/**
 * Narrow, non-transactional stock/coupon restore used ONLY by the admin hard-delete path
 * (Backend/Controllers/orderController.js exports.deleteOrder), which removes the Order
 * document entirely right after calling this. Because the order is about to be deleted,
 * there is no "retry later" concept for it to be atomic against, and it does not touch
 * wallet balances (deleteOrder never has). Every other cancellation/refund path should use
 * handleOrderCancellationRefunds below instead.
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
 * Refunds an online payment through Razorpay, falling back to the customer's REFUND WALLET
 * (actual money — never the coins wallet) when the Razorpay call is impossible/fails and
 * `allowStoreCredit` is true. Idempotent via the caller's claim plus a check for an existing
 * Razorpay refund on the payment. Returns 'ONLINE' or 'REFUND_WALLET' (where the money
 * went), or false when nothing was refunded here (manual Bank/UPI refund).
 */
const refundOnlinePayment = async ({ order, amountRupees, allowStoreCredit, preferWallet = false, storeCredit }) => {
  const axios = require('axios');
  const rzpKeyId = process.env.RAZORPAY_KEY_ID;
  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

  // preferWallet: the customer chose Wallet as the refund destination — credit the Refund
  // Wallet directly instead of refunding to the original payment method.
  if (!preferWallet && order.paymentMethod === 'Online' && rzpKeyId && rzpKeySecret && order.paymentId) {
    try {
      const rzpAuth = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');
      const existingRefunds = await axios.get(`https://api.razorpay.com/v1/payments/${order.paymentId}/refunds`, {
        headers: { 'Authorization': `Basic ${rzpAuth}` }
      });
      const alreadyRefunded = existingRefunds.data && Array.isArray(existingRefunds.data.items) && existingRefunds.data.items.length > 0;

      if (alreadyRefunded) {
        console.log(`Razorpay refund already exists for payment ${order.paymentId}, skipping duplicate refund call.`);
      } else {
        await axios.post(`https://api.razorpay.com/v1/payments/${order.paymentId}/refund`, {
          amount: Math.round(amountRupees * 100) // paise
        }, {
          headers: { 'Authorization': `Basic ${rzpAuth}`, 'Content-Type': 'application/json' }
        });
        console.log(`Razorpay refund processed successfully for payment: ${order.paymentId}`);
      }
      return 'ONLINE';
    } catch (refundErr) {
      console.error('Razorpay refund API call failed:', refundErr.response?.data || refundErr.message);
    }
  }

  if (!allowStoreCredit) return false;
  // Refunded money goes to the separate Refund Wallet (no 25% limit), not the coins wallet.
  await creditRefundWallet({ userId: order.userId, amount: amountRupees, ...storeCredit });
  return 'REFUND_WALLET';
};

/**
 * Processes a full order cancellation/refund in two phases.
 *
 * Phase 1 (DB-only, ONE atomic unit guarded by the Order.refundProcessed claim): restores
 * item stock and coupon usage, and claws back any order/referral reward coins credited for
 * this order. Coins the customer REDEEMED on the order are deliberately NOT restored — all
 * coins are non-returnable. Everything either commits together or rolls back together
 * (manual compensation on deployments without transactions), so a retry is always safe.
 *
 * Phase 2 (external, best-effort, own claim Order.onlinePaymentRefundProcessed): the online
 * payment refund (Razorpay, or a wallet store-credit fallback).
 *
 * @param {Object} order - The Order Mongoose document
 * @param {Object} [options]
 * @param {boolean} [options.restoreStock=true] - Restore item stock/sales and coupon usage.
 *   Pass false when the caller doesn't have full-order return-item granularity (e.g. a
 *   generic 'Refunded' status transition through the admin endpoint).
 */
const handleOrderCancellationRefunds = async (order, options = {}) => {
  const restoreStock = options.restoreStock !== false;
  const Order = require('../Models/Order');

  // ---- Phase 1: stock + coupon + reward clawback ----
  await runWalletTransaction(async (ctx) => {
    const { sessionOpt, undo } = ctx;

    // Single atomic claim guards the whole bundle: duplicate/concurrent triggers (webhook
    // retries, webhook racing an admin action) can't both get past this point.
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, refundProcessed: { $ne: true } },
      { $set: { refundProcessed: true } },
      sessionOpt
    );
    // Already processed — fall through to Phase 2, which may still need a retry.
    if (!claimed) return;
    undo.push(() => Order.updateOne({ _id: order._id }, { $set: { refundProcessed: false } }));

    if (restoreStock) {
      for (const item of order.items) {
        if (!item.productId) continue;
        const qty = item.quantity || 1;
        if (item.variationSku) {
          await Product.findOneAndUpdate(
            { _id: item.productId, 'variations.sku': item.variationSku },
            { $inc: { 'variations.$.stock': qty, sales: -qty } },
            sessionOpt
          );
          undo.push(() => Product.findOneAndUpdate(
            { _id: item.productId, 'variations.sku': item.variationSku },
            { $inc: { 'variations.$.stock': -qty, sales: qty } }
          ));
        } else {
          await Product.findByIdAndUpdate(item.productId, { $inc: { stock: qty, sales: -qty } }, sessionOpt);
          undo.push(() => Product.findByIdAndUpdate(item.productId, { $inc: { stock: -qty, sales: qty } }));
        }
      }

      if (order.couponCode) {
        const couponCodeClean = order.couponCode.toUpperCase().trim();
        const coupon = await Coupon.findOneAndUpdate(
          { code: couponCodeClean },
          { $inc: { usage: -1 } },
          { ...sessionOpt, returnDocument: 'after' }
        );
        if (coupon) {
          undo.push(() => Coupon.findByIdAndUpdate(coupon._id, { $inc: { usage: 1 } }));
          const existingUsage = await CouponUsage.findOneAndDelete({ couponId: coupon._id, userId: order.userId }, sessionOpt);
          if (existingUsage) {
            undo.push(() => CouponUsage.create({ couponId: coupon._id, userId: order.userId, usageCount: existingUsage.usageCount }));
          }
        }
      }
    }

    // Locked reward coins for this order are never released once it's cancelled/refunded.
    await reverseOrderRewards(order._id, { ctx });

    // Refund Wallet money used on this order is real money: credit back whatever hasn't
    // already been returned by an earlier partial return.
    await restoreRefundWalletForOrder(order._id, { ctx, idempotencyKey: `REFUND_WALLET_RESTORE:${order._id}` });
  }, `order cancellation ${order._id}`);

  // ---- Phase 2: online payment refund (Razorpay, or store-credit fallback) ----
  if (order.paymentMethod === 'Online' && order.paymentStatus === 'Paid' && order.total > 0) {
    const onlineClaim = await Order.findOneAndUpdate(
      { _id: order._id, onlinePaymentRefundProcessed: { $ne: true } },
      { $set: { onlinePaymentRefundProcessed: true } }
    );

    if (onlineClaim) {
      try {
        await refundOnlinePayment({
          order,
          amountRupees: order.total,
          allowStoreCredit: true,
          storeCredit: {
            orderId: order._id,
            description: `Refund for Cancelled Order #${orderLabel(order._id)} (online refund failed, credited to Refund Wallet)`,
            idempotencyKey: `CANCEL_REFUND:${order._id}`
          }
        });
      } catch (fallbackErr) {
        // Neither Razorpay nor store credit succeeded — release the claim so a retry can
        // attempt this phase again. Phase 1 already committed and is unaffected.
        try {
          await Order.updateOne({ _id: order._id }, { $set: { onlinePaymentRefundProcessed: false } });
        } catch (revertErr) {
          console.error(`CRITICAL: failed to revert onlinePaymentRefundProcessed claim for order ${order._id}. Manual reconciliation required.`, revertErr);
        }
        console.error('Store-credit fallback refund failed after Razorpay refund also failed:', fallbackErr.message);
      }
    }
  }

  // Set the payment status to Refunded
  order.paymentStatus = 'Refunded';
};

/**
 * Processes a return request's refund (returnController.updateReturnStatus 'Refunded').
 *
 * Phase 1 (atomic, guarded by ReturnRequest.stockRefundClaimed): restores stock for the
 * returned items and claws back the order/referral reward coins for the order (they were
 * still locked while the return was open). Redeemed coins are NOT restored — coins are
 * non-returnable.
 *
 * Phase 2 (own claim ReturnRequest.cashRefundProcessed): the cash refund for the returned
 * items — Razorpay for online payments, or wallet store credit when the customer chose
 * 'Wallet' as the refund destination.
 *
 * @param {Object} returnRequest - The ReturnRequest Mongoose document
 * @param {Object} order - The associated Order Mongoose document
 */
const handleReturnRefund = async (returnRequest, order) => {
  const ReturnRequest = require('../Models/ReturnRequest');

  // ---- Phase 1: stock restoration + reward clawback ----
  await runWalletTransaction(async (ctx) => {
    const { sessionOpt, undo } = ctx;

    const claimed = await ReturnRequest.findOneAndUpdate(
      { _id: returnRequest._id, stockRefundClaimed: { $ne: true } },
      { $set: { stockRefundClaimed: true } },
      sessionOpt
    );
    if (!claimed) return;
    undo.push(() => ReturnRequest.updateOne({ _id: returnRequest._id }, { $set: { stockRefundClaimed: false } }));

    for (const item of returnRequest.items) {
      if (!item.productId) continue;
      const qty = item.quantity || 1;
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: qty, sales: -qty } }, sessionOpt);
      undo.push(() => Product.findByIdAndUpdate(item.productId, { $inc: { stock: -qty, sales: qty } }));
    }

    await reverseOrderRewards(order._id, { ctx });
    returnRequest.walletRefundProcessed = true;
  }, `return refund ${returnRequest._id}`);

  // ---- Phase 2: cash refund for the returned items ----
  const cashRefundAmount = Number(returnRequest.refundAmount) || 0;
  if (cashRefundAmount <= 0) return;

  const cashClaim = await ReturnRequest.findOneAndUpdate(
    { _id: returnRequest._id, cashRefundProcessed: { $ne: true } },
    { $set: { cashRefundProcessed: true } }
  );
  if (!cashClaim) return;

  const isWalletSelected = returnRequest.refundMethod === 'Wallet';
  const returnedQty = returnRequest.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const orderQty = order.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const isPartial = returnedQty < orderQty;
  try {
    // 1. Money the customer paid from the Refund Wallet goes back to the Refund Wallet first
    //    (only up to the eligible refund, and never more than was used on the order).
    const restored = await restoreRefundWalletForOrder(order._id, {
      maxAmount: cashRefundAmount,
      partial: isPartial,
      idempotencyKey: `RETURN_REFUND_WALLET_RESTORE:${returnRequest._id}`
    });

    // 2. The rest was paid by the customer (online/COD) — refund it the usual way; a wallet
    //    refund (Wallet method, or Razorpay failure) goes to the Refund Wallet.
    const remainder = roundMoney(cashRefundAmount - restored);
    let creditedToRefundWallet = 0;
    if (remainder > 0) {
      const refundedTo = await refundOnlinePayment({
        order,
        amountRupees: remainder,
        // Wallet chosen -> Refund Wallet directly. Refund to the original online payment ->
        // Refund Wallet only if Razorpay fails. Bank/UPI -> manual payout by an admin.
        allowStoreCredit: isWalletSelected || (order.paymentMethod === 'Online' && (returnRequest.refundMethod || 'Original') === 'Original'),
        preferWallet: isWalletSelected,
        storeCredit: {
          orderId: order._id,
          type: isPartial ? 'REFUND_WALLET_PARTIAL_REFUND' : 'REFUND_WALLET_CREDIT',
          description: `${isPartial ? 'Partial refund' : 'Refund'} for Return #${orderLabel(returnRequest._id)}`,
          idempotencyKey: `RETURN_REFUND:${returnRequest._id}`
        }
      });
      if (!refundedTo) {
        // Not online and the customer didn't pick Wallet — an intentional manual (Bank/UPI)
        // refund handled offline by an admin, so the claim stands.
        console.log(`ℹ️ Cash refund of ₹${remainder} for return ${returnRequest._id} processed manually via ${returnRequest.refundMethod || 'Bank/UPI'} - skipped wallet credit.`);
      } else if (refundedTo === 'REFUND_WALLET') {
        creditedToRefundWallet = remainder;
      }
    }

    await ReturnRequest.updateOne(
      { _id: returnRequest._id },
      { $set: { refundWalletRestoredAmount: restored, refundWalletCreditedAmount: creditedToRefundWallet } }
    );
    returnRequest.refundWalletRestoredAmount = restored;
    returnRequest.refundWalletCreditedAmount = creditedToRefundWallet;
  } catch (fallbackErr) {
    try {
      await ReturnRequest.updateOne({ _id: returnRequest._id }, { $set: { cashRefundProcessed: false } });
    } catch (revertErr) {
      console.error(`CRITICAL: failed to revert cashRefundProcessed claim for return ${returnRequest._id}. Manual reconciliation required.`, revertErr);
    }
    console.error('Wallet store-credit fallback refund failed for return:', fallbackErr.message);
  }
};

module.exports = {
  handleOrderCancellationStockAndCoupon,
  handleOrderCancellationRefunds,
  handleReturnRefund
};
