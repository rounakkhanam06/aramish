const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const shiprocketService = require('../Router/shiprocketService');
const { handleReturnRefund } = require('../utils/orderHelper');

// Builds the Shiprocket reverse-pickup order and attempts AWB assignment for a return
// request, mutating the passed returnRequest document's shipment fields in place. Used both
// on initial 'Approved' transition and by the admin retry endpoint below, so a Shiprocket
// outage on approval doesn't leave the return stuck with no way to (re)try the pickup.
// Throws on failure — callers are responsible for recording the failure/retry state.
const createReturnShipment = async (returnRequest, order) => {
  // Calculate weight
  let totalWeight = 0;
  for (const item of returnRequest.items) {
    const product = await Product.findById(item.productId);
    const w = (product && product.shippingSpecs && product.shippingSpecs.weight) ? product.shippingSpecs.weight : 0.5;
    totalWeight += (w * item.quantity);
  }

  const cityState = shiprocketService.parseCityState(order.deliveryAddress.address);

  // Get return shipping address from env or defaults
  const returnShippingAddress = {
    name: process.env.RETURN_SHIPPING_NAME || "Aramish Warehouse",
    address: process.env.RETURN_SHIPPING_ADDRESS || "Warehouse 12, Sector 63",
    address_2: process.env.RETURN_SHIPPING_ADDRESS_2 || "",
    city: process.env.RETURN_SHIPPING_CITY || "Noida",
    state: process.env.RETURN_SHIPPING_STATE || "Uttar Pradesh",
    country: "India",
    pincode: process.env.SHIPROCKET_PICKUP_PINCODE || "201301",
    phone: process.env.RETURN_SHIPPING_PHONE || "9876543210",
    email: process.env.RETURN_SHIPPING_EMAIL || "warehouse@aramish.com"
  };

  const returnPayload = {
    order_id: `RET_${returnRequest._id.toString()}`,
    order_date: new Date(returnRequest.createdAt).toISOString().slice(0, 16).replace('T', ' '),
    channel_id: "",
    pickup_customer_name: order.deliveryAddress.name || order.userId?.name || "Customer",
    pickup_last_name: "",
    pickup_address: order.deliveryAddress.address,
    pickup_address_2: "",
    pickup_city: cityState.city,
    pickup_state: cityState.state,
    pickup_country: "India",
    pickup_pincode: order.deliveryAddress.pincode,
    pickup_email: order.userId?.email || "customer@aramish.com",
    pickup_phone: order.userId?.phone || "9876543210",
    shipping_customer_name: returnShippingAddress.name,
    shipping_last_name: "",
    shipping_address: returnShippingAddress.address,
    shipping_address_2: returnShippingAddress.address_2,
    shipping_city: returnShippingAddress.city,
    shipping_state: returnShippingAddress.state,
    shipping_country: "India",
    shipping_pincode: returnShippingAddress.pincode,
    shipping_phone: returnShippingAddress.phone,
    shipping_email: returnShippingAddress.email,
    order_items: returnRequest.items.map(item => ({
      name: item.name,
      sku: item.productId ? item.productId.toString() : "PRODUCT",
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: 441122
    })),
    payment_method: "Prepaid",
    sub_total: returnRequest.refundAmount,
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
    try {
      const awbResponse = await shiprocketService.assignAWB(srResponse.shipment_id);
      if (awbResponse && awbResponse.response && awbResponse.response.data) {
        const data = awbResponse.response.data;
        returnRequest.awbCode = data.awb_code;
        returnRequest.courierName = data.courier_name;
      }
    } catch (awbErr) {
      console.error("Failed to automatically assign return AWB:", awbErr.message);
    }
  }
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
    
    const deliveryDate = order.updatedAt;
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
    let calculatedRefundAmount = 0;
    const validatedReturnItems = [];

    for (const returnItem of parsedItems) {
      if (!returnItem.productId || !returnItem.quantity || returnItem.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid product or quantity in return request' });
      }

      // Find item in original order
      const orderItem = order.items.find(item => item.productId.toString() === returnItem.productId.toString());
      if (!orderItem) {
        return res.status(400).json({ success: false, message: `Item ${returnItem.productId} is not part of this order` });
      }

      // Check return quantity against ordered quantity
      if (returnItem.quantity > orderItem.quantity) {
        return res.status(400).json({ success: false, message: `Return quantity (${returnItem.quantity}) for "${orderItem.name}" exceeds ordered quantity (${orderItem.quantity})` });
      }

      // Price is loaded from order, not trust user input
      calculatedRefundAmount += orderItem.price * returnItem.quantity;

      validatedReturnItems.push({
        productId: orderItem.productId,
        name: orderItem.name,
        price: orderItem.price,
        quantity: returnItem.quantity,
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

    // Cap the refund amount based on user selection (Wallet gets full fees back, Bank/UPI only gets item price)
    let refundAmount = 0;
    if (finalRefundMethod === 'Bank' || finalRefundMethod === 'UPI') {
      refundAmount = Math.min(calculatedRefundAmount, order.total);
    } else if (finalRefundMethod === 'Wallet') {
      const isFullReturn = order.items.every(orderItem => {
        const rItem = validatedReturnItems.find(r => r.productId.toString() === orderItem.productId.toString());
        return rItem && rItem.quantity === orderItem.quantity;
      });

      const proportionalGst = (order.subtotal && order.subtotal > 0) ? (calculatedRefundAmount / order.subtotal) * (order.gstAmount || 0) : 0;
      
      let walletRefund = calculatedRefundAmount + proportionalGst;
      if (isFullReturn) {
        walletRefund += (order.deliveryCharge || 0) + (order.platformCommission || 0);
      }
      
      refundAmount = Math.min(walletRefund, order.total);
    } else {
      refundAmount = Math.min(calculatedRefundAmount, order.total);
    }
    
    refundAmount = Math.round(refundAmount * 100) / 100;

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
    if (refundAmount !== undefined) returnRequest.refundAmount = refundAmount;

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

      // 1-3. Stock restoration + wallet/referral coin restore + cash refund (Razorpay/wallet
      // store-credit) all happen atomically/idempotently together inside handleReturnRefund,
      // guarded by their own claims so a retry after a partial failure can never double-restore
      // stock or double-refund cash.
      await handleReturnRefund(returnRequest, order);

      // 4. Update order status
      if (order) {
        const returnedQty = returnRequest.items.reduce((sum, i) => sum + i.quantity, 0);
        const orderQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
        
        if (returnedQty >= orderQty) {
          order.status = 'Refunded'; // Full return
          order.paymentStatus = 'Refunded';
        } else {
          order.paymentStatus = 'Partially Refunded';
        }
        await order.save();

        // Deduct Order Reward Coins on return refund
        const { deductOrderReward } = require('../utils/rewardService');
        deductOrderReward(order._id).catch(err => console.error('Error in deductOrderReward async trigger:', err));
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

    if (returnRequest.shipmentStatus === 'Created') {
      return res.status(400).json({ success: false, message: 'Shipment has already been created for this return. Cannot retry.' });
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
