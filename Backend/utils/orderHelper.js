const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const CouponUsage = require('../Models/CouponUsage');

/**
 * Shared utility to handle order cancellation inventory restoration and coupon refund.
 * Prevents double-increment or race conditions by checking current status.
 * 
 * @param {Object} order - The Order Mongoose document
 */
const handleOrderCancellationStockAndCoupon = async (order) => {
  // Prevent double restoration if already cancelled
  if (order.status === 'Cancelled') {
    return;
  }

  // 1. Restore stock for each item
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

  // 2. Restore coupon usage if order has a coupon code
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
 * Handles refunds of wallet used, coins redeemed, and online payments
 * when an order is cancelled (either by user, admin, or Shiprocket).
 * 
 * @param {Object} order - The Order Mongoose document
 */
const handleOrderCancellationRefunds = async (order) => {
  // Prevent double refund processing
  if (order.paymentStatus === 'Refunded') {
    return;
  }

  const User = require('../Models/User');
  const WalletTransaction = require('../Models/WalletTransaction');
  const CoinTransaction = require('../Models/CoinTransaction');
  const axios = require('axios');

  // 1. Refund wallet balance if wallet was used
  if (order.walletUsed && order.walletUsed > 0) {
    await User.findByIdAndUpdate(order.userId, {
      $inc: { walletBalance: order.walletUsed }
    });
    await WalletTransaction.create({
      userId: order.userId,
      type: 'Order Cancellation',
      amount: order.walletUsed,
      description: `Refund for Cancelled Order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()}`
    });
  }

  // 2. Refund referral coins if coins were redeemed
  if (order.coinsRedeemed && order.coinsRedeemed > 0) {
    await User.findByIdAndUpdate(order.userId, {
      $inc: { referralCoins: order.coinsRedeemed }
    });
    await CoinTransaction.create({
      userId: order.userId,
      type: 'earned',
      title: 'Refund: Cancelled Order',
      amount: order.coinsRedeemed
    });
  }

  // 3. Refund online payment if paymentMethod is Online and was Paid
  if (order.paymentMethod === 'Online' && order.paymentStatus === 'Paid' && order.total > 0) {
    let refundProcessedOnline = false;
    const rzpKeyId = process.env.RAZORPAY_KEY_ID;
    const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (rzpKeyId && rzpKeySecret && order.paymentId) {
      try {
        const rzpAuth = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');
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
      } catch (refundErr) {
        console.error('Razorpay refund API call failed during order cancellation, falling back to coins store credit:', refundErr.response?.data || refundErr.message);
      }
    }

    if (!refundProcessedOnline) {
      // Fallback: Credit to wallet as store credit
      await User.findByIdAndUpdate(order.userId, {
        $inc: { walletBalance: order.total }
      });
      await WalletTransaction.create({
        userId: order.userId,
        type: 'Refund',
        amount: order.total,
        description: `Refund for Cancelled Order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()}`
      });
    }
  }

  // Set the payment status to Refunded
  order.paymentStatus = 'Refunded';
};

module.exports = {
  handleOrderCancellationStockAndCoupon,
  handleOrderCancellationRefunds,
  checkAndTriggerReferral
};
