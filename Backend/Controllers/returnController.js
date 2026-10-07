const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const shiprocketService = require('../Router/shiprocketService');
const { loadShippingDetails, toOrderItem, toShiprocketDate, getReturnWarehouse, fallbackEmail, FALLBACK_PHONE } = require('../utils/shiprocketPayload');
const { handleReturnRefund, getDeliveredAt } = require('../utils/orderHelper');
const { srErrorMessage, readAwbResult, requestPickupChecked, PICKUP_BOOKED_OR_LATER } = require('../utils/shiprocketResults');

// Builds the Shiprocket reverse-pickup order and attempts AWB assignment for a return
// request, mutating the passed returnRequest document's shipment fields in place. Used both
// on initial 'Approved' transition and by the admin retry endpoint below, so a Shiprocket
// outage on approval doesn't leave the return stuck with no way to (re)try the pickup.
// Throws on failure — callers are responsible for recording the failure/retry state.
const createReturnShipment = async (returnRequest, order) => {
  // Fails clearly (admin sees it and can retry) instead of sending the parcel to a made-up address.
  const warehouse = getReturnWarehouse();
  const { weight: totalWeight, hsnByProductId } = await loadShippingDetails(returnRequest.items);

  const cityState = shiprocketService.parseCityState(order.deliveryAddress.address);

  // Declared value of the parcel = the returned items' value (what the courier carries and
  // insures), not the refund — the refund can be ₹0 when the order was paid with coins.
  const itemsValue = returnRequest.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1), 0);

  const returnPayload = {
    order_id: `RET_${returnRequest._id.toString()}`,
    order_date: toShiprocketDate(returnRequest.createdAt),
    channel_id: "",
    pickup_customer_name: order.deliveryAddress.name || order.userId?.name || "Customer",
    pickup_last_name: "",
    pickup_address: order.deliveryAddress.address,
    pickup_address_2: "",
    pickup_city: cityState.city,
    pickup_state: cityState.state,
    pickup_country: "India",
    pickup_pincode: order.deliveryAddress.pincode,
    pickup_email: order.userId?.email || fallbackEmail(),
    // The courier calls this number to collect the parcel — the address's contact, not the account's.
    pickup_phone: order.deliveryAddress.phone || order.userId?.phone || FALLBACK_PHONE,
    shipping_customer_name: warehouse.name,
    shipping_last_name: "",
    shipping_address: warehouse.address,
    shipping_address_2: warehouse.address_2,
    shipping_city: warehouse.city,
    shipping_state: warehouse.state,
    shipping_country: "India",
    shipping_pincode: warehouse.pincode,
    shipping_phone: warehouse.phone,
    shipping_email: warehouse.email,
    order_items: returnRequest.items.map(item => toOrderItem({
      name: item.name,
      sku: item.productId ? item.productId.toString() : "PRODUCT",
      units: item.quantity,
      price: item.price,
      productId: item.productId
    }, hsnByProductId)),
    payment_method: "Prepaid",
    sub_total: Math.round(itemsValue * 100) / 100 || returnRequest.refundAmount,
    length: 10,
    breadth: 10,
    height: 10,
    weight: totalWeight || 0.5
  };

  const srResponse = await shiprocketService.createShiprocketReturnOrder(returnPayload);
  if (!srResponse || !srResponse.order_id) {
    throw new Error('Shiprocket did not return an order_id for the return pickup shipment');
  }

  returnRequest.shiprocketReturnOrderId = srResponse.order_id;
  returnRequest.shiprocketReturnShipmentId = srResponse.shipment_id;
  returnRequest.shipmentStatus = 'Created';

  if (srResponse.shipment_id) {
    await bookReturnPickup(returnRequest);
  }
};

// Books the courier for a return whose Shiprocket return order already exists. Shiprocket does
// not do this by itself: the AWB (courier) is assigned first, then the pickup from the customer
// is requested — without the second call no courier ever comes. Each step is skipped when it
// is already done, so "Retry" from admin simply continues from wherever it stopped (it never
// re-creates the return order). A failure is recorded for admin and returns false.
const bookReturnPickup = async (returnRequest) => {
  const fail = (message) => {
    console.error('Return pickup not booked:', message);
    returnRequest.shipmentErrors.push({ error: message, timestamp: new Date() });
    return false;
  };

  if (!returnRequest.awbCode) {
    let awbResponse;
    try {
      awbResponse = await shiprocketService.assignAWB(returnRequest.shiprocketReturnShipmentId, null, { isReturn: true });
    } catch (awbErr) {
      return fail(`Return pickup AWB not assigned: ${srErrorMessage(awbErr)}`);
    }
    const { awbInfo, error } = readAwbResult(awbResponse);
    if (error) return fail(`Return pickup AWB not assigned: ${error}`);
    returnRequest.awbCode = awbInfo.awb_code;
    returnRequest.courierName = awbInfo.courier_name;
  }

  if (!returnRequest.pickupScheduled) {
    const { scheduled, error } = await requestPickupChecked(shiprocketService, returnRequest.shiprocketReturnShipmentId);
    if (!scheduled) return fail(`Courier assigned (AWB ${returnRequest.awbCode}) but pickup not scheduled: ${error}`);
    returnRequest.pickupScheduled = true;
    if (returnRequest.status === 'Approved') returnRequest.status = 'Pick-up Scheduled';
  }
  return true;
};

// Most the customer can get back for `returnItems` (prices taken from the order, never from the
// request): the items' value, less their share of the coupon and prepaid discounts on a partial
// return; for a Wallet refund also their share of GST, plus delivery and platform fee on a full
// return. Never more than the money actually paid (cash/online + Refund Wallet) — coins redeemed
// on the order are non-returnable.
const calculateEligibleRefund = (order, returnItems, refundMethod) => {
  const itemsValue = returnItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  // Return lines saved before they recorded a variant match their order line by product alone.
  const returnedQty = (orderItem) => returnItems
    .filter(r => String(r.productId) === String(orderItem.productId) &&
      (!r.variationSku || r.variationSku === orderItem.variationSku))
    .reduce((sum, r) => sum + r.quantity, 0);
  const isFullReturn = order.items.every(orderItem => returnedQty(orderItem) === orderItem.quantity);

  let eligible = itemsValue;
  // Partial return: the order-level coupon and prepaid discounts were spread over every item, so
  // the returned items only give back their discounted share. (A full return is already bounded
  // by the money-paid cap below.)
  if (!isFullReturn && order.subtotal > 0) {
    const orderDiscounts = (order.discountAmount || 0) + (order.prepaidDiscount || 0);
    const discountShare = (itemsValue / order.subtotal) * orderDiscounts;
    eligible = Math.max(0, itemsValue - discountShare);
  }

  if (refundMethod === 'Wallet') {
    const proportionalGst = (order.subtotal && order.subtotal > 0) ? (itemsValue / order.subtotal) * (order.gstAmount || 0) : 0;
    eligible += proportionalGst;
    if (isFullReturn) {
      eligible += (order.deliveryCharge || 0) + (order.platformCommission || 0);
    }
  }
  const moneyPaid = (order.total || 0) + (order.refundWalletUsed || 0);
  return Math.round(Math.min(eligible, moneyPaid) * 100) / 100;
};

// @desc    Create a return request (User)
// @route   POST /returns
// @access  Private (User)
exports.createReturnRequest = async (req, res) => {
  try {
    const { orderId, items, reason, reasonDetails, images } = req.body;

    if (!orderId || !items || !reason) {
      return res.status(400).json({ success: false, message: 'orderId, items, and reason are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify ownership
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to return this order' });
    }

    // Only delivered orders can be returned
    if (order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
    }

    // Check return window
    const SystemConfig = require('../Models/SystemConfig');
    const config = await SystemConfig.findOne();
    const returnWindowDays = (config && config.returnWindowDays !== undefined) ? config.returnWindowDays : 7;
    
    const deliveryDate = getDeliveredAt(order);
    const timeDiff = new Date() - new Date(deliveryDate);
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff > returnWindowDays) {
      return res.status(400).json({ 
        success: false, 
        message: `The return window of ${returnWindowDays} days has expired for this order.` 
      });
    }

    if (order.paymentMethod === 'Online' && order.paymentStatus !== 'Paid') {
      return res.status(400).json({ success: false, message: 'Cannot request return for unpaid online order' });
    }

    // Check if a return request already exists for this order
    const existingReturn = await ReturnRequest.findOne({ orderId, status: { $nin: ['Rejected'] } });
    if (existingReturn) {
      return res.status(400).json({ success: false, message: 'A return request already exists for this order' });
    }

    let parsedItems = [];
    try {
      parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid items format' });
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Items list cannot be empty' });
    }

    // Validate return items and calculate refund amount securely (H-04 return amount security, M-13 return item validation)
    const validatedReturnItems = [];

    // Several lines of an order can share a productId (different sizes/colours), so each return
    // line is matched to an order line by variant too, and quantities are summed per order line
    // so duplicate return lines can't exceed what was bought.
    const returnedQtyByLine = new Map();
    for (const returnItem of parsedItems) {
      const qty = Number(returnItem.quantity);
      if (!returnItem.productId || !Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid product or quantity in return request' });
      }

      // Find item in original order
      const orderItem = order.items.find(item =>
        item.productId.toString() === returnItem.productId.toString() &&
        (returnItem.variationSku ? item.variationSku === returnItem.variationSku : true)
      );
      if (!orderItem) {
        return res.status(400).json({ success: false, message: `Item ${returnItem.productId} is not part of this order` });
      }

      // Check return quantity against ordered quantity
      const lineQty = (returnedQtyByLine.get(orderItem) || 0) + qty;
      if (lineQty > orderItem.quantity) {
        return res.status(400).json({ success: false, message: `Return quantity (${lineQty}) for "${orderItem.name}" exceeds ordered quantity (${orderItem.quantity})` });
      }
      returnedQtyByLine.set(orderItem, lineQty);

    }

    for (const [orderItem, quantity] of returnedQtyByLine) {
      validatedReturnItems.push({
        productId: orderItem.productId,
        variationSku: orderItem.variationSku || null,
        name: orderItem.name,
        price: orderItem.price,
        quantity,
        image: orderItem.image
      });
    }

    let parsedBankDetails = null;
    if (req.body.bankDetails) {
      try {
        parsedBankDetails = typeof req.body.bankDetails === 'string' ? JSON.parse(req.body.bankDetails) : req.body.bankDetails;
      } catch (e) {
        parsedBankDetails = null;
      }
    }

    const finalRefundMethod = req.body.refundMethod || (parsedBankDetails ? 'Bank' : 'Original');

    const refundAmount = calculateEligibleRefund(order, validatedReturnItems, finalRefundMethod);

    let imagePaths = [];
    if (req.processedFiles && req.processedFiles.length > 0) {
      imagePaths = req.processedFiles.map(f => f.url);
    } else if (req.files && req.files.length > 0) {
      imagePaths = req.files.map(f => `/uploads/${f.filename || f.originalname}`);
    }

    const returnRequest = await ReturnRequest.create({
      orderId,
      userId: req.user._id,
      items: validatedReturnItems,
      reason,
      reasonDetails: reasonDetails || '',
      refundAmount,
      refundMethod: finalRefundMethod,
      bankDetails: parsedBankDetails,
      images: imagePaths,
      status: 'Requested'
    });

    // Update order status
    order.status = 'Return Requested';
    await order.save();

    res.status(201).json({ success: true, message: 'Return request submitted successfully', returnRequest });
  } catch (error) {
    console.error('Error creating return request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user's return requests
// @route   GET /returns
// @access  Private (User)
exports.getUserReturns = async (req, res) => {
  try {
    const returns = await ReturnRequest.find({ userId: req.user._id })
      .populate('orderId', 'status total createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, returns });
  } catch (error) {
    console.error('Error fetching user returns:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all return requests (Admin)
// @route   GET /returns/admin/all
// @access  Private (Admin)
exports.getAllReturns = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const { status, search } = req.query;

    let query = {};
    if (status && status !== 'All') {
      query.status = status;
    }

    // Build the base query
    let returns, total;

    if (search) {
      // Search by return ID or populated fields — use aggregation
      const searchRegex = new RegExp(search, 'i');
      
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order'
          }
        },
        { $unwind: '$order' },
        {
          $match: {
            $or: [
              { 'user.name': searchRegex },
              { 'user.phone': searchRegex },
              { 'user.email': searchRegex },
              { reason: searchRegex }
            ]
          }
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  orderId: '$order._id',
                  orderTotal: '$order.total',
                  orderCreatedAt: '$order.createdAt',
                  userId: '$user._id',
                  userName: '$user.name',
                  userPhone: '$user.phone',
                  userEmail: '$user.email',
                  items: 1,
                  reason: 1,
                  reasonDetails: 1,
                  status: 1,
                  refundAmount: 1,
                  refundMethod: 1,
                  adminNotes: 1,
                  images: 1,
                  createdAt: 1,
                  updatedAt: 1
                }
              }
            ]
          }
        }
      ];

      const result = await ReturnRequest.aggregate(pipeline);
      returns = result[0].data;
      total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    } else {
      [returns, total] = await Promise.all([
        ReturnRequest.find(query)
          .populate('userId', 'name email phone')
          .populate('orderId', 'total createdAt status')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ReturnRequest.countDocuments(query)
      ]);
    }

    // Get stats
    const [requestedCount, approvedCount, refundedToday, allReturns] = await Promise.all([
      ReturnRequest.countDocuments({ status: 'Requested' }),
      ReturnRequest.countDocuments({ status: 'Approved' }),
      ReturnRequest.countDocuments({
        status: 'Refunded',
        updatedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }),
      ReturnRequest.find({ status: 'Refunded' }).select('createdAt updatedAt').lean()
    ]);

    // Calculate average resolution time
    let avgResolutionDays = 0;
    if (allReturns.length > 0) {
      const totalDays = allReturns.reduce((sum, r) => {
        const diff = new Date(r.updatedAt) - new Date(r.createdAt);
        return sum + (diff / (1000 * 60 * 60 * 24));
      }, 0);
      avgResolutionDays = (totalDays / allReturns.length).toFixed(1);
    }

    // Get total refunded today amount
    const refundedTodayData = await ReturnRequest.find({
      status: 'Refunded',
      updatedAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999))
      }
    }).select('refundAmount').lean();
    const refundedTodayAmount = refundedTodayData.reduce((sum, r) => sum + r.refundAmount, 0);

    res.status(200).json({
      success: true,
      count: returns.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      returns,
      stats: {
        requestedCount,
        approvedCount,
        refundedTodayAmount,
        avgResolutionDays
      }
    });
  } catch (error) {
    console.error('Error fetching all returns:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single return request by ID (Admin)
// @route   GET /returns/admin/:id
// @access  Private (Admin)
exports.getReturnById = async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('orderId', 'total createdAt status paymentMethod paymentStatus deliveryAddress items');

    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    res.status(200).json({ success: true, returnRequest });
  } catch (error) {
    console.error('Error fetching return request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update return status (Admin)
// @route   PUT /returns/admin/:id/status
// @access  Private (Admin)
exports.updateReturnStatus = async (req, res) => {
  let oldStatus = null;
  let statusLocked = false;
  try {
    const { status, adminNotes, refundAmount } = req.body;

    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    // Validate status transitions
    const validTransitions = {
      'Requested': ['Approved', 'Rejected', 'Refunded'],
      'Approved': ['Pick-up Scheduled', 'Received', 'Refunded', 'Rejected'],
      'Pick-up Scheduled': ['Received', 'Refunded', 'Rejected'],
      'Received': ['Refunded', 'Rejected']
    };

    const allowed = validTransitions[returnRequest.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${returnRequest.status}' to '${status}'. Allowed: ${(allowed || []).join(', ') || 'none'}`
      });
    }

    // An admin-entered amount may lower the refund (e.g. a damaged return) but never exceed what
    // the customer is eligible for on these items.
    let adminRefundAmount;
    if (refundAmount !== undefined && refundAmount !== null && refundAmount !== '') {
      adminRefundAmount = Number(refundAmount);
      const order = await Order.findById(returnRequest.orderId);
      const maxRefund = order ? calculateEligibleRefund(order, returnRequest.items, returnRequest.refundMethod) : 0;
      if (!Number.isFinite(adminRefundAmount) || adminRefundAmount < 0 || adminRefundAmount > maxRefund) {
        return res.status(400).json({
          success: false,
          message: `Refund amount must be between ₹0 and ₹${maxRefund}, the eligible amount for this return.`
        });
      }
      adminRefundAmount = Math.round(adminRefundAmount * 100) / 100;
    }

    oldStatus = returnRequest.status;

    // Acquire atomic status lock to prevent concurrent double-spend/double-refund
    const lockedRequest = await ReturnRequest.findOneAndUpdate(
      { _id: req.params.id, status: oldStatus },
      { $set: { status: status } },
      { new: true }
    );

    if (!lockedRequest) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: This return request was updated by another process. Please refresh and try again.'
      });
    }

    statusLocked = true;

    // Update local variables
    returnRequest.status = status;
    if (adminNotes !== undefined) returnRequest.adminNotes = adminNotes;
    if (adminRefundAmount !== undefined) returnRequest.refundAmount = adminRefundAmount;

    // Handle Shiprocket return order creation on approval
    if (status === 'Approved') {
      try {
        const order = await Order.findById(returnRequest.orderId).populate('userId');
        if (order) {
          await createReturnShipment(returnRequest, order);
        }
      } catch (srError) {
        console.error("Shiprocket return order creation failed:", srError.message);
        returnRequest.shipmentStatus = 'Failed';
        returnRequest.shipmentRetryCount = (returnRequest.shipmentRetryCount || 0) + 1;
        returnRequest.lastShipmentRetryAt = new Date();
        returnRequest.shipmentErrors.push({ error: srError.message, timestamp: new Date() });
        if (returnRequest.shipmentRetryCount >= 3) {
          returnRequest.shipmentStatus = 'Manual Review';
        }
      }
    }

    // Handle rejection — reset order status back
    if (status === 'Rejected') {
      const order = await Order.findById(returnRequest.orderId);
      if (order && order.status === 'Return Requested') {
        order.status = 'Delivered';
        await order.save();
      }
    }

    // Handle refund processing
    if (status === 'Refunded') {
      const order = await Order.findById(returnRequest.orderId);

      // Throw (rather than returning directly) so the catch block below reverts the status
      // lock acquired above — otherwise the return would be stranded at 'Refunded' with no
      // refund actually processed, and no valid transition would let anyone retry it.
      if (!order) {
        throw new Error('Original order not found for return request');
      }

      if (order.paymentMethod === 'Online' && order.paymentStatus !== 'Paid') {
        throw new Error('Cannot process refund for unpaid online order');
      }

      // 1-3. Stock restoration + clawback of the order's (still locked) reward coins + cash
      // refund (Razorpay/wallet store-credit) happen atomically/idempotently inside
      // handleReturnRefund, guarded by their own claims. Redeemed coins are non-returnable.
      await handleReturnRefund(returnRequest, order);

      // 4. Update order status
      if (order) {
        const returnedQty = returnRequest.items.reduce((sum, i) => sum + i.quantity, 0);
        const orderQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
        
        if (returnedQty >= orderQty) {
          order.status = 'Refunded'; // Full return
          order.paymentStatus = 'Refunded';
        } else {
          // Must leave 'Return Requested': from there the generic admin endpoint still allows
          // 'Cancelled', which would run a second, full-order refund and restock.
          order.status = 'Partially Refunded';
          order.paymentStatus = 'Partially Refunded';
        }
        await order.save();
      }
    }

    await returnRequest.save();

    res.status(200).json({ success: true, message: `Return status updated to ${status}`, returnRequest });
  } catch (error) {
    if (statusLocked && oldStatus) {
      console.log(`⚠️ Rollback: Releasing status lock on return request ${req.params.id}. Reverting status to '${oldStatus}'`);
      await ReturnRequest.findByIdAndUpdate(req.params.id, { $set: { status: oldStatus } });
    }
    console.error('Error updating return status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get return request by order ID (for checking if return exists)
// @route   GET /returns/by-order/:orderId
// @access  Private (User)
exports.getReturnByOrderId = async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findOne({
      orderId: req.params.orderId,
      userId: req.user._id,
      status: { $nin: ['Rejected'] }
    }).lean();

    res.status(200).json({ success: true, returnRequest: returnRequest || null });
  } catch (error) {
    console.error('Error fetching return by order ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Shiprocket tracking statuses that mean the return pickup did not / will not happen.
const RETURN_PICKUP_PROBLEM = /CANCEL|LOST|DAMAGED|DESTROYED|PICKUP EXCEPTION|PICKUP FAILED|UNDELIVERED|RTO/;

/**
 * Shiprocket tracking update for a return shipment (sent to the same webhook as orders, with
 * `is_return: 1` and our `RET_<id>` order id). Records the courier/AWB, moves the return to
 * "Pick-up Scheduled" once the courier pickup is booked and to "Received" once the parcel has
 * been delivered back to the warehouse. The refund itself stays a manual admin step (after the
 * item is checked). Problems (pickup cancelled, lost, ...) are recorded for admin.
 * Returns true when a return matched the update.
 */
exports.handleReturnWebhook = async (payload) => {
  const ref = String(payload.order_id || payload.channel_order_id || '');
  const awb = payload.awb || payload.awb_code;
  let returnRequest = null;

  if (ref.startsWith('RET_')) {
    const id = ref.slice(4);
    if (mongoose.Types.ObjectId.isValid(id)) returnRequest = await ReturnRequest.findById(id);
  }
  if (!returnRequest && payload.sr_order_id) {
    returnRequest = await ReturnRequest.findOne({ shiprocketReturnOrderId: String(payload.sr_order_id) });
  }
  if (!returnRequest && awb) {
    returnRequest = await ReturnRequest.findOne({ awbCode: String(awb) });
  }
  if (!returnRequest) return false;

  const srStatus = String(payload.current_status || payload.shipment_status || payload.status || '').toUpperCase().replace(/_/g, ' ').trim();

  // An AWB assigned straight from the Shiprocket panel is only learnt from these updates.
  if (awb && !returnRequest.awbCode) returnRequest.awbCode = String(awb);
  if (payload.courier_name && !returnRequest.courierName) returnRequest.courierName = payload.courier_name;

  // Status moves are made with a conditional update, so an admin changing the same return at
  // the same moment always wins and nothing is moved twice.
  const moveStatus = async (from, to) => {
    if (!from.includes(returnRequest.status)) return;
    const moved = await ReturnRequest.updateOne({ _id: returnRequest._id, status: returnRequest.status }, { $set: { status: to } });
    if (moved.modifiedCount === 1) returnRequest.status = to;
  };

  if (srStatus === 'DELIVERED' || srStatus === 'RETURN DELIVERED') {
    returnRequest.pickupScheduled = true;
    await moveStatus(['Approved', 'Pick-up Scheduled'], 'Received');
  } else if (RETURN_PICKUP_PROBLEM.test(srStatus)) {
    returnRequest.shipmentErrors.push({ error: `Shiprocket reports the return shipment as "${srStatus}". Check it in the Shiprocket panel.`, timestamp: new Date() });
  } else if (PICKUP_BOOKED_OR_LATER.test(srStatus)) {
    returnRequest.pickupScheduled = true;
    await moveStatus(['Approved'], 'Pick-up Scheduled');
  }

  // Save only the shipment fields; the status was already written by moveStatus above.
  await ReturnRequest.updateOne({ _id: returnRequest._id }, {
    $set: { awbCode: returnRequest.awbCode, courierName: returnRequest.courierName, pickupScheduled: returnRequest.pickupScheduled, shipmentErrors: returnRequest.shipmentErrors }
  });
  return true;
};

// @desc    Retry Shiprocket reverse-pickup shipment creation for an Approved return whose
//          initial shipment creation failed (mirrors ExchangeRequest's retry endpoint)
// @route   POST /returns/admin/:id/retry-shipment
// @access  Private (Admin)
exports.retryReturnShipment = async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (!['Approved', 'Pick-up Scheduled'].includes(returnRequest.status)) {
      return res.status(400).json({ success: false, message: `Cannot retry shipment for a return in status '${returnRequest.status}'.` });
    }

    if (returnRequest.shipmentRetryInProgress) {
      return res.status(409).json({ success: false, message: 'A retry attempt is already in progress for this return.' });
    }

    if (returnRequest.awbCode && returnRequest.pickupScheduled) {
      return res.status(400).json({ success: false, message: `Return pickup is already booked (AWB ${returnRequest.awbCode}).` });
    }

    // The return order already exists in Shiprocket and only the courier (AWB) and/or the pickup
    // request are missing — e.g. the wallet was low. Continue from there; never create a second
    // return order.
    if (returnRequest.shiprocketReturnShipmentId) {
      returnRequest.shipmentRetryInProgress = true;
      await returnRequest.save();
      try {
        const assigned = await bookReturnPickup(returnRequest);
        returnRequest.lastShipmentRetryAt = new Date();
        if (assigned) returnRequest.shipmentStatus = 'Created';
        return res.status(assigned ? 200 : 502).json({
          success: assigned,
          message: assigned
            ? `Return pickup scheduled with ${returnRequest.courierName || 'courier'} (AWB ${returnRequest.awbCode})`
            : returnRequest.shipmentErrors[returnRequest.shipmentErrors.length - 1].error,
          returnRequest
        });
      } finally {
        returnRequest.shipmentRetryInProgress = false;
        await returnRequest.save();
      }
    }

    if (returnRequest.shipmentRetryCount >= 3) {
      returnRequest.shipmentStatus = 'Manual Review';
      await returnRequest.save();
      return res.status(400).json({ success: false, message: 'Maximum retry limit (3) exceeded. Return moved to Manual Review.', returnRequest });
    }

    returnRequest.shipmentRetryInProgress = true;
    await returnRequest.save();

    try {
      const order = await Order.findById(returnRequest.orderId).populate('userId');
      if (!order) {
        throw new Error('Original order not found for this return request');
      }

      await createReturnShipment(returnRequest, order);

      returnRequest.shipmentRetryInProgress = false;
      await returnRequest.save();

      return res.status(200).json({ success: true, message: 'Return pickup shipment created successfully', returnRequest });
    } catch (srError) {
      console.error('retryReturnShipment failed:', srError.message);
      returnRequest.shipmentStatus = 'Failed';
      returnRequest.shipmentRetryCount = (returnRequest.shipmentRetryCount || 0) + 1;
      returnRequest.lastShipmentRetryAt = new Date();
      returnRequest.shipmentErrors.push({ error: srError.message, timestamp: new Date() });
      if (returnRequest.shipmentRetryCount >= 3) {
        returnRequest.shipmentStatus = 'Manual Review';
      }
      returnRequest.shipmentRetryInProgress = false;
      await returnRequest.save();

      return res.status(502).json({ success: false, message: `Failed to create return pickup shipment: ${srError.message}`, returnRequest });
    }
  } catch (error) {
    console.error('retryReturnShipment outer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
