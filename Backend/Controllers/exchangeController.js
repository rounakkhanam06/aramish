const ExchangeRequest = require('../Models/ExchangeRequest');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const SystemConfig = require('../Models/SystemConfig');
const User = require('../Models/User');
const mongoose = require('mongoose');
const shiprocketService = require('../Router/shiprocketService');
const { EXCHANGE_WEBHOOK_MAP } = require('../Router/shiprocketService');
const { resolveVariantPrice } = require('../utils/priceHelper');
const { getDeliveredAt, refundOnlinePayment } = require('../utils/orderHelper');
const { verifyWebhookToken } = require('../utils/shiprocketWebhookAuth');
const { isRazorpayConfigured, verifyAndCapturePayment } = require('../utils/razorpayService');
const { loadShippingDetails, toOrderItem } = require('../utils/shiprocketPayload');

// Verifies (and captures) a Razorpay payment covering `expectedAmount` (rupees) — the same check
// checkout uses, applied to exchange price-difference payments.
const verifyRazorpayPayment = async (paymentId, expectedAmount) => {
  if (!isRazorpayConfigured()) {
    if (process.env.ENV === 'production') {
      throw new Error('Razorpay keys not configured on server.');
    }
    console.warn('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET not set in environment. Bypassing live verification.');
    return;
  }

  try {
    await verifyAndCapturePayment(paymentId, expectedAmount);
  } catch (paymentErr) {
    console.error('Razorpay verification error:', paymentErr.response?.data || paymentErr.message);
    throw new Error(`Payment verification failed: ${paymentErr.response?.data?.error?.description || paymentErr.message}`);
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const addTimeline = (exchange, status, actor, actorId, remarks = '') => {
  exchange.timeline.push({ status, actor, actorId: actorId || null, remarks, timestamp: new Date() });
};

const addAudit = (exchange, action, admin, fromStatus, toStatus, notes = '') => {
  exchange.auditLog.push({
    action, fromStatus, toStatus, notes, timestamp: new Date(),
    adminId: admin?._id || null,
    adminName: admin?.name || admin?.email || 'System'
  });
};

// Allowed exchange status transitions (admin and webhook). Terminal states have no exits, so
// stock side effects (reserve on Approved, release on Cancelled/Failed, restock on Completed)
// can each happen at most once.
const EXCHANGE_TRANSITIONS = {
  'Requested': ['Approved', 'Rejected', 'Cancelled'],
  'Approved': ['Pickup Scheduled', 'Old Item Picked Up', 'Replacement Dispatched', 'Completed', 'Cancelled', 'Failed', 'Manual Review'],
  'Pickup Scheduled': ['Old Item Picked Up', 'Replacement Dispatched', 'Completed', 'Cancelled', 'Failed', 'Manual Review'],
  'Old Item Picked Up': ['Replacement Dispatched', 'Completed', 'Failed', 'Manual Review'],
  'Replacement Dispatched': ['Completed', 'Failed', 'Manual Review'],
  'Manual Review': ['Pickup Scheduled', 'Old Item Picked Up', 'Replacement Dispatched', 'Completed', 'Cancelled', 'Failed'],
  'Completed': [],
  'Rejected': [],
  'Cancelled': [],
  'Failed': []
};

// Atomically moves the exchange from `from` to `to`; null if another request (admin or
// webhook) changed it first.
const claimExchangeStatus = (id, from, to) =>
  ExchangeRequest.findOneAndUpdate({ _id: id, status: from }, { $set: { status: to } });

// The customer's old item is back in the warehouse. Its sale is replaced by the replacement's,
// so `sales` stays unchanged.
const restockOriginalItem = (exchange) => {
  const { productId, variationSku } = exchange.originalItem;
  const qty = exchange.originalItem.quantity || 1;
  return variationSku
    ? Product.findOneAndUpdate({ _id: productId, 'variations.sku': variationSku }, { $inc: { 'variations.$.stock': qty, stock: qty } })
    : Product.findByIdAndUpdate(productId, { $inc: { stock: qty } });
};

// The exchange won't happen, so the price difference the customer paid goes back: to the
// original Razorpay payment, or to the Refund Wallet if that refund fails. A COD difference was
// never collected and is simply no longer due. Claimed via paymentStatus so it runs once.
const refundExchangeDifference = async (exchange) => {
  if (exchange.paymentStatus === 'Pending') {
    exchange.paymentStatus = 'Not Required';
    return;
  }
  if (exchange.paymentStatus !== 'Collected' || !(exchange.additionalAmount > 0)) return;

  const claimed = await ExchangeRequest.findOneAndUpdate(
    { _id: exchange._id, paymentStatus: 'Collected' },
    { $set: { paymentStatus: 'Refunded' } }
  );
  if (!claimed) return;
  try {
    await refundOnlinePayment({
      order: { paymentMethod: 'Online', paymentId: exchange.paymentId, userId: exchange.userId },
      amountRupees: exchange.additionalAmount,
      allowStoreCredit: true,
      storeCredit: {
        orderId: exchange.orderId,
        description: `Refund of price difference for Exchange #${exchange._id.toString().slice(-6).toUpperCase()}`,
        idempotencyKey: `EXCHANGE_DIFFERENCE_REFUND:${exchange._id}`
      }
    });
    exchange.paymentStatus = 'Refunded';
  } catch (err) {
    await ExchangeRequest.updateOne({ _id: exchange._id }, { $set: { paymentStatus: 'Collected' } });
    throw err;
  }
};

const releaseReservedStock = async (exchange) => {
  if (exchange.inventoryReservation && !exchange.inventoryReservation.released && exchange.inventoryReservation.variantSku) {
    await Product.findOneAndUpdate(
      { _id: exchange.inventoryReservation.productId, 'variations.sku': exchange.inventoryReservation.variantSku },
      { $inc: { 'variations.$.stock': exchange.inventoryReservation.quantity || 1, stock: exchange.inventoryReservation.quantity || 1 } }
    );
    exchange.inventoryReservation.released = true;
    exchange.inventoryReservation.releasedAt = new Date();
  }
};

// HSN codes (set per product in admin) for the old and the replacement item of an exchange.
const exchangeHsnCodes = async (exchange) => {
  const items = [exchange.originalItem, exchange.requestedVariant].filter(i => i && i.productId);
  return (await loadShippingDetails(items)).hsnByProductId;
};

// Assigns the AWB for one exchange leg. Shiprocket reports most failures (e.g. a low wallet
// balance) inside a normal reply, so a missing awb_code is recorded as a shipment error that
// admin can see, instead of being silently ignored.
const assignExchangeLegAwb = async (exchange, leg, shipmentId) => {
  let error = null;
  try {
    const awbResp = await shiprocketService.assignAWB(shipmentId);
    const awbData = awbResp?.response?.data;
    if (awbData?.awb_code) {
      exchange[leg].awb = awbData.awb_code;
      exchange[leg].trackingUrl = `https://shiprocket.co/tracking/${awbData.awb_code}`;
      exchange[leg].status = 'AWB Assigned';
      if (leg === 'reverse' || !exchange.courierName) exchange.courierName = awbData.courier_name || null;
      return;
    }
    error = awbData?.awb_assign_error || awbResp?.message || 'Shiprocket did not assign an AWB';
  } catch (awbErr) {
    error = awbErr.response?.data?.message || awbErr.message;
  }
  console.error(`Exchange ${leg} AWB assignment failed:`, error);
  exchange.shipmentErrors.push({ leg, error: `AWB not assigned: ${error}. Assign it from the Shiprocket panel.`, timestamp: new Date() });
};

// Builds the Shiprocket reverse-shipment payload (pickup of the old item). Priced at the
// original item's value, since that's what's being returned.
const buildReversePayload = (exchange, originalOrder, cityState, hsnByProductId = {}) => ({
  order_id: `EXC_REV_${exchange._id.toString()}`,
  order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
  channel_id: '',
  pickup_customer_name: originalOrder.deliveryAddress.name || originalOrder.userId?.name || 'Customer',
  pickup_last_name: '',
  pickup_address: originalOrder.deliveryAddress.address,
  pickup_address_2: '',
  pickup_city: cityState.city,
  pickup_state: cityState.state,
  pickup_country: 'India',
  pickup_pincode: originalOrder.deliveryAddress.pincode,
  pickup_email: originalOrder.userId?.email || 'customer@aramish.com',
  pickup_phone: originalOrder.deliveryAddress.phone || originalOrder.userId?.phone || '9999999999',
  shipping_customer_name: process.env.RETURN_SHIPPING_NAME || 'Aramish Warehouse',
  shipping_last_name: '',
  shipping_address: process.env.RETURN_SHIPPING_ADDRESS || 'Warehouse 12, Sector 63',
  shipping_address_2: '',
  shipping_city: process.env.RETURN_SHIPPING_CITY || 'Noida',
  shipping_state: process.env.RETURN_SHIPPING_STATE || 'Uttar Pradesh',
  shipping_country: 'India',
  shipping_pincode: process.env.SHIPROCKET_PICKUP_PINCODE || '201301',
  shipping_phone: process.env.RETURN_SHIPPING_PHONE || '9876543210',
  shipping_email: process.env.RETURN_SHIPPING_EMAIL || 'warehouse@aramish.com',
  order_items: [toOrderItem({
    name: exchange.originalItem.name,
    sku: exchange.originalItem.variationSku || exchange.originalItem.productId.toString(),
    units: 1,
    price: exchange.originalItem.price,
    productId: exchange.originalItem.productId
  }, hsnByProductId)],
  payment_method: 'Prepaid',
  sub_total: exchange.originalItem.price,
  length: 10, breadth: 10, height: 10, weight: 0.5
});

// Builds the Shiprocket forward-shipment payload (delivery of the replacement). Priced at the
// replacement's actual value. If the price difference is being collected via COD, the courier
// collects only that delta on delivery — the item itself was already paid for as part of the
// original order plus (if Online) the difference charge.
const buildForwardPayload = (exchange, originalOrder, cityState, hsnByProductId = {}) => {
  const isCodDifference = exchange.paymentMethod === 'COD' && exchange.additionalAmount > 0;
  return {
    order_id: `EXC_FWD_${exchange._id.toString()}`,
    order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    billing_customer_name: originalOrder.deliveryAddress.name || originalOrder.userId?.name || 'Customer',
    billing_last_name: '',
    billing_address: originalOrder.deliveryAddress.address,
    billing_address_2: '',
    billing_city: cityState.city,
    billing_pincode: originalOrder.deliveryAddress.pincode,
    billing_state: cityState.state,
    billing_country: 'India',
    billing_email: originalOrder.userId?.email || 'customer@aramish.com',
    billing_phone: originalOrder.deliveryAddress.phone || originalOrder.userId?.phone || '9999999999',
    shipping_is_billing: true,
    shipping_customer_name: originalOrder.deliveryAddress.name || originalOrder.userId?.name || 'Customer',
    shipping_last_name: '',
    shipping_address: originalOrder.deliveryAddress.address,
    shipping_address_2: '',
    shipping_city: cityState.city,
    shipping_pincode: originalOrder.deliveryAddress.pincode,
    shipping_state: cityState.state,
    shipping_country: 'India',
    shipping_email: originalOrder.userId?.email || 'customer@aramish.com',
    shipping_phone: originalOrder.deliveryAddress.phone || originalOrder.userId?.phone || '9999999999',
    order_items: [toOrderItem({
      name: `${exchange.requestedVariant.name || exchange.originalItem.name} (${exchange.requestedVariant.color}/${exchange.requestedVariant.size})`,
      sku: exchange.requestedVariant.sku,
      units: 1,
      price: exchange.requestedVariant.price,
      productId: exchange.requestedVariant.productId || exchange.originalItem.productId
    }, hsnByProductId)],
    payment_method: isCodDifference ? 'COD' : 'Prepaid',
    sub_total: isCodDifference ? exchange.additionalAmount : exchange.requestedVariant.price,
    length: 10, breadth: 10, height: 10, weight: 0.5
  };
};

// ─── User: Create Exchange Request ───────────────────────────────────────────

exports.createExchangeRequest = async (req, res) => {
  try {
    const { orderId, originalItem, requestedVariant, reason, comments, images } = req.body;

    let parsedOriginalItem = originalItem;
    if (typeof originalItem === 'string') {
      try {
        parsedOriginalItem = JSON.parse(originalItem);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid originalItem format' });
      }
    }

    let parsedRequestedVariant = requestedVariant;
    if (typeof requestedVariant === 'string') {
      try {
        parsedRequestedVariant = JSON.parse(requestedVariant);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid requestedVariant format' });
      }
    }

    if (!orderId || !parsedOriginalItem || !parsedRequestedVariant || !reason) {
      return res.status(400).json({ success: false, message: 'orderId, originalItem, requestedVariant, and reason are required' });
    }

    let imagePaths = [];
    if (req.processedFiles && req.processedFiles.length > 0) {
      imagePaths = req.processedFiles.map(f => f.url);
    } else if (images) {
      imagePaths = Array.isArray(images) ? images : (typeof images === 'string' ? JSON.parse(images) : []);
    }

    if (!imagePaths || imagePaths.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product image is required for exchange request' });
    }
    if (imagePaths.length > 3) {
      return res.status(400).json({ success: false, message: 'You can upload a maximum of 3 product images' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be exchanged' });
    }

    // Exchange window check
    const config = await SystemConfig.findOne();
    const windowDays = (config && config.returnWindowDays !== undefined) ? config.returnWindowDays : 7;
    const daysDiff = (new Date() - new Date(getDeliveredAt(order))) / (1000 * 60 * 60 * 24);
    if (daysDiff > windowDays) {
      return res.status(400).json({ success: false, message: `Exchange window of ${windowDays} days has expired` });
    }

    // Duplicate active exchange check
    const existingExchange = await ExchangeRequest.findOne({
      orderId,
      status: { $nin: ['Rejected', 'Cancelled', 'Failed'] }
    });
    if (existingExchange) {
      return res.status(400).json({ success: false, message: 'An active exchange request already exists for this order' });
    }

    // Validate original item belongs to the order
    const orderItem = order.items.find(i =>
      i.productId.toString() === parsedOriginalItem.productId &&
      (parsedOriginalItem.variationSku ? i.variationSku === parsedOriginalItem.variationSku : true)
    );
    if (!orderItem) {
      return res.status(400).json({ success: false, message: 'Original item not found in this order' });
    }

    // Fetch product to validate requested variant (may be any eligible product in the catalog,
    // not just the original product — falls back to the original product only when the caller
    // didn't specify one, e.g. a same-product variant swap).
    const requestedProductId = parsedRequestedVariant.productId || parsedOriginalItem.productId;
    const product = await Product.findById(requestedProductId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (product.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'This product is not eligible for exchange' });
    }

    const reqVariant = product.variations.find(v => v.sku === parsedRequestedVariant.sku);
    if (!reqVariant) {
      return res.status(400).json({ success: false, message: 'Requested variant not found' });
    }

    // Same item validation — must differ by product or variant from what's already owned
    if (requestedProductId.toString() === parsedOriginalItem.productId.toString() &&
        parsedOriginalItem.variationSku && reqVariant.sku === parsedOriginalItem.variationSku) {
      return res.status(400).json({ success: false, message: 'Requested item must be different from the current item' });
    }

    if (reqVariant.stock <= 0) {
      return res.status(400).json({ success: false, message: 'Requested variant is out of stock' });
    }

    // Price comparison — replacement must be equal to or higher in value than the original item
    const replacementPrice = resolveVariantPrice(product, reqVariant);
    const priceDifference = replacementPrice - orderItem.price;

    if (priceDifference < 0) {
      return res.status(400).json({
        success: false,
        message: 'Replacement product value must be equal to or higher than the original product value. Please choose a product of equal or greater value.'
      });
    }

    // Collect the price difference, if any, before the request is created
    let paymentStatus = 'Not Required';
    let resolvedPaymentMethod = null;
    let resolvedPaymentId = null;

    if (priceDifference > 0) {
      const { paymentMethod: difPaymentMethod, paymentId: difPaymentId } = req.body;
      if (!['COD', 'Online'].includes(difPaymentMethod)) {
        return res.status(400).json({ success: false, message: 'A payment method (COD or Online) is required to pay the price difference' });
      }

      resolvedPaymentMethod = difPaymentMethod;

      if (difPaymentMethod === 'Online') {
        if (!difPaymentId) {
          return res.status(400).json({ success: false, message: 'paymentId is required for Online payment of the price difference' });
        }
        // A captured payment can only pay for one thing (an order or one exchange).
        if (await ExchangeRequest.exists({ paymentId: difPaymentId }) || await Order.exists({ paymentId: difPaymentId })) {
          return res.status(400).json({ success: false, message: 'This payment has already been used.' });
        }
        await verifyRazorpayPayment(difPaymentId, priceDifference);
        resolvedPaymentId = difPaymentId;
        paymentStatus = 'Collected';
      } else {
        // COD: collected by the courier when the replacement is delivered
        paymentStatus = 'Pending';
      }
    }

    const exchange = await ExchangeRequest.create({
      orderId,
      userId:  req.user._id,
      originalItem: {
        productId:    orderItem.productId,
        variationSku: orderItem.variationSku || null,
        name:         orderItem.name,
        price:        orderItem.price,
        quantity:     1,
        image:        orderItem.image || '',
        color:        orderItem.attributes?.get?.('color') || parsedOriginalItem.color || '',
        size:         orderItem.attributes?.get?.('size') || parsedOriginalItem.size || ''
      },
      requestedVariant: {
        productId: product._id,
        name:      product.name,
        color:     reqVariant.color,
        size:      reqVariant.size,
        sku:       reqVariant.sku,
        image:     (reqVariant.images && reqVariant.images[0]) || (product.images && product.images[0]) || '',
        price:     replacementPrice
      },
      priceDifference,
      additionalAmount: Math.max(0, priceDifference),
      paymentStatus,
      paymentMethod: resolvedPaymentMethod,
      paymentId: resolvedPaymentId,
      reason,
      comments: comments || '',
      images:   imagePaths,
      status:   'Requested'
    });

    // Add initial timeline entry
    addTimeline(exchange, 'Requested', 'customer', req.user._id, 'Exchange request submitted');
    await exchange.save();

    // Update order status
    order.status = 'Exchange Requested';
    await order.save();

    res.status(201).json({ success: true, message: 'Exchange request submitted', exchangeRequest: exchange });
  } catch (error) {
    console.error('createExchangeRequest error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── User: Get My Exchanges ───────────────────────────────────────────────────

exports.getUserExchanges = async (req, res) => {
  try {
    const exchanges = await ExchangeRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-webhookHistory -auditLog');
    res.json({ success: true, exchanges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── User: Get Exchange by Order ID ──────────────────────────────────────────

exports.getExchangeByOrderId = async (req, res) => {
  try {
    const exchange = await ExchangeRequest.findOne({
      orderId: req.params.orderId,
      userId: req.user._id
    })
    .sort({ createdAt: -1 })
    .select('-webhookHistory -auditLog');
    res.json({ success: true, exchangeRequest: exchange || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Admin: Get All Exchanges ─────────────────────────────────────────────────

exports.getAllExchanges = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;

    const total = await ExchangeRequest.countDocuments(filter);
    const exchanges = await ExchangeRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'name email phone')
      .populate('orderId')
      .select('-webhookHistory');

    res.json({ success: true, total, page: parseInt(page), exchanges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Admin: Get Exchange By ID ────────────────────────────────────────────────

exports.getExchangeById = async (req, res) => {
  try {
    const exchange = await ExchangeRequest.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('orderId');
    if (!exchange) return res.status(404).json({ success: false, message: 'Exchange not found' });
    res.json({ success: true, exchange });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Admin: Get Exchange Stats ────────────────────────────────────────────────

exports.getExchangeStats = async (req, res) => {
  try {
    const [statusCounts, reasonCounts] = await Promise.all([
      ExchangeRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ExchangeRequest.aggregate([{ $group: { _id: '$reason', count: { $sum: 1 } } }])
    ]);
    const total = await ExchangeRequest.countDocuments();
    const completed = await ExchangeRequest.countDocuments({ status: 'Completed' });
    const failed = await ExchangeRequest.countDocuments({ status: { $in: ['Failed', 'Cancelled', 'Rejected'] } });

    res.json({
      success: true,
      stats: {
        total,
        successRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
        failureRate: total > 0 ? ((failed / total) * 100).toFixed(1) : 0,
        byStatus: statusCounts,
        byReason: reasonCounts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Admin: Update Exchange Status (Core State Machine) ───────────────────────

exports.updateExchangeStatus = async (req, res) => {
  try {
    const { status, adminNotes, rejectionReason } = req.body;
    const admin = req.admin || req.user;

    const exchange = await ExchangeRequest.findById(req.params.id);
    if (!exchange) return res.status(404).json({ success: false, message: 'Exchange not found' });

    const order = await Order.findById(exchange.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const fromStatus = exchange.status;

    const allowed = EXCHANGE_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move exchange from '${fromStatus}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`
      });
    }
    // Defensive gate: an exchange should never reach Approve with an uncollected
    // online price-difference payment (guards against races/manual API calls).
    if (status === 'Approved' && exchange.additionalAmount > 0 && exchange.paymentMethod === 'Online' && exchange.paymentStatus !== 'Collected') {
      return res.status(400).json({ success: false, message: 'Price difference payment has not been completed for this exchange.' });
    }
    if (status === 'Rejected' && !rejectionReason) {
      return res.status(400).json({ success: false, message: 'rejectionReason is mandatory when rejecting an exchange' });
    }
    if (status === 'Cancelled' && !adminNotes) {
      return res.status(400).json({ success: false, message: 'adminNotes is mandatory when cancelling an exchange' });
    }

    // Claim the transition before any stock side effect, so a double-click or a webhook racing
    // this request can't reserve/release/restock twice.
    if (!(await claimExchangeStatus(exchange._id, fromStatus, status))) {
      return res.status(409).json({ success: false, message: 'This exchange was updated by another process. Please refresh and try again.' });
    }
    const releaseClaim = () => ExchangeRequest.updateOne({ _id: exchange._id, status }, { $set: { status: fromStatus } });

    try {
      // ── APPROVE ──────────────────────────────────────────────────────────────
      if (status === 'Approved') {
        if (adminNotes) exchange.adminNotes = adminNotes;

        // Hard stock check with atomic reservation
        const reservationResult = await Product.findOneAndUpdate(
          {
            _id: exchange.requestedVariant.productId,
            variations: {
              $elemMatch: { sku: exchange.requestedVariant.sku, stock: { $gt: 0 } }
            }
          },
          { $inc: { 'variations.$.stock': -1, stock: -1 } },
          { new: true }
        );

        if (!reservationResult) {
          await releaseClaim();
          return res.status(400).json({
            success: false,
            message: `Requested variant (${exchange.requestedVariant.color} / ${exchange.requestedVariant.size}) is out of stock. Cannot approve exchange.`
          });
        }

        // Record reservation
        exchange.inventoryReservation = {
          variantSku: exchange.requestedVariant.sku,
          productId: exchange.requestedVariant.productId,
          quantity: 1,
          reservedAt: new Date(),
          released: false,
          releasedAt: null
        };

        const originalOrder = await Order.findById(exchange.orderId).populate('userId');
        const cityState = shiprocketService.parseCityState(originalOrder.deliveryAddress.address);

        // ── Create Reverse Shipment (pickup old item) ──────────────────────────
        try {
          const reversePayload = buildReversePayload(exchange, originalOrder, cityState, await exchangeHsnCodes(exchange));

          const reverseResp = await shiprocketService.createShiprocketReturnOrder(reversePayload);
          exchange.reverse = {
            orderId: reverseResp?.order_id ? String(reverseResp.order_id) : null,
            shipmentId: reverseResp?.shipment_id ? String(reverseResp.shipment_id) : null,
            awb: null,
            trackingUrl: null,
            status: 'Created',
            failed: false,
            response: reverseResp
          };

          if (reverseResp?.shipment_id) {
            await assignExchangeLegAwb(exchange, 'reverse', reverseResp.shipment_id);
          }
        } catch (reverseErr) {
          console.error('Exchange reverse shipment creation failed:', reverseErr.message);
          exchange.reverse = { status: 'Failed', failed: true };
          exchange.shipmentErrors.push({
            leg: 'reverse',
            error: reverseErr.message,
            timestamp: new Date()
          });
          exchange.lastError = reverseErr.message;
          addTimeline(exchange, 'Requested', 'system', null, 'Reverse shipment creation failed: ' + reverseErr.message);
        }

        // ── Create Forward Shipment (deliver replacement) ──────────────────────
        try {
          const forwardPayload = buildForwardPayload(exchange, originalOrder, cityState, await exchangeHsnCodes(exchange));

          const forwardResp = await shiprocketService.createExchangeForwardOrder(forwardPayload);
          exchange.forward = {
            orderId: forwardResp?.order_id ? String(forwardResp.order_id) : null,
            shipmentId: forwardResp?.shipment_id ? String(forwardResp.shipment_id) : null,
            awb: null,
            trackingUrl: null,
            status: 'Created',
            failed: false,
            response: forwardResp
          };

          if (forwardResp?.shipment_id) {
            await assignExchangeLegAwb(exchange, 'forward', forwardResp.shipment_id);
          }
        } catch (forwardErr) {
          console.error('Exchange forward shipment creation failed:', forwardErr.message);
          exchange.forward = { status: 'Failed', failed: true };
          exchange.shipmentErrors.push({
            leg: 'forward',
            error: forwardErr.message,
            timestamp: new Date()
          });
          exchange.lastError = forwardErr.message;
          addTimeline(exchange, 'Requested', 'system', null, 'Forward shipment creation failed: ' + forwardErr.message);
        }

        exchange.status = 'Approved';
        order.status = 'Exchange Approved';
        addTimeline(exchange, 'Approved', 'admin', admin?._id, 'Exchange approved by admin. Shipment creation attempted.');
        addAudit(exchange, 'approved', admin, fromStatus, 'Approved', adminNotes || '');
      }

      // ── REJECT ────────────────────────────────────────────────────────────────
      else if (status === 'Rejected') {
        await refundExchangeDifference(exchange);
        exchange.status = 'Rejected';
        exchange.rejectionReason = rejectionReason;
        if (adminNotes) exchange.adminNotes = adminNotes;
        order.status = 'Delivered';  // Revert
        addTimeline(exchange, 'Rejected', 'admin', admin?._id, rejectionReason);
        addAudit(exchange, 'rejected', admin, fromStatus, 'Rejected', rejectionReason);
      }

      // ── CANCEL ────────────────────────────────────────────────────────────────
      else if (status === 'Cancelled') {
        await refundExchangeDifference(exchange);
        await releaseReservedStock(exchange);
        exchange.status = 'Cancelled';
        exchange.adminNotes = adminNotes;
        order.status = 'Exchange Cancelled';
        addTimeline(exchange, 'Cancelled', 'admin', admin?._id, adminNotes);
        addAudit(exchange, 'cancelled', admin, fromStatus, 'Cancelled', adminNotes);
      }

      // ── COMPLETED ─────────────────────────────────────────────────────────────
      else if (status === 'Completed') {
        await restockOriginalItem(exchange);
        exchange.status = 'Completed';
        order.status = 'Exchange Completed';
        addTimeline(exchange, 'Completed', 'admin', admin?._id, adminNotes || 'Exchange completed');
        addAudit(exchange, 'completed', admin, fromStatus, 'Completed', adminNotes || '');
      }

      // ── FAILED ────────────────────────────────────────────────────────────────
      else if (status === 'Failed') {
        await refundExchangeDifference(exchange);
        await releaseReservedStock(exchange);
        exchange.status = 'Failed';
        if (adminNotes) exchange.adminNotes = adminNotes;
        order.status = 'Delivered';
        addTimeline(exchange, 'Failed', 'admin', admin?._id, adminNotes || '');
        addAudit(exchange, 'failed', admin, fromStatus, 'Failed', adminNotes || '');
      }

      // ── MANUAL REVIEW ─────────────────────────────────────────────────────────
      else if (status === 'Manual Review') {
        exchange.status = 'Manual Review';
        if (adminNotes) exchange.adminNotes = adminNotes;
        order.status = 'Manual Review';
        addTimeline(exchange, 'Manual Review', 'admin', admin?._id, adminNotes || '');
        addAudit(exchange, 'manual_review', admin, fromStatus, 'Manual Review', adminNotes || '');
      }

      // ── INTERMEDIATE STATUSES (set by admin/webhook) ───────────────────────────
      else if (['Pickup Scheduled', 'Old Item Picked Up', 'Replacement Dispatched'].includes(status)) {
        exchange.status = status;
        order.status = status;
        addTimeline(exchange, status, 'admin', admin?._id, adminNotes || '');
        addAudit(exchange, 'status_updated', admin, fromStatus, status, adminNotes || '');
      }

      else {
        await releaseClaim();
        return res.status(400).json({ success: false, message: `Invalid status transition: ${status}` });
      }

      await exchange.save();
      await order.save();
    } catch (sideEffectErr) {
      await releaseClaim();
      throw sideEffectErr;
    }

    res.json({ success: true, message: `Exchange status updated to ${exchange.status}`, exchange });
  } catch (error) {
    console.error('updateExchangeStatus error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Webhook Handler ──────────────────────────────────────────────────────────

exports.handleExchangeWebhook = async (req, res) => {
  try {
    const authError = verifyWebhookToken(req);
    if (authError) {
      return res.status(authError.status).json({ success: false, message: authError.message });
    }

    const payload = req.body;
    const rawOrderId = payload.order_id || payload.channel_order_id || payload.awb || '';

    // Determine leg
    let leg = null;
    let exchangeId = null;

    if (String(rawOrderId).startsWith('EXC_FWD_')) {
      leg = 'forward';
      exchangeId = String(rawOrderId).replace('EXC_FWD_', '');
    } else if (String(rawOrderId).startsWith('EXC_REV_')) {
      leg = 'reverse';
      exchangeId = String(rawOrderId).replace('EXC_REV_', '');
    } else {
      return res.status(200).json({ success: true, message: 'Not an exchange webhook, skipped' });
    }

    if (!mongoose.Types.ObjectId.isValid(exchangeId)) {
      return res.status(200).json({ success: true, message: 'Exchange not found, skipped' });
    }
    const exchange = await ExchangeRequest.findById(exchangeId);
    if (!exchange) return res.status(200).json({ success: true, message: 'Exchange not found, skipped' });

    const rawStatus = String(payload.current_status || payload.status || '').trim();
    // Shiprocket sends statuses upper-cased ("DELIVERED"); the map is keyed in title case.
    const legMap = EXCHANGE_WEBHOOK_MAP[leg] || {};
    const mapKey = Object.keys(legMap).find(k => k.toUpperCase() === rawStatus.toUpperCase().replace(/_/g, ' '));
    const mapped = mapKey ? legMap[mapKey] : null;

    // Append to webhook history
    exchange.webhookHistory.push({
      leg,
      rawStatus,
      mapped: mapped || 'unknown',
      timestamp: new Date(),
      location: payload.current_status_info?.location || '',
      remarks: payload.current_status_info?.remark || ''
    });

    // Update leg status
    exchange[leg].status = rawStatus;

    const order = await Order.findById(exchange.orderId);

    // A single failed leg needs a human; only both legs failing is a full failure.
    let target = mapped;
    if (mapped === 'Failed') {
      exchange[leg].failed = true;
      target = (exchange.reverse.failed && exchange.forward.failed) ? 'Failed' : 'Manual Review';
    }

    const fromStatus = exchange.status;
    if (target && target !== fromStatus && (EXCHANGE_TRANSITIONS[fromStatus] || []).includes(target)) {
      // Same claim as the admin endpoint: duplicate/out-of-order webhooks can't restock twice.
      if (await claimExchangeStatus(exchange._id, fromStatus, target)) {
        if (target === 'Completed') {
          await restockOriginalItem(exchange);
          if (order) order.status = 'Exchange Completed';
        } else if (target === 'Failed') {
          try {
            await refundExchangeDifference(exchange);
          } catch (refundErr) {
            // Leave it for an admin: back out of 'Failed' so the admin "Failed" action (which
            // refunds and releases stock) is still available.
            await ExchangeRequest.updateOne({ _id: exchange._id, status: target }, { $set: { status: fromStatus } });
            throw refundErr;
          }
          await releaseReservedStock(exchange);
          if (order) order.status = 'Delivered';
        } else if (order) {
          order.status = target;
        }
        exchange.status = target;
        addTimeline(exchange, exchange.status, 'webhook', null, `Shiprocket: ${rawStatus}`);
      }
    }

    await exchange.save();
    if (order) await order.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('handleExchangeWebhook error:', error);
    res.status(200).json({ success: true }); // Always 200 to Shiprocket
  }
};

// ── PUT: Update Exchange Address ──────────────────────────────────────────────
exports.updateExchangeAddress = async (req, res) => {
  try {
    const { name, address, pincode, phone, city, state } = req.body;
    
    // Validations
    if (!name || !address || !pincode || !phone || !city || !state) {
      return res.status(400).json({ success: false, message: 'All address fields (name, address, pincode, phone, city, state) are required' });
    }
    if (!/^\d{6}$/.test(String(pincode).trim())) {
      return res.status(400).json({ success: false, message: 'Pincode must be exactly 6 digits' });
    }
    if (!/^\d{10}$/.test(String(phone).trim())) {
      return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits' });
    }

    const exchange = await ExchangeRequest.findById(req.params.id);
    if (!exchange) return res.status(404).json({ success: false, message: 'Exchange request not found' });

    const order = await Order.findById(exchange.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const combinedAddress = `${address.trim()}, ${city.trim()}, ${state.trim()} - ${pincode.trim()}`;
    order.deliveryAddress = {
      name: name.trim(),
      type: order.deliveryAddress?.type || 'Home',
      address: combinedAddress,
      pincode: pincode.trim(),
      phone: phone.trim()
    };
    await order.save();

    const admin = req.admin || req.user;
    addTimeline(exchange, exchange.status, 'admin', admin?._id, `Address updated by admin: ${name.trim()}, ${phone.trim()}, ${pincode.trim()}`);
    addAudit(exchange, 'address_updated', admin, exchange.status, exchange.status, `Updated address to: ${combinedAddress}`);
    await exchange.save();

    res.json({ success: true, message: 'Address updated successfully', exchange });
  } catch (error) {
    console.error('updateExchangeAddress error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST: Retry Exchange Shipment ─────────────────────────────────────────────
exports.retryExchangeShipment = async (req, res) => {
  try {
    const { leg } = req.body; // 'reverse' or 'forward'
    if (!['reverse', 'forward'].includes(leg)) {
      return res.status(400).json({ success: false, message: 'Invalid leg specified. Must be reverse or forward.' });
    }

    // Atomic fetch & lock check
    let exchange = await ExchangeRequest.findById(req.params.id);
    if (!exchange) return res.status(404).json({ success: false, message: 'Exchange request not found' });

    if (exchange.shipmentRetryInProgress) {
      return res.status(409).json({ success: false, message: 'A retry attempt is already in progress for this exchange.' });
    }

    // Lock the document
    exchange.shipmentRetryInProgress = true;
    await exchange.save();

    const admin = req.admin || req.user;

    try {
      if (exchange.retryCount >= 3) {
        exchange.status = 'Manual Review';
        addTimeline(exchange, 'Manual Review', 'system', null, 'Maximum retry limit (3) exceeded. Moved to Manual Review.');
        addAudit(exchange, 'status_updated', admin, exchange.status, 'Manual Review', 'Retry limit exceeded');
        exchange.shipmentRetryInProgress = false;
        await exchange.save();
        return res.status(400).json({ success: false, message: 'Maximum retry limit (3) exceeded. Exchange moved to Manual Review.', exchange });
      }

      // Check if leg has already succeeded
      if (exchange[leg] && exchange[leg].status && exchange[leg].status !== 'Failed' && exchange[leg].status !== 'Pending') {
        exchange.shipmentRetryInProgress = false;
        await exchange.save();
        return res.status(400).json({ success: false, message: `Shipment for ${leg} leg is already in status: ${exchange[leg].status}. Cannot retry.`, exchange });
      }

      const originalOrder = await Order.findById(exchange.orderId).populate('userId');
      if (!originalOrder) {
        throw new Error('Order not found');
      }

      const cityState = shiprocketService.parseCityState(originalOrder.deliveryAddress.address);

      if (leg === 'reverse') {
        // Create Reverse Shipment
        const reversePayload = buildReversePayload(exchange, originalOrder, cityState, await exchangeHsnCodes(exchange));

        const reverseResp = await shiprocketService.createShiprocketReturnOrder(reversePayload);
        exchange.reverse = {
          orderId: reverseResp?.order_id ? String(reverseResp.order_id) : null,
          shipmentId: reverseResp?.shipment_id ? String(reverseResp.shipment_id) : null,
          awb: null,
          trackingUrl: null,
          status: 'Created',
          failed: false,
          response: reverseResp
        };

        if (reverseResp?.shipment_id) {
          await assignExchangeLegAwb(exchange, 'reverse', reverseResp.shipment_id);
        }
      } else {
        // Create Forward Shipment
        const forwardPayload = buildForwardPayload(exchange, originalOrder, cityState, await exchangeHsnCodes(exchange));

        const forwardResp = await shiprocketService.createExchangeForwardOrder(forwardPayload);
        exchange.forward = {
          orderId: forwardResp?.order_id ? String(forwardResp.order_id) : null,
          shipmentId: forwardResp?.shipment_id ? String(forwardResp.shipment_id) : null,
          awb: null,
          trackingUrl: null,
          status: 'Created',
          failed: false,
          response: forwardResp
        };

        if (forwardResp?.shipment_id) {
          await assignExchangeLegAwb(exchange, 'forward', forwardResp.shipment_id);
        }
      }

      // Success cleanup
      exchange.lastRetryAt = new Date();
      exchange.lastError = '';
      addTimeline(exchange, exchange.status, 'admin', admin?._id, `Retry successful for ${leg} leg.`);
      addAudit(exchange, 'shipment_retry', admin, exchange.status, exchange.status, `Retry successful for ${leg} leg.`);
      exchange.shipmentRetryInProgress = false;
      await exchange.save();

      // Trigger user notification (mock or trigger email/SMS as required)
      console.log(`Notification: Shipment for ${leg} leg of Exchange ${exchange._id} has been successfully created. Tracking URL: ${exchange[leg].trackingUrl}`);

      res.json({ success: true, message: `Shipment successfully created for ${leg} leg`, exchange });
    } catch (err) {
      console.error(`Retry shipment failed for ${leg} leg:`, err.message);
      
      exchange.retryCount += 1;
      exchange.lastRetryAt = new Date();
      exchange.lastError = err.message;
      exchange.shipmentErrors.push({
        leg,
        error: err.message,
        timestamp: new Date()
      });
      exchange[leg].status = 'Failed';
      exchange[leg].failed = true;

      addTimeline(exchange, exchange.status, 'system', null, `Retry failed for ${leg} leg: ${err.message}`);
      addAudit(exchange, 'shipment_retry_failed', admin, exchange.status, exchange.status, `Retry failed for ${leg} leg. Error: ${err.message}`);

      if (exchange.retryCount >= 3) {
        exchange.status = 'Manual Review';
        addTimeline(exchange, 'Manual Review', 'system', null, 'Maximum retry limit (3) exceeded. Moved to Manual Review.');
        addAudit(exchange, 'status_updated', admin, exchange.status, 'Manual Review', 'Retry limit exceeded');
      }

      exchange.shipmentRetryInProgress = false;
      await exchange.save();

      res.status(502).json({ success: false, message: `Failed to create shipment: ${err.message}`, exchange });
    }
  } catch (error) {
    console.error('retryExchangeShipment outer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
