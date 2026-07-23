const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const CoinTransaction = require('../Models/CoinTransaction');
const shiprocketService = require('../Router/shiprocketService');
const User = require('../Models/User');
const axios = require('axios');

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

    // Cap the refund amount by the total amount paid on the order
    const refundAmount = Math.min(calculatedRefundAmount, order.total);

    let imagePaths = [];
    if (req.processedFiles && req.processedFiles.length > 0) {
      imagePaths = req.processedFiles.map(f => f.url);
    } else if (req.files && req.files.length > 0) {
      imagePaths = req.files.map(f => `/uploads/${f.filename || f.originalname}`);
    }

    let parsedBankDetails = null;
    if (req.body.bankDetails) {
      try {
        parsedBankDetails = typeof req.body.bankDetails === 'string' ? JSON.parse(req.body.bankDetails) : req.body.bankDetails;
      } catch (e) {
        parsedBankDetails = null;
      }
    }

    const returnRequest = await ReturnRequest.create({
      orderId,
      userId: req.user._id,
      items: validatedReturnItems,
      reason,
      reasonDetails: reasonDetails || '',
      refundAmount,
      refundMethod: req.body.refundMethod || (parsedBankDetails ? 'Bank' : 'Original'),
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
          if (srResponse && srResponse.order_id) {
            returnRequest.shiprocketReturnOrderId = srResponse.order_id;
            returnRequest.shiprocketReturnShipmentId = srResponse.shipment_id;
            // Attempt to assign AWB if shipment ID is generated
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
          }
        }
      } catch (srError) {
        console.error("Shiprocket return order creation failed:", srError.message);
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
      
      if (!order) {
        return res.status(404).json({ success: false, message: 'Original order not found for return request' });
      }

      if (order.paymentMethod === 'Online' && order.paymentStatus !== 'Paid') {
        return res.status(400).json({ success: false, message: 'Cannot process refund for unpaid online order' });
      }

      // 1. Restore stock for returned items
      for (const item of returnRequest.items) {
        if (item.productId) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity, sales: -item.quantity }
          });
        }
      }

      // 2. INDEPENDENT WALLET COINS REFUND: Restore redeemed wallet coins to user's wallet
      if (order.walletUsed && order.walletUsed > 0 && !returnRequest.walletRefundProcessed) {
        const WalletTransaction = require('../Models/WalletTransaction');
        
        const SystemConfig = require('../Models/SystemConfig');
        const systemConfig = await SystemConfig.findOne({});
        const welcomeBonusCoins = systemConfig && systemConfig.welcomeBonusCoins !== undefined ? systemConfig.welcomeBonusCoins : 1000;
        
        const currentUser = await User.findById(returnRequest.userId);
        const coinsToRestore = order.welcomeCoinsUsed !== undefined && order.welcomeCoinsUsed !== null ? order.welcomeCoinsUsed : (order.walletUsed || 0);
        const restoredWelcomeRemaining = Math.min(welcomeBonusCoins, (currentUser?.welcomeBonusRemaining || 0) + coinsToRestore);

        await User.findByIdAndUpdate(returnRequest.userId, {
          $inc: {
            walletBalance: order.walletUsed
          },
          $set: {
            welcomeBonusRemaining: restoredWelcomeRemaining
          }
        });

        await WalletTransaction.create({
          userId: returnRequest.userId,
          type: 'REFUND',
          amount: order.walletUsed,
          description: `Restored ${order.walletUsed} Wallet Coins for Returned Order #${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()}`
        });

        returnRequest.walletRefundProcessed = true;
        console.log(`✅ Restored ${order.walletUsed} wallet coins for returned order: ${order._id}`);
      }

      // 3. INDEPENDENT PAYMENT REFUND: Process Cash / Paid Amount Refund (Razorpay online or store credit fallback)
      let refundProcessedOnline = false;
      const cashRefundAmount = Number(returnRequest.refundAmount) || 0;
      
      if (cashRefundAmount > 0) {
        if (order && order.paymentMethod === 'Online' && order.paymentId) {
          const rzpKeyId = process.env.RAZORPAY_KEY_ID;
          const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

          if (rzpKeyId && rzpKeySecret) {
            try {
              const rzpAuth = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');
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
            } catch (refundErr) {
              console.error('Razorpay refund API call failed, falling back to coins store credit:', refundErr.response?.data || refundErr.message);
            }
          }
        }

        // Only add cash refund to wallet balance if customer specifically chose 'Wallet' as their refund destination
        const isWalletSelected = returnRequest.refundMethod === 'Wallet';

        if (!refundProcessedOnline && isWalletSelected) {
          const WalletTransaction = require('../Models/WalletTransaction');
          await WalletTransaction.create({
            userId: returnRequest.userId,
            type: 'Refund',
            amount: cashRefundAmount,
            description: `Cash Refund for Return #${returnRequest._id.toString().substring(returnRequest._id.toString().length - 6).toUpperCase()}`
          });

          // Update the User document's walletBalance
          await User.findByIdAndUpdate(returnRequest.userId, {
            $inc: { walletBalance: cashRefundAmount }
          });
          console.log(`✅ Credited cash refund of ₹${cashRefundAmount} to wallet balance (Refund method: Wallet)`);
        } else if (!refundProcessedOnline) {
          console.log(`ℹ️ Cash refund of ₹${cashRefundAmount} processed manually via ${returnRequest.refundMethod || 'Bank/UPI'} - skipped wallet credit.`);
        }
      }

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
