const SystemConfig = require('../Models/SystemConfig');
const Order = require('../Models/Order');
const User = require('../Models/User');
const WalletTransaction = require('../Models/WalletTransaction');

/**
  * Credit Order Reward Coins when order status becomes 'Delivered'
  */
exports.creditOrderReward = async (orderId) => {
  try {
    const config = await SystemConfig.findOne();
    if (!config) return { success: false, reason: 'Config missing' };
    
    // Check if wallet and reward features are enabled
    if (config.walletEnabled === false || config.rewardCoinsEnabled === false) {
      return { success: false, reason: 'Reward coins feature disabled in admin settings' };
    }

    const order = await Order.findById(orderId);
    if (!order) return { success: false, reason: 'Order not found' };

    if (order.status !== 'Delivered') {
      return { success: false, reason: 'Order is not Delivered' };
    }

    // Atomic idempotency check: prevent duplicate reward credit
    if (order.rewardCredited) {
      return { success: false, reason: 'Reward already credited for this order' };
    }

    const rewardAmount = (config.rewardCoinsPerDeliveredOrder !== undefined && config.rewardCoinsPerDeliveredOrder !== null) 
      ? config.rewardCoinsPerDeliveredOrder 
      : 100;

    if (rewardAmount <= 0) return { success: false, reason: 'Reward amount is 0' };

    const orderNum = order._id.toString().substring(order._id.toString().length - 6).toUpperCase();
    const returnWindowDays = (config.returnWindowDays !== undefined && config.returnWindowDays !== null) ? config.returnWindowDays : 2;
    const unlocksAt = new Date(Date.now() + returnWindowDays * 24 * 60 * 60 * 1000);

    // Perform atomic transaction: update user balance, create transaction record, mark order rewardCredited
    await User.findByIdAndUpdate(order.userId, {
      $inc: { walletBalance: rewardAmount }
    });

    await WalletTransaction.create({
      userId: order.userId,
      orderId: order._id,
      unlocksAt: unlocksAt,
      type: 'ORDER_REWARD',
      amount: rewardAmount,
      description: `${rewardAmount} reward coins for successful Order #${orderNum}`
    });

    order.rewardCredited = true;
    order.rewardCreditedAt = new Date();
    order.rewardCoinsAmount = rewardAmount;
    await order.save();

    console.log(`🎉 Credited ${rewardAmount} Order Reward Coins to User ${order.userId} for Order #${orderNum}`);
    return { success: true, rewardAmount };
  } catch (error) {
    console.error('Error crediting order reward coins:', error);
    return { success: false, error: error.message };
  }
};

/**
  * Deduct Order Reward Coins when order is returned / refunded
  */
exports.deductOrderReward = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) return { success: false, reason: 'Order not found' };

    // Only deduct if reward was credited and not yet deducted
    if (!order.rewardCredited || order.rewardDeducted) {
      return { success: false, reason: 'No active reward to deduct' };
    }

    const rewardAmount = order.rewardCoinsAmount || 100;
    const orderNum = order._id.toString().substring(order._id.toString().length - 6).toUpperCase();

    await User.findByIdAndUpdate(order.userId, {
      $inc: { walletBalance: -rewardAmount }
    });

    await WalletTransaction.create({
      userId: order.userId,
      orderId: order._id,
      type: 'ORDER_REWARD_REDUCE',
      amount: -rewardAmount,
      description: `Deducted ${rewardAmount} reward coins for returned Order #${orderNum}`
    });

    order.rewardDeducted = true;
    order.rewardDeductedAt = new Date();
    await order.save();

    console.log(`⚠️ Deducted ${rewardAmount} Order Reward Coins from User ${order.userId} for Returned Order #${orderNum}`);
    return { success: true, rewardAmount };
  } catch (error) {
    console.error('Error deducting order reward coins:', error);
    return { success: false, error: error.message };
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
