const mongoose = require('mongoose');
const SystemConfig = require('../Models/SystemConfig');
const Order = require('../Models/Order');
const User = require('../Models/User');
const WalletTransaction = require('../Models/WalletTransaction');
const { isTransientTransactionError, sleep } = require('./transactionRetry');

const MAX_TRANSIENT_RETRIES = 3;

/**
  * Credit Order Reward Coins when order status becomes 'Delivered'
  *
  * Correctness note: the "claim" (Order.rewardCredited = true) and the financial writes
  * (wallet balance increment + WalletTransaction ledger record) must succeed or fail
  * TOGETHER. If the claim were persisted first and a later write then failed, the order
  * would be permanently stuck "credited" with no coins actually given, and the atomic
  * claim filter used to prevent double-crediting would then block every future retry.
  *
  * We use a MongoDB transaction (same start/commit/abort pattern as Backend/Controllers/
  * orderController.js's createOrder) so that on deployments that support it, the claim and
  * both writes are truly all-or-nothing. On deployments without transaction support
  * (standalone mongod), we fall back to manual compensation: if a write fails after the
  * claim succeeded, we reverse whatever already happened and release the claim so a retry
  * is safe. As a second line of defense in either case, the existence of the
  * WalletTransaction ledger record (not just the boolean flag) is treated as the source of
  * truth for "was this actually credited" on the next call.
  *
  * Two genuinely simultaneous callers can hit a real MongoDB write conflict on the shared
  * claim ('TransientTransactionError') — this is MongoDB's own signal to simply retry the
  * transaction attempt, not a correctness problem, so we retry a few times before giving up.
  */
exports.creditOrderReward = async (orderId) => {
  let config;
  try {
    config = await SystemConfig.findOne();
    if (!config) return { success: false, reason: 'Config missing' };

    if (config.walletEnabled === false || config.rewardCoinsEnabled === false) {
      return { success: false, reason: 'Reward coins feature disabled in admin settings' };
    }
  } catch (error) {
    console.error('Error crediting order reward coins (config lookup):', error);
    return { success: false, error: error.message };
  }

  const rewardAmount = (config.rewardCoinsPerDeliveredOrder !== undefined && config.rewardCoinsPerDeliveredOrder !== null)
    ? config.rewardCoinsPerDeliveredOrder
    : 100;

  if (rewardAmount <= 0) return { success: false, reason: 'Reward amount is 0' };

  try {
    // Ledger-existence safety net: if a WalletTransaction record for this reward already
    // exists, the coins were already credited even if the Order flag was somehow left
    // unset by a previous failed attempt (only possible without transaction support).
    // Trust the ledger over the flag, and self-heal the flag to match reality.
    const existingTxn = await WalletTransaction.findOne({ orderId, type: 'ORDER_REWARD' });
    if (existingTxn) {
      await Order.updateOne(
        { _id: orderId, rewardCredited: { $ne: true } },
        { $set: { rewardCredited: true, rewardCreditedAt: existingTxn.createdAt, rewardCoinsAmount: existingTxn.amount } }
      );
      return { success: false, reason: 'Reward already credited for this order' };
    }
  } catch (error) {
    console.error('Error crediting order reward coins (ledger check):', error);
    return { success: false, error: error.message };
  }

  for (let attempt = 1; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    let transactionActive = false;
    let claimedOrderId = null;
    let claimedUserId = null;
    let walletIncremented = false;

    try {
      try {
        session.startTransaction();
        transactionActive = true;
      } catch (txErr) {
        console.warn('MongoDB transactions not supported by deployment. Crediting order reward non-transactionally (with manual compensation on failure).');
      }
      const sessionOpt = transactionActive ? { session } : {};

      // Atomically claim the reward for this order, inside the same transaction as the
      // financial writes below (when supported). Concurrent/duplicate triggers (Shiprocket
      // resending the same Delivered webhook, the webhook and a manual sync racing each
      // other, etc.) can never both win this claim — only one call gets back a non-null
      // `order`, all others get null and no-op.
      const order = await Order.findOneAndUpdate(
        { _id: orderId, status: 'Delivered', rewardCredited: { $ne: true } },
        { $set: { rewardCredited: true, rewardCreditedAt: new Date(), rewardCoinsAmount: rewardAmount } },
        sessionOpt
      );

      if (!order) {
        if (transactionActive) { await session.abortTransaction(); transactionActive = false; }
        session.endSession();
        const existing = await Order.findById(orderId);
        if (!existing) return { success: false, reason: 'Order not found' };
        if (existing.status !== 'Delivered') return { success: false, reason: 'Order is not Delivered' };
        return { success: false, reason: 'Reward already credited for this order' };
      }
      claimedOrderId = order._id;
      claimedUserId = order.userId;

      const orderNum = order._id.toString().substring(order._id.toString().length - 6).toUpperCase();
      const returnWindowDays = (config.returnWindowDays !== undefined && config.returnWindowDays !== null) ? config.returnWindowDays : 2;
      const unlocksAt = new Date(Date.now() + returnWindowDays * 24 * 60 * 60 * 1000);

      await User.findByIdAndUpdate(order.userId, { $inc: { walletBalance: rewardAmount } }, sessionOpt);
      walletIncremented = true;

      await WalletTransaction.create([{
        userId: order.userId,
        orderId: order._id,
        unlocksAt,
        type: 'ORDER_REWARD',
        amount: rewardAmount,
        description: `${rewardAmount} reward coins for successful Order #${orderNum}`
      }], sessionOpt);

      if (transactionActive) {
        await session.commitTransaction();
        transactionActive = false;
      }
      session.endSession();

      console.log(`🎉 Credited ${rewardAmount} Order Reward Coins to User ${order.userId} for Order #${orderNum}`);
      return { success: true, rewardAmount };
    } catch (error) {
      if (transactionActive) {
        // Transaction rolls back everything atomically — claim, wallet increment, and
        // ledger write are all undone together. Nothing to compensate manually.
        try { await session.abortTransaction(); } catch (_) { /* ignore */ }
        session.endSession();

        if (isTransientTransactionError(error) && attempt < MAX_TRANSIENT_RETRIES) {
          console.warn(`Transient transaction conflict crediting reward for order ${orderId} (attempt ${attempt}/${MAX_TRANSIENT_RETRIES}), retrying...`);
          await sleep(20 * attempt);
          continue;
        }
      } else {
        session.endSession();
        // No transaction support: manually undo whatever already succeeded so the order is
        // never left claimed without the coins actually having been credited, and so a
        // retry can run cleanly.
        if (walletIncremented && claimedUserId) {
          try {
            await User.findByIdAndUpdate(claimedUserId, { $inc: { walletBalance: -rewardAmount } });
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate wallet balance after partial reward-credit failure for order ${claimedOrderId}. Manual reconciliation required.`, compErr);
          }
        }
        if (claimedOrderId) {
          try {
            await Order.updateOne({ _id: claimedOrderId }, { $set: { rewardCredited: false, rewardCreditedAt: null, rewardCoinsAmount: 0 } });
          } catch (revertErr) {
            console.error(`CRITICAL: failed to revert rewardCredited claim after failure for order ${claimedOrderId}. Manual reconciliation required.`, revertErr);
          }
        }
      }
      console.error('Error crediting order reward coins:', error);
      return { success: false, error: error.message };
    }
  }
};

/**
  * Deduct Order Reward Coins when order is returned / refunded
  * Same claim+writes-must-succeed-together reasoning as creditOrderReward above.
  */
exports.deductOrderReward = async (orderId) => {
  try {
    // Ledger-existence safety net, mirroring creditOrderReward.
    const existingTxn = await WalletTransaction.findOne({ orderId, type: 'ORDER_REWARD_REDUCE' });
    if (existingTxn) {
      await Order.updateOne(
        { _id: orderId, rewardCredited: true, rewardDeducted: { $ne: true } },
        { $set: { rewardDeducted: true, rewardDeductedAt: existingTxn.createdAt } }
      );
      return { success: false, reason: 'Reward already deducted for this order' };
    }
  } catch (error) {
    console.error('Error deducting order reward coins (ledger check):', error);
    return { success: false, error: error.message };
  }

  for (let attempt = 1; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    let transactionActive = false;
    let claimedOrderId = null;
    let claimedUserId = null;
    let walletDecremented = false;
    let rewardAmount = 0;

    try {
      try {
        session.startTransaction();
        transactionActive = true;
      } catch (txErr) {
        console.warn('MongoDB transactions not supported by deployment. Deducting order reward non-transactionally (with manual compensation on failure).');
      }
      const sessionOpt = transactionActive ? { session } : {};

      // Atomically claim the deduction so concurrent/duplicate triggers (e.g. a webhook RTO
      // event and a manual admin refund racing each other) can never deduct the same
      // order's reward twice.
      const order = await Order.findOneAndUpdate(
        { _id: orderId, rewardCredited: true, rewardDeducted: { $ne: true } },
        { $set: { rewardDeducted: true, rewardDeductedAt: new Date() } },
        sessionOpt
      );

      if (!order) {
        if (transactionActive) { await session.abortTransaction(); transactionActive = false; }
        session.endSession();
        const existing = await Order.findById(orderId);
        if (!existing) return { success: false, reason: 'Order not found' };
        return { success: false, reason: 'No active reward to deduct' };
      }
      claimedOrderId = order._id;
      claimedUserId = order.userId;
      rewardAmount = order.rewardCoinsAmount || 100;

      const orderNum = order._id.toString().substring(order._id.toString().length - 6).toUpperCase();

      await User.findByIdAndUpdate(order.userId, { $inc: { walletBalance: -rewardAmount } }, sessionOpt);
      walletDecremented = true;

      await WalletTransaction.create([{
        userId: order.userId,
        orderId: order._id,
        type: 'ORDER_REWARD_REDUCE',
        amount: -rewardAmount,
        description: `Deducted ${rewardAmount} reward coins for returned Order #${orderNum}`
      }], sessionOpt);

      if (transactionActive) {
        await session.commitTransaction();
        transactionActive = false;
      }
      session.endSession();

      console.log(`⚠️ Deducted ${rewardAmount} Order Reward Coins from User ${order.userId} for Returned Order #${orderNum}`);
      return { success: true, rewardAmount };
    } catch (error) {
      if (transactionActive) {
        try { await session.abortTransaction(); } catch (_) { /* ignore */ }
        session.endSession();

        if (isTransientTransactionError(error) && attempt < MAX_TRANSIENT_RETRIES) {
          console.warn(`Transient transaction conflict deducting reward for order ${orderId} (attempt ${attempt}/${MAX_TRANSIENT_RETRIES}), retrying...`);
          await sleep(20 * attempt);
          continue;
        }
      } else {
        session.endSession();
        if (walletDecremented && claimedUserId) {
          try {
            await User.findByIdAndUpdate(claimedUserId, { $inc: { walletBalance: rewardAmount } });
          } catch (compErr) {
            console.error(`CRITICAL: failed to compensate wallet balance after partial reward-deduction failure for order ${claimedOrderId}. Manual reconciliation required.`, compErr);
          }
        }
        if (claimedOrderId) {
          try {
            await Order.updateOne({ _id: claimedOrderId }, { $set: { rewardDeducted: false, rewardDeductedAt: null } });
          } catch (revertErr) {
            console.error(`CRITICAL: failed to revert rewardDeducted claim after failure for order ${claimedOrderId}. Manual reconciliation required.`, revertErr);
          }
        }
      }
      console.error('Error deducting order reward coins:', error);
      return { success: false, error: error.message };
    }
  }
};

/**
  * Calculate locked reward balance for a user (orders delivered within returnWindowDays)
  */
exports.getUserLockedRewardCoins = async (userId) => {
  try {
    const config = await SystemConfig.findOne();
    const returnWindowDays = (config && config.returnWindowDays !== undefined) ? config.returnWindowDays : 2;
    const defaultReward = (config && config.rewardCoinsPerDeliveredOrder !== undefined) ? config.rewardCoinsPerDeliveredOrder : 100;

    // Find all delivered orders for user where reward was not deducted
    const activeRewardOrders = await Order.find({
      userId,
      status: 'Delivered',
      rewardCredited: true,
      rewardDeducted: { $ne: true }
    });

    const now = new Date();
    const lockedAmount = activeRewardOrders.reduce((sum, o) => {
      const deliveredDate = o.rewardCreditedAt || o.updatedAt || o.createdAt;
      const expiryDate = new Date(new Date(deliveredDate).getTime() + returnWindowDays * 24 * 60 * 60 * 1000);
      if (now < expiryDate) {
        return sum + (o.rewardCoinsAmount || defaultReward);
      }
      return sum;
    }, 0);

    return lockedAmount;
  } catch (error) {
    console.error('Error calculating locked reward coins:', error);
    return 0;
  }
};
