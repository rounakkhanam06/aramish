const Order = require('../Models/Order');
const Cart = require('../Models/Cart');
const Coupon = require('../Models/Coupon');
const Product = require('../Models/Product');
const User = require('../Models/User');
const shiprocketService = require('../Router/shiprocketService');
const axios = require('axios');
const mongoose = require('mongoose');
const CouponUsage = require('../Models/CouponUsage');
const { handleOrderCancellationStockAndCoupon, handleOrderCancellationRefunds, checkAndTriggerReferral } = require('../utils/orderHelper');
// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  let decrementedProducts = [];
  let couponUsageIncremented = false;
  let couponCodeClean = null;
  
  const session = await mongoose.startSession();
  let transactionActive = false;
  let coinsDeducted = false;
  let coinsRedeemedAmount = 0;
  let walletDeducted = false;
  let walletUsedAmount = 0;

  try {
    const { items, total, deliveryAddress, paymentMethod, paymentStatus, paymentId, couponCode, deliveryCharge, etd, redeemCoins, redeemWallet } = req.body;

    if (!items || items.length === 0 || !total || !deliveryAddress || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Try starting transaction (if replica set supports it)
    try {
      session.startTransaction();
      transactionActive = true;
    } catch (txErr) {
      console.warn('MongoDB transactions not supported by deployment. Falling back to non-transactional execution.');
    }

    const sessionOpt = transactionActive ? { session } : {};

    // 1. Fetch line items from database to verify and retrieve actual prices
    const productIds = items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }, null, sessionOpt);
    const productMap = {};
    products.forEach(p => {
      productMap[p._id.toString()] = p;
    });

    let calculatedSubtotal = 0;
    let totalOrderWeight = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = productMap[item.productId];
      if (!product) {
        throw new Error(`Product "${item.name}" not found.`);
      }
      const qty = item.quantity || 1;

      let itemPrice = product.sellingPrice;
      let availableStock = product.stock;

      if (item.variationSku) {
        const variant = (product.variations || []).find(v => v.sku === item.variationSku);
        if (!variant) {
          throw new Error(`Variation "${item.variationSku}" of "${product.name}" not found.`);
        }
        itemPrice = (!variant.useDefaultPricing && variant.sellingPrice !== undefined) ? variant.sellingPrice : product.sellingPrice;
        availableStock = variant.stock;
      }

      calculatedSubtotal += itemPrice * qty;
      const productWeight = (product.shippingSpecs && product.shippingSpecs.weight) ? product.shippingSpecs.weight : 0.5;
      totalOrderWeight += (productWeight * qty);

      validatedItems.push({
        productId: item.productId,
        name: product.name,
        price: itemPrice,
        quantity: qty,
        image: item.image || (product.images && product.images[0]) || '',
        variationSku: item.variationSku || null,
        article: product.article || null,
        attributes: item.attributes || {}
      });
    }

    // 2. Verify and decrement stock atomically
    for (const item of validatedItems) {
      let result;
      if (item.variationSku) {
        result = await Product.findOneAndUpdate(
          { 
            _id: item.productId, 
            'variations.sku': item.variationSku,
            'variations.stock': { $gte: item.quantity } 
          },
          { 
            $inc: { 
              'variations.$.stock': -item.quantity, 
              sales: item.quantity 
            } 
          },
          { new: true, ...sessionOpt }
        );
      } else {
        result = await Product.findOneAndUpdate(
          { 
            _id: item.productId, 
            stock: { $gte: item.quantity } 
          },
          { 
            $inc: { 
              stock: -item.quantity, 
              sales: item.quantity 
            } 
          },
          { new: true, ...sessionOpt }
        );
      }
      if (!result) {
        throw new Error(`"${item.name}" is out of stock or does not have enough quantity.`);
      }
      decrementedProducts.push({ 
        productId: item.productId, 
        quantity: item.quantity,
        variationSku: item.variationSku || null
      });
    }

    // 3. Validate Coupon
    let discountAmount = 0;
    if (couponCode) {
      couponCodeClean = couponCode.toUpperCase().trim();
      const coupon = await Coupon.findOneAndUpdate(
        {
          code: couponCodeClean,
          status: 'Active',
          expiry: { $gt: new Date() },
          $expr: { $lt: ['$usage', '$usageLimit'] }
        },
        { $inc: { usage: 1 } },
        { new: true, ...sessionOpt }
      );
      if (!coupon) {
        throw new Error('Invalid, expired, or fully used coupon.');
      }
      couponUsageIncremented = true;

      // Enforce per-user coupon limit (Atomic check & increment to prevent race condition)
      await CouponUsage.findOneAndUpdate(
        { couponId: coupon._id, userId: req.user._id },
        { $setOnInsert: { usageCount: 0 } },
        { upsert: true, new: true, ...sessionOpt }
      );

      const updatedUsage = await CouponUsage.findOneAndUpdate(
        { 
          couponId: coupon._id, 
          userId: req.user._id,
          usageCount: { $lt: coupon.perUserLimit || 1 }
        },
        { $inc: { usageCount: 1 } },
        { new: true, ...sessionOpt }
      );

      if (!updatedUsage) {
        throw new Error('You have already used this coupon.');
      }

      // Apply discount based on coupon rules
      if (calculatedSubtotal >= coupon.minOrder) {
        if (coupon.type === 'Percentage') {
          discountAmount = Math.round((calculatedSubtotal * coupon.value) / 100);
          if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
            discountAmount = coupon.maxDiscount;
          }
        } else if (coupon.type === 'Fixed' || coupon.type === 'Fixed Amount') {
          discountAmount = coupon.value;
        }
        discountAmount = Math.min(discountAmount, calculatedSubtotal);
      } else {
        throw new Error(`Minimum order amount of ₹${coupon.minOrder} is required to use this coupon.`);
      }
    }

    // 4. Calculate GST and platform fee
    const SystemConfig = require('../Models/SystemConfig');
    const systemConfig = await SystemConfig.findOne({}, null, sessionOpt);
    const gstPercentage = systemConfig && systemConfig.gstPercentage !== undefined ? systemConfig.gstPercentage : 18;
    const platformCommission = systemConfig && systemConfig.commission !== undefined ? systemConfig.commission : 15;
    
    const gstAmount = Math.round(Math.max(0, calculatedSubtotal - discountAmount) * (gstPercentage / 100));

    // 5. Calculate delivery charge
    let calculatedDeliveryCharge = 0;
    try {
      const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
      const serviceResponse = await shiprocketService.checkServiceability(
        pickupPincode, 
        deliveryAddress.pincode, 
        totalOrderWeight || 0.5, 
        paymentMethod === 'COD' ? 1 : 0
      );
      if (serviceResponse && serviceResponse.data && serviceResponse.data.available_courier_companies) {
        const couriers = serviceResponse.data.available_courier_companies;
        if (couriers.length > 0) {
          const isCod = paymentMethod === 'COD';
          const calculateTotalFreight = (c) => isCod ? (c.freight_charge + (c.cod_charges || 0)) : c.freight_charge;
          calculatedDeliveryCharge = Math.min(...couriers.map(calculateTotalFreight));
        }
      }
    } catch (svcErr) {
      console.error('Serviceability check failed during price calculation:', svcErr.message);
      // Fallback to client-sent delivery charge if serviceability fails
      calculatedDeliveryCharge = Number(deliveryCharge) || 0;
    }

    const finalCalculatedTotal = Math.max(0, calculatedSubtotal - discountAmount + gstAmount + platformCommission + calculatedDeliveryCharge);

    // Coins Redemption
    if (redeemCoins) {
      const user = await User.findById(req.user._id, null, sessionOpt);
      if (user && user.referralCoins > 0) {
        coinsRedeemedAmount = Math.min(user.referralCoins, finalCalculatedTotal);
        if (coinsRedeemedAmount > 0) {
          user.referralCoins -= coinsRedeemedAmount;
          await user.save(sessionOpt);
          coinsDeducted = true;

          const CoinTransaction = require('../Models/CoinTransaction');
          await CoinTransaction.create([{
            userId: req.user._id,
            type: 'spent',
            title: 'Redeemed at Checkout',
            amount: coinsRedeemedAmount
          }], sessionOpt);
        }
      }
    }

    // Wallet Cash Redemption (new flow)
    walletDeducted = false;
    walletUsedAmount = 0;
    if (redeemWallet) {
      const user = await User.findById(req.user._id, null, sessionOpt);
      if (user && user.walletBalance > 0) {
        const remainingToPay = Math.max(0, finalCalculatedTotal - coinsRedeemedAmount);
        walletUsedAmount = Math.min(user.walletBalance, remainingToPay);
        walletUsedAmount = Number(walletUsedAmount.toFixed(2));
        if (walletUsedAmount > 0) {
          user.walletBalance -= walletUsedAmount;
          user.walletBalance = Number(user.walletBalance.toFixed(2));
          await user.save(sessionOpt);
          walletDeducted = true;

          const WalletTransaction = require('../Models/WalletTransaction');
          await WalletTransaction.create([{
            userId: req.user._id,
            type: 'Payment',
            amount: walletUsedAmount,
            description: `Used for Order Checkout`
          }], sessionOpt);
        }
      }
    }

    const finalPayableTotal = Math.max(0, finalCalculatedTotal - coinsRedeemedAmount - walletUsedAmount);

    // 6. Verify Razorpay payment if paymentMethod is Online
    if (paymentMethod === 'Online') {
      const rzpKeyId = process.env.RAZORPAY_KEY_ID;
      const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

      if (rzpKeyId && rzpKeySecret) {
        if (!paymentId) {
          throw new Error('Payment ID is required for Online payments.');
        }

        try {
          const rzpAuth = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');
          const rzpResponse = await axios.get(`https://api.razorpay.com/v1/payments/${paymentId}`, {
            headers: {
              'Authorization': `Basic ${rzpAuth}`
            }
          });

          const paymentData = rzpResponse.data;
          if (!paymentData || (paymentData.status !== 'captured' && paymentData.status !== 'authorized')) {
            throw new Error('Razorpay payment is not captured or authorized.');
          }

          // Verify amount (Razorpay amount is in paise)
          const paidAmountRupees = paymentData.amount / 100;
          if (Math.abs(paidAmountRupees - finalPayableTotal) > 1) {
            throw new Error(`Payment amount mismatch. Expected: ₹${finalPayableTotal}, Paid: ₹${paidAmountRupees}`);
          }

          if (paymentData.currency !== 'INR') {
            throw new Error('Currency mismatch. Only INR is supported.');
          }

        } catch (paymentErr) {
          console.error('Razorpay verification error:', paymentErr.response?.data || paymentErr.message);
          throw new Error(`Payment verification failed: ${paymentErr.response?.data?.error?.description || paymentErr.message}`);
        }
      } else {
        console.warn('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET not set in environment. Bypassing live verification.');
        if (process.env.ENV === 'production') {
          throw new Error('Razorpay keys not configured on server.');
        }
      }
    }

    // 7. Create the Order
    const orderData = {
      userId: req.user._id,
      items: validatedItems,
      total: finalPayableTotal,
      coinsRedeemed: coinsRedeemedAmount,
      walletUsed: walletUsedAmount,
      deliveryAddress,
      paymentMethod,
      paymentStatus: paymentMethod === 'Online' ? 'Paid' : 'Pending',
      status: 'Pending',
      couponCode: couponCodeClean || null,
      deliveryCharge: calculatedDeliveryCharge,
      etd: etd || ''
    };
    if (paymentId) {
      orderData.paymentId = paymentId;
    }

    const orderDocs = await Order.create([orderData], sessionOpt);
    const order = orderDocs[0];

    // CouponUsage already incremented atomically during validation

    // Commit transaction if active
    if (transactionActive) {
      await session.commitTransaction();
      transactionActive = false;
    }
    session.endSession();

    // Send order to Shiprocket (outside database transaction to avoid locking write rows during network call)
    try {
      const user = await User.findById(req.user._id);
      const cityState = shiprocketService.parseCityState(deliveryAddress.address);

      const shiprocketOrderData = {
        order_id: `ORD_${order._id}`,
        order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Home',
        billing_customer_name: user.name || deliveryAddress.name || 'Customer',
        billing_last_name: '',
        billing_address: deliveryAddress.address,
        billing_city: cityState.city,
        billing_pincode: deliveryAddress.pincode,
        billing_state: cityState.state,
        billing_country: 'India',
        billing_email: user.email || 'customer@aramish.com',
        billing_phone: user.phone || '9876543210',
        shipping_is_billing: true,
        order_items: validatedItems.map(item => ({
            name: item.name,
            sku: item.productId.toString(),
            units: item.quantity || 1,
            selling_price: item.price,
            discount: 0,
            tax: 0,
            hsn: 441122
        })),
        payment_method: paymentMethod === 'COD' ? 'COD' : 'Prepaid',
        sub_total: finalCalculatedTotal,
        length: 10,
        breadth: 10,
        height: 10,
        weight: totalOrderWeight || 0.5
      };

      const srResponse = await shiprocketService.createShiprocketOrder(shiprocketOrderData);
      
      if (srResponse) {
        order.shiprocketResponses.push({ type: 'CREATE_ORDER', data: srResponse });
        if (srResponse.order_id) {
          order.shiprocketOrderId = srResponse.order_id;
          order.shipmentId = srResponse.shipment_id;
        }
      }

      // Recheck/store serviceability details
      try {
        const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
        const serviceResponse = await shiprocketService.checkServiceability(pickupPincode, deliveryAddress.pincode, totalOrderWeight || 0.5, paymentMethod === 'COD' ? 1 : 0);
        order.shiprocketResponses.push({ type: 'SERVICEABILITY', data: serviceResponse });
        
        if (serviceResponse && serviceResponse.data && serviceResponse.data.available_courier_companies) {
          const couriers = serviceResponse.data.available_courier_companies;
          if (couriers.length > 0) {
            const isCod = paymentMethod === 'COD';
            const calculateTotalFreight = (c) => isCod ? (c.freight_charge + (c.cod_charges || 0)) : c.freight_charge;
            const minFreight = Math.min(...couriers.map(calculateTotalFreight));
            order.deliveryCharge = minFreight;
            
            const bestCourier = couriers.find(c => calculateTotalFreight(c) === minFreight);
            if (bestCourier && bestCourier.etd) {
              order.etd = bestCourier.etd;
            }
          }
        }
      } catch (svcErr) {
        console.error('Serviceability check failed:', svcErr.message);
      }

      await order.save();
    } catch (srError) {
      console.error('Shiprocket order creation failed, will need manual sync:', srError.message);
    }

    // Clear user cart

    // Clear user cart
    const cart = await Cart.findOne({ userId: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    res.status(201).json({ success: true, message: 'Order placed successfully', order });
  } catch (error) {
    console.error("Error creating order:", error);

    if (transactionActive) {
      await session.abortTransaction();
      session.endSession();
    } else {
      // Fallback manual rollback for standalone Mongo DBs
      for (const rolledBack of decrementedProducts) {
        if (rolledBack.variationSku) {
          await Product.findOneAndUpdate(
            { _id: rolledBack.productId, 'variations.sku': rolledBack.variationSku },
            { 
              $inc: { 
                'variations.$.stock': rolledBack.quantity, 
                sales: -rolledBack.quantity 
              } 
            }
          );
        } else {
          await Product.findByIdAndUpdate(rolledBack.productId, {
            $inc: { 
              stock: rolledBack.quantity, 
              sales: -rolledBack.quantity 
            }
          });
        }
      }

      if (couponUsageIncremented && couponCodeClean) {
        await Coupon.findOneAndUpdate(
          { code: couponCodeClean },
          { $inc: { usage: -1 } }
        );
        // Also rollback CouponUsage for this user
        const coupon = await Coupon.findOne({ code: couponCodeClean });
        if (coupon) {
          await CouponUsage.findOneAndUpdate(
            { couponId: coupon._id, userId: req.user._id },
            { $inc: { usageCount: -1 } }
          );
        }
      }

      if (coinsDeducted && coinsRedeemedAmount > 0) {
        await User.findByIdAndUpdate(req.user._id, {
          $inc: { referralCoins: coinsRedeemedAmount }
        });
        const CoinTransaction = require('../Models/CoinTransaction');
        await CoinTransaction.create({
          userId: req.user._id,
          type: 'earned',
          title: 'Refund: Checkout Failure Rollback',
          amount: coinsRedeemedAmount
        });
      }

      if (walletDeducted && walletUsedAmount > 0) {
        await User.findByIdAndUpdate(req.user._id, {
          $inc: { walletBalance: walletUsedAmount }
        });
        const WalletTransaction = require('../Models/WalletTransaction');
        await WalletTransaction.create({
          userId: req.user._id,
          type: 'Refund',
          amount: walletUsedAmount,
          description: 'Refund: Checkout Failure Rollback'
        });
      }
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in user's orders (with pagination)
// @route   GET /api/orders
// @access  Private
exports.getUserOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ userId: req.user._id })
    ]);

    res.status(200).json({ 
      success: true, 
      count: orders.length, 
      total,
      page,
      pages: Math.ceil(total / limit),
      orders 
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all orders (Admin only, with pagination)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
exports.getAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({})
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({})
    ]);

    res.status(200).json({ 
      success: true, 
      count: orders.length, 
      total,
      page,
      pages: Math.ceil(total / limit),
      orders 
    });
  } catch (error) {
    console.error("Error fetching all orders for admin:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status (Admin only)
// @route   PUT /api/orders/admin/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const targetStatus = status || order.status;
    const targetPaymentStatus = paymentStatus || order.paymentStatus;

    // Prevent processing unpaid/failed Online orders
    const advancedStatuses = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
    if (order.paymentMethod === 'Online' && advancedStatuses.includes(targetStatus)) {
      if (targetPaymentStatus === 'Pending') {
        return res.status(400).json({
          success: false,
          message: `Cannot change status to '${targetStatus}' because online payment is still Pending.`
        });
      }
      if (targetPaymentStatus === 'Failed') {
        return res.status(400).json({
          success: false,
          message: `Cannot change status to '${targetStatus}' because online payment Failed.`
        });
      }
    }

    // Generic fallback for COD Delivered/Failed
    if (targetStatus === 'Delivered' && targetPaymentStatus === 'Failed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot have order status as Delivered when payment status is Failed.'
      });
    }

    if (status && status !== order.status) {
      const validTransitions = {
        'Pending': ['Processing', 'Cancelled'],
        'Processing': ['Shipped', 'Cancelled'],
        'Shipped': ['Out for Delivery', 'Cancelled'],
        'Out for Delivery': ['Delivered', 'Cancelled'],
        'Delivered': ['Return Requested', 'Refunded', 'Partially Refunded', 'Exchange Requested'],
        'Return Requested': ['Cancelled', 'Refunded', 'Partially Refunded'],
        'Cancelled': [],
        'Refunded': [],
        'Partially Refunded': [],
        // Exchange FSM
        'Exchange Requested': ['Exchange Approved', 'Exchange Rejected'],
        'Exchange Approved': ['Pickup Scheduled', 'Exchange Cancelled', 'Exchange Failed', 'Manual Review'],
        'Pickup Scheduled': ['Old Item Picked Up', 'Exchange Failed', 'Manual Review'],
        'Old Item Picked Up': ['Replacement Dispatched', 'Exchange Failed', 'Manual Review'],
        'Replacement Dispatched': ['Exchange Completed', 'Exchange Failed', 'Manual Review'],
        'Exchange Completed': [],
        'Exchange Rejected': [],
        'Exchange Cancelled': [],
        'Exchange Failed': ['Manual Review'],
        'Manual Review': ['Exchange Approved', 'Exchange Cancelled', 'Exchange Failed', 'Exchange Completed']
      };

      const allowed = validTransitions[order.status];
      if (!allowed || !allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition order status from '${order.status}' to '${status}'.`
        });
      }
    }

    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      await handleOrderCancellationStockAndCoupon(order);
      await handleOrderCancellationRefunds(order);
    }

    if (status && status !== order.status) {
      try {
        const Notification = require('../Models/Notification');
        const { sendNotificationToUser } = require('../Router/firebaseAdmin');

        const title = `Order Status: ${status}`;
        const body = `Your order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()} is now ${status}.`;

        const newNotification = new Notification({
          title,
          body,
          target: 'Selected Users',
          targetUserIds: [order.userId],
          status: 'Delivered',
          sentAt: new Date()
        });
        await newNotification.save();

        // Trigger push notification asynchronously
        sendNotificationToUser(order.userId, { title, body }).catch(e => console.error('Push notification failed:', e));
      } catch (notifErr) {
        console.error('Error creating order notification:', notifErr);
      }
    }

    if (status) {
      order.status = status;
      if (status === 'Delivered') {
        order.paymentStatus = 'Paid';
      }
    }
    if (paymentStatus && status !== 'Delivered') {
      order.paymentStatus = paymentStatus;
    }

    await order.save();
    await checkAndTriggerReferral(order);
    res.status(200).json({ success: true, message: 'Order status updated successfully', order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order by ID
exports.getUserOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, message: 'Not authorized to view this order' });
    }
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order by ID (Admin)
// @route   GET /api/orders/admin/:id
// @access  Private/Admin
exports.getAdminOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'name email phone');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order for admin:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Track order by ID (Public)
// @route   GET /api/orders/track/:id
// @access  Public
exports.trackOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Order ID format' });
    }

    // 1. Get token from authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
    }

    const jwt = require('jsonwebtoken');

    // 2. Verify token
    let decoded;
    let isAdmin = false;
    let isUser = false;

    // Try admin secret first
    try {
      const adminSecret = process.env.JWT_ADMIN_SECRET || (process.env.JWT_SECRET ? process.env.JWT_SECRET + '_admin_secret_fallback' : 'admin_default_super_secret_key_1298471298');
      decoded = jwt.verify(token, adminSecret);
      if (decoded.aud === 'admin') {
        isAdmin = true;
      }
    } catch (err) {
      // Not admin, try user secret
    }

    if (!isAdmin) {
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.aud === 'user') {
          isUser = true;
        }
      } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
      }
    }

    if (!isAdmin && !isUser) {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid token audience' });
    }

    // 3. Find order
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 4. If user, verify ownership
    if (isUser && order.userId.toString() !== decoded.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    // Sanitize order data to avoid exposing sensitive customer info publicly
    const sanitizedOrder = {
      _id: order._id,
      status: order.status,
      etd: order.etd,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      items: order.items.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image
      })),
      trackingHistory: order.trackingHistory || [],
      createdAt: order.createdAt,
      awbCode: order.awbCode
    };

    res.status(200).json({ success: true, order: sanitizedOrder });
  } catch (error) {
    console.error("Error tracking order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete order (Admin only)
// @route   DELETE /api/orders/admin/:id
// @access  Private/Admin
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 1. Restore stock & coupon usage if the order wasn't already cancelled
    if (order.status !== 'Cancelled') {
      try {
        await handleOrderCancellationStockAndCoupon(order);
      } catch (stockErr) {
        console.error('Cancellation rollback failed during order deletion:', stockErr.message);
      }
    }

    // 2. Try to cancel on Shiprocket if shiprocketOrderId exists
    if (order.shiprocketOrderId && order.shipmentStatus !== 'Cancelled') {
      try {
        const token = await shiprocketService.getShiprocketToken();
        if (token) {
          const axios = require('axios');
          const SHIPROCKET_API_BASE = process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in';
          await axios.post(`${SHIPROCKET_API_BASE}/v1/external/orders/cancel`, {
            ids: [order.shiprocketOrderId]
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log(`Shiprocket order ${order.shiprocketOrderId} cancelled successfully during delete.`);
        }
      } catch (srErr) {
        // Ignore Shiprocket cancellation error as per requirements
        console.error('Shiprocket cancel failed during order deletion (ignored):', srErr.response?.data || srErr.message);
      }
    }

    // 3. Delete order from MongoDB database
    await Order.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Order deleted and cancelled on Shiprocket successfully' });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel order (User only)
// @route   POST /api/orders/:id/cancel
// @access  Private (User)
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify ownership
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    // A user can cancel an order unless it is Out for Delivery or Delivered or already Cancelled
    const nonCancellableStates = ['Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Refunded', 'Partially Refunded'];
    if (nonCancellableStates.includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot cancel order. Current status is ${order.status}` 
      });
    }

    // Restore stock & coupon usage
    await handleOrderCancellationStockAndCoupon(order);

    // Refund wallet balance, coins, and online payments
    await handleOrderCancellationRefunds(order);

    // Try to cancel on Shiprocket if shiprocketOrderId exists
    if (order.shiprocketOrderId && order.shipmentStatus !== 'Cancelled') {
      try {
        const token = await shiprocketService.getShiprocketToken();
        if (token) {
          const axios = require('axios');
          const SHIPROCKET_API_BASE = process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in';
          await axios.post(`${SHIPROCKET_API_BASE}/v1/external/orders/cancel`, {
            ids: [order.shiprocketOrderId]
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log(`Shiprocket order ${order.shiprocketOrderId} cancelled successfully.`);
        }
      } catch (srErr) {
        console.error('Shiprocket cancel failed (ignored):', srErr.response?.data || srErr.message);
      }
    }

    order.status = 'Cancelled';
    await order.save();

    // Create notification
    try {
      const Notification = require('../Models/Notification');
      const { sendNotificationToUser } = require('../Router/firebaseAdmin');

      const title = `Order Cancelled`;
      const body = `Your order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()} has been cancelled successfully.`;

      const newNotification = new Notification({
        title,
        body,
        target: 'Selected Users',
        targetUserIds: [order.userId],
        status: 'Delivered',
        sentAt: new Date()
      });
      await newNotification.save();

      sendNotificationToUser(order.userId, { title, body }).catch(e => console.error('Push notification failed:', e));
    } catch (notifErr) {
      console.error('Error creating order cancellation notification:', notifErr);
    }

    res.status(200).json({ success: true, message: 'Order cancelled successfully', order });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


