const Order = require('../Models/Order');
const Cart = require('../Models/Cart');
const Coupon = require('../Models/Coupon');
const Product = require('../Models/Product');
const User = require('../Models/User');
const shiprocketService = require('../Router/shiprocketService');
const mongoose = require('mongoose');
const CouponUsage = require('../Models/CouponUsage');
const { handleOrderCancellationStockAndCoupon, handleOrderCancellationRefunds } = require('../utils/orderHelper');
const walletService = require('../utils/walletService');
const { isRazorpayConfigured, verifyAndCapturePayment } = require('../utils/razorpayService');
const { loadShippingDetails, buildShiprocketOrderPayload, cheapestCourier } = require('../utils/shiprocketPayload');

// Resolves the price the customer actually pays for a line (admin selling price, or the
// variation's own selling price) — never the MRP.
const resolveLinePricing = (product, variationSku) => {
  if (!variationSku) {
    return { price: product.sellingPrice, mrp: product.mrp, stock: product.stock };
  }
  const variant = (product.variations || []).find(v => v.sku === variationSku);
  if (!variant) return null;
  return {
    price: (!variant.useDefaultPricing && variant.sellingPrice !== undefined) ? variant.sellingPrice : product.sellingPrice,
    mrp: (!variant.useDefaultPricing && variant.mrp !== undefined) ? variant.mrp : product.mrp,
    stock: variant.stock
  };
};
// A checkout problem caused by the request (bad input, stock, coupon, payment) rather than the
// server, answered with its own 4xx status instead of 500.
const checkoutError = (message, status = 400) => Object.assign(new Error(message), { status });

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  let decrementedProducts = [];
  let couponUsageIncremented = false;
  let couponCodeClean = null;
  
  const session = await mongoose.startSession();
  let transactionActive = false;
  // Compensation steps registered by walletService, replayed only on the non-transactional path
  const walletUndo = [];

  try {
    const { items, total, deliveryAddress, paymentMethod, paymentStatus, paymentId, couponCode, etd, redeemWallet, redeemReferralCoins, redeemRefundWallet } = req.body;

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
        throw checkoutError(`Product "${item.name}" not found.`, 400);
      }
      if (product.status !== 'Approved') {
        throw checkoutError(`"${product.name}" is not available for purchase.`, 400);
      }
      // A negative/fractional quantity would pass the `stock >= qty` guard, add stock back and
      // lower the order total.
      const qty = item.quantity === undefined || item.quantity === null ? 1 : Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        throw checkoutError(`Invalid quantity for "${product.name}".`, 400);
      }
      // A variant product is sold (and stocked) per variant; `stock` is only their total.
      if (!item.variationSku && product.variations && product.variations.length > 0) {
        throw checkoutError(`Please select a size/colour for "${product.name}".`, 400);
      }

      const pricing = resolveLinePricing(product, item.variationSku);
      if (!pricing) {
        throw checkoutError(`Variation "${item.variationSku}" of "${product.name}" not found.`, 400);
      }
      const itemPrice = pricing.price;
      const itemMrp = pricing.mrp;

      calculatedSubtotal += itemPrice * qty;
      const productWeight = (product.shippingSpecs && product.shippingSpecs.weight) ? product.shippingSpecs.weight : 0.5;
      totalOrderWeight += (productWeight * qty);

      validatedItems.push({
        productId: item.productId,
        name: product.name,
        price: itemPrice,
        mrp: itemMrp,
        quantity: qty,
        image: item.image || (product.images && product.images[0]) || '',
        variationSku: item.variationSku || null,
        article: product.article || null,
        attributes: item.attributes || {},
        gstPercentage: product.gstPercentage || 0
      });
    }

    // 2. Verify and decrement stock atomically
    for (const item of validatedItems) {
      let result;
      if (item.variationSku) {
        result = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            variations: {
              $elemMatch: { sku: item.variationSku, stock: { $gte: item.quantity } }
            }
          },
          {
            $inc: {
              'variations.$.stock': -item.quantity,
              stock: -item.quantity,
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
        throw checkoutError(`"${item.name}" is out of stock or does not have enough quantity.`, 409);
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
        throw checkoutError('Invalid, expired, or fully used coupon.', 400);
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
        throw checkoutError('You have already used this coupon.', 400);
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
        throw checkoutError(`Minimum order amount of ₹${coupon.minOrder} is required to use this coupon.`, 400);
      }
    }

    // 4. Calculate GST and platform fee
    const SystemConfig = require('../Models/SystemConfig');
    const systemConfig = await SystemConfig.findOne({}, null, sessionOpt);
    const platformCommission = systemConfig && systemConfig.commission !== undefined ? systemConfig.commission : 15;
    
    // Calculate item-level GST
    const discountRatio = calculatedSubtotal > 0 ? (discountAmount / calculatedSubtotal) : 0;
    let totalGstAmount = 0;
    for (const item of validatedItems) {
      const itemTotalPrice = item.price * item.quantity;
      const itemFinalPrice = Math.max(0, itemTotalPrice - (itemTotalPrice * discountRatio));
      totalGstAmount += itemFinalPrice * ((item.gstPercentage || 0) / 100);
    }
    const gstAmount = Math.round(totalGstAmount);

    // 5. Calculate delivery charge — always from Shiprocket's live quote, never from the app's
    // request (a failed quote used to fall back to the client value, i.e. free delivery).
    let serviceResponse;
    try {
      const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
      serviceResponse = await shiprocketService.checkServiceability(
        pickupPincode,
        deliveryAddress.pincode,
        totalOrderWeight || 0.5,
        paymentMethod === 'COD' ? 1 : 0
      );
    } catch (svcErr) {
      console.error('Serviceability check failed during price calculation:', svcErr.message);
      throw checkoutError('We could not calculate the delivery charge right now. Please try again in a few minutes.', 503);
    }
    const bestCourier = cheapestCourier(serviceResponse?.data?.available_courier_companies, paymentMethod === 'COD');
    if (!bestCourier) {
      throw checkoutError(`Sorry, delivery is not available to pincode ${deliveryAddress.pincode}${paymentMethod === 'COD' ? ' with Cash on Delivery' : ''}.`, 400);
    }
    const calculatedDeliveryCharge = bestCourier.charge;

    const isCodChargeEnabled = systemConfig && systemConfig.codChargeEnabled !== undefined ? systemConfig.codChargeEnabled : true;
    const codChargeAmount = systemConfig && systemConfig.codChargeAmount !== undefined ? systemConfig.codChargeAmount : 150;
    const isPrepaidDiscountEnabled = systemConfig && systemConfig.prepaidDiscountEnabled !== undefined ? systemConfig.prepaidDiscountEnabled : true;
    const prepaidDiscountAmount = systemConfig && systemConfig.prepaidDiscountAmount !== undefined ? systemConfig.prepaidDiscountAmount : 100;

    const codCharge = (isCodChargeEnabled && paymentMethod === 'COD') ? codChargeAmount : 0;
    const prepaidDiscount = (isPrepaidDiscountEnabled && paymentMethod === 'Online') ? prepaidDiscountAmount : 0;

    const finalCalculatedTotal = Math.max(0, calculatedSubtotal - discountAmount + gstAmount + platformCommission + calculatedDeliveryCharge + codCharge - prepaidDiscount);

    const newOrderId = new mongoose.Types.ObjectId();

    // Reward/redemption basis: the product selling value only (selling price x qty) —
    // excludes GST, delivery, platform fee and COD charges. Calculated in integer paise.
    const walletConfig = await walletService.getWalletConfig(sessionOpt);
    const eligibleProductValue = walletService.calculateEligibleProductValue(validatedItems);
    const rewardCoinsExpected = walletService.calculateOrderRewardCoins(eligibleProductValue, walletConfig);

    // Single combined wallet: redeem up to walletRedemptionPercentage% of the eligible
    // product value (and never more than the spendable, unlocked balance). `redeemReferralCoins`
    // is accepted from older app builds as an alias for the same single wallet.
    let walletUsedAmount = 0;
    if (redeemWallet || redeemReferralCoins) {
      const redemption = await walletService.redeemForOrder({
        userId: req.user._id,
        orderId: newOrderId,
        eligibleProductValue,
        payableTotal: finalCalculatedTotal
      }, { sessionOpt, session: transactionActive ? session : null, undo: walletUndo });
      walletUsedAmount = redemption.amount;
    }

    // Refund Wallet (actual money, separate from coins): no % limit — up to 100% of the
    // balance, capped only by what is still payable after the coins.
    let refundWalletUsedAmount = 0;
    if (redeemRefundWallet) {
      const refundUse = await walletService.useRefundWalletForOrder({
        userId: req.user._id,
        orderId: newOrderId,
        payableTotal: walletService.roundMoney(Math.max(0, finalCalculatedTotal - walletUsedAmount))
      }, { sessionOpt, session: transactionActive ? session : null, undo: walletUndo });
      refundWalletUsedAmount = refundUse.amount;
    }

    const finalPayableTotal = walletService.roundMoney(Math.max(0, finalCalculatedTotal - walletUsedAmount - refundWalletUsedAmount));

    // 6. Verify Razorpay payment if paymentMethod is Online
    if (paymentMethod === 'Online') {
      if (isRazorpayConfigured()) {
        if (!paymentId) {
          throw checkoutError('Payment ID is required for Online payments.', 400);
        }

        try {
          await verifyAndCapturePayment(paymentId, finalPayableTotal);
        } catch (paymentErr) {
          console.error('Razorpay verification error:', paymentErr.response?.data || paymentErr.message);
          throw checkoutError(`Payment verification failed: ${paymentErr.response?.data?.error?.description || paymentErr.message}`, 400);
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
      _id: newOrderId,
      userId: req.user._id,
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discountAmount,
      gstAmount,
      platformCommission,
      total: finalPayableTotal,
      walletUsed: walletUsedAmount,
      refundWalletUsed: refundWalletUsedAmount,
      eligibleProductValue,
      rewardCoinsExpected,
      deliveryAddress,
      paymentMethod,
      paymentStatus: paymentMethod === 'Online' ? 'Paid' : 'Pending',
      status: 'Pending',
      couponCode: couponCodeClean || null,
      deliveryCharge: calculatedDeliveryCharge,
      codCharge,
      prepaidDiscount,
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
      const { hsnByProductId } = await loadShippingDetails(order.items);
      // Built from the saved order: COD amount = order.total (after coins / Refund Wallet).
      const shiprocketOrderData = buildShiprocketOrderPayload(order, user, { weight: totalOrderWeight, hsnByProductId });

      const srResponse = await shiprocketService.createShiprocketOrder(shiprocketOrderData);

      if (srResponse) {
        order.shiprocketResponses.push({ type: 'CREATE_ORDER', data: srResponse });
        if (srResponse.order_id) {
          order.shiprocketOrderId = srResponse.order_id;
          order.shipmentId = srResponse.shipment_id;
        }
      }

      // Keep the quote the customer was charged from. The delivery charge itself is not
      // touched here — it is already part of the order total the customer agreed to.
      order.shiprocketResponses.push({ type: 'SERVICEABILITY', data: serviceResponse });
      if (bestCourier.courier.etd) {
        order.etd = bestCourier.courier.etd;
      }

      await order.save();
    } catch (srError) {
      console.error('Shiprocket order creation failed, will need manual sync:', srError.message);
    }

    // Clear user cart
    const cart = await Cart.findOne({ userId: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    // Send push notification to Admins outside app
    try {
      const { sendNotificationToAdmins } = require('../Router/firebaseAdmin');
      const orderShortId = order._id.toString().slice(-6).toUpperCase();
      sendNotificationToAdmins({
        title: '🛍️ New Order Received!',
        body: `Order #${orderShortId} placed by ${deliveryAddress.name || 'Customer'} for ₹${finalPayableTotal}.`,
        data: {
          url: '/orders',
          orderId: order._id.toString(),
          type: 'NEW_ORDER'
        }
      });
    } catch (notifErr) {
      console.error('Failed to notify admins of new order:', notifErr.message);
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
                stock: rolledBack.quantity,
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
      // Undo the wallet redemption (balance + its ledger entry) for this failed checkout
      for (const undoStep of [...walletUndo].reverse()) {
        try {
          await undoStep();
        } catch (undoErr) {
          console.error('CRITICAL: failed to roll back wallet redemption after checkout failure. Manual reconciliation required.', undoErr);
        }
      }
    }

    let status = error.status || 500;
    if (error.name === 'ValidationError' || error.name === 'CastError') status = 400;
    else if (error.code === 11000 && error.keyPattern && error.keyPattern.paymentId) status = 409;
    res.status(status).json({ success: false, message: status === 409 && error.code === 11000 ? 'This payment has already been used for another order.' : error.message });
  }
};

// @desc    Wallet redemption + reward preview for the checkout screen (backend-calculated)
// @route   POST /api/orders/wallet-preview   body: { items: [{ productId, variationSku, quantity }], payableTotal? }
// @access  Private
exports.getWalletPreview = async (req, res) => {
  try {
    const { items, payableTotal } = req.body || {}; // payableTotal: order total before any wallet use
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items are required' });
    }

    const products = await Product.find({ _id: { $in: items.map(i => i.productId) } }, 'sellingPrice mrp stock variations').lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const pricedItems = [];
    for (const item of items) {
      const product = productMap.get(String(item.productId));
      const pricing = product && resolveLinePricing(product, item.variationSku);
      if (!pricing) continue;
      pricedItems.push({ price: pricing.price, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)) });
    }

    const eligibleProductValue = walletService.calculateEligibleProductValue(pricedItems);
    const payable = payableTotal !== undefined && payableTotal !== null && Number.isFinite(Number(payableTotal)) ? Number(payableTotal) : null;
    const preview = await walletService.getRedemptionPreview(req.user._id, { eligibleProductValue, payableTotal: payable });

    res.status(200).json({ success: true, ...preview });
  } catch (error) {
    console.error('Wallet preview error:', error);
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

    const previousStatus = order.status;
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
        // Once a ReturnRequest exists ('Return Requested'), the refund MUST go through the
        // dedicated /returns/admin/:id/status endpoint (returnController.updateReturnStatus),
        // which restores stock for the specific returned items and processes the tracked
        // refundAmount atomically. Allowing 'Refunded'/'Partially Refunded' here would let an
        // admin bypass that per-item accounting via this generic endpoint (money/coins refunded,
        // stock and shipment left untouched). Only 'Cancelled' remains available here.
        'Return Requested': ['Cancelled'],
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
      // Stock/coupon restore and reward clawback happen atomically together inside
      // handleOrderCancellationRefunds. Redeemed coins are non-returnable and not restored.
      await handleOrderCancellationRefunds(order);
    }

    // A full refund set directly through this generic endpoint (bypassing the dedicated
    // returns flow) must still claw back the order's locked reward coins and process the
    // payment refund. We deliberately do
    // NOT do this for 'Partially Refunded' here: that status has no tracked partial amount at
    // this endpoint (unlike the dedicated return flow, which tracks per-item quantities and an
    // explicit refundAmount), so applying the full-order refund logic would over-refund. We
    // also skip stock restoration here — a generic status change isn't necessarily a physical
    // return of goods.
    if (status === 'Refunded' && order.status !== 'Refunded') {
      await handleOrderCancellationRefunds(order, { restoreStock: false });
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
      if (status !== previousStatus) {
        order.trackingHistory = order.trackingHistory || [];
        order.trackingHistory.push({
          status,
          timestamp: new Date(),
          activity: `Order status updated to ${status}`
        });
      }
    }
    if (paymentStatus && status !== 'Delivered') {
      order.paymentStatus = paymentStatus;
    }

    await order.save();

    // Manual fulfilment path: same idempotent reward crediting as the Shiprocket webhook/sync
    // (customer's locked order reward + referrer's per-order referral reward).
    if (order.status === 'Delivered') {
      await walletService.processDeliveredOrderRewards(order._id);
    }

    res.status(200).json({ success: true, message: 'Order status updated successfully', order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order by ID
exports.getUserOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    let order = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }

    // Fallback: match by short ID suffix from user's orders
    if (!order && id) {
      const userOrders = await Order.find({ userId: req.user._id });
      order = userOrders.find(o => 
        o._id.toString().toUpperCase().endsWith(id.toUpperCase()) ||
        (o.orderId && o.orderId.toUpperCase().includes(id.toUpperCase()))
      );
    }

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
      // Best-effort: a failed Shiprocket cancel is logged and ignored, as before.
      const srCancel = await shiprocketService.cancelShiprocketOrder(order.shiprocketOrderId);
      if (srCancel) console.log(`Shiprocket order ${order.shiprocketOrderId} cancelled successfully during delete.`);
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

    // Only orders that haven't reached the customer can be cancelled. An allowlist (not a
    // denylist) so post-delivery states — returns and every exchange state — can never trigger
    // a full refund + restock.
    const cancellableStates = ['Pending', 'Processing', 'Shipped'];
    if (!cancellableStates.includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot cancel order. Current status is ${order.status}` 
      });
    }

    // Restore stock & coupon usage and process the online payment refund. Coins redeemed on
    // the order are non-returnable and are not restored.
    await handleOrderCancellationRefunds(order);

    // Try to cancel on Shiprocket if shiprocketOrderId exists
    if (order.shiprocketOrderId && order.shipmentStatus !== 'Cancelled') {
      // Best-effort: a failed Shiprocket cancel is logged and ignored, as before.
      const srCancel = await shiprocketService.cancelShiprocketOrder(order.shiprocketOrderId);
      if (srCancel) console.log(`Shiprocket order ${order.shiprocketOrderId} cancelled successfully.`);
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


