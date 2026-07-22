const ExchangeRequest = require('../Models/ExchangeRequest');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const SystemConfig = require('../Models/SystemConfig');
const User = require('../Models/User');
const shiprocketService = require('../Router/shiprocketService');
const { EXCHANGE_WEBHOOK_MAP } = require('../Router/shiprocketService');

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

const releaseReservedStock = async (exchange) => {
  if (exchange.inventoryReservation && !exchange.inventoryReservation.released && exchange.inventoryReservation.variantSku) {
    await Product.findOneAndUpdate(
      { _id: exchange.inventoryReservation.productId, 'variations.sku': exchange.inventoryReservation.variantSku },
      { $inc: { 'variations.$.stock': exchange.inventoryReservation.quantity || 1 } }
    );
    exchange.inventoryReservation.released = true;
    exchange.inventoryReservation.releasedAt = new Date();
  }
};

// ─── User: Create Exchange Request ───────────────────────────────────────────

exports.createExchangeRequest = async (req, res) => {
  try {
    const { orderId, originalItem, requestedVariant, reason, comments, images } = req.body;

    if (!orderId || !originalItem || !requestedVariant || !reason) {
      return res.status(400).json({ success: false, message: 'orderId, originalItem, requestedVariant, and reason are required' });
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
    const daysDiff = (new Date() - new Date(order.updatedAt)) / (1000 * 60 * 60 * 24);
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
      i.productId.toString() === originalItem.productId &&
      (originalItem.variationSku ? i.variationSku === originalItem.variationSku : true)
    );
    if (!orderItem) {
      return res.status(400).json({ success: false, message: 'Original item not found in this order' });
    }

    // Same variant validation
    if (originalItem.variationSku && requestedVariant.sku === originalItem.variationSku) {
      return res.status(400).json({ success: false, message: 'Requested variant must be different from the current variant' });
    }

    // Fetch product to validate requested variant
    const product = await Product.findById(requestedVariant.productId || originalItem.productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const reqVariant = product.variations.find(v => v.sku === requestedVariant.sku);
    if (!reqVariant) {
      return res.status(400).json({ success: false, message: 'Requested variant not found' });
    }

    // Calculate price difference (stored for reference, no payment action in v1)
    const priceDifference = (reqVariant.sellingPrice || product.sellingPrice) - orderItem.price;

    const exchange = await ExchangeRequest.create({
      orderId,
      userId: req.user._id,
      originalItem: {
        productId:    orderItem.productId,
        variationSku: orderItem.variationSku || null,
        name:         orderItem.name,
        price:        orderItem.price,
        quantity:     1,
        image:        orderItem.image || '',
        color:        orderItem.attributes?.get?.('color') || originalItem.color || '',
        size:         orderItem.attributes?.get?.('size') || originalItem.size || ''
      },
      requestedVariant: {
        productId: product._id,
        color:     reqVariant.color,
        size:      reqVariant.size,
        sku:       reqVariant.sku,
        image:     (reqVariant.images && reqVariant.images[0]) || (product.images && product.images[0]) || '',
        price:     reqVariant.sellingPrice || product.sellingPrice
      },
      priceDifference,
      reason,
      comments: comments || '',
      images: images || [],
      status: 'Requested'
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

    // ── APPROVE ──────────────────────────────────────────────────────────────
    if (status === 'Approved') {
      if (adminNotes) exchange.adminNotes = adminNotes;

      // Hard stock check with atomic reservation
      const reservationResult = await Product.findOneAndUpdate(
        {
          _id: exchange.requestedVariant.productId,
          'variations.sku': exchange.requestedVariant.sku,
          'variations.stock': { $gt: 0 }
        },
        { $inc: { 'variations.$.stock': -1 } },
        { new: true }
      );

      if (!reservationResult) {
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
      const exchangeId = exchange._id.toString();

      // ── Create Reverse Shipment (pickup old item) ──────────────────────────
      try {
        const reversePayload = {
          order_id: `EXC_REV_${exchangeId}`,
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
          order_items: [{
            name: exchange.originalItem.name,
            sku: exchange.originalItem.variationSku || exchange.originalItem.productId.toString(),
            units: 1,
            selling_price: exchange.originalItem.price,
            discount: 0,
            tax: 0,
            hsn: 441122
          }],
          payment_method: 'Prepaid',
          sub_total: exchange.originalItem.price,
          length: 10, breadth: 10, height: 10, weight: 0.5
        };

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
          try {
            const awbResp = await shiprocketService.assignAWB(reverseResp.shipment_id);
            const awbData = awbResp?.response?.data;
            if (awbData?.awb_code) {
              exchange.reverse.awb = awbData.awb_code;
              exchange.reverse.trackingUrl = `https://shiprocket.co/tracking/${awbData.awb_code}`;
              exchange.reverse.status = 'AWB Assigned';
              exchange.courierName = awbData.courier_name || null;
            }
          } catch (awbErr) {
            console.error('Exchange reverse AWB assignment failed:', awbErr.message);
          }
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
        const forwardPayload = {
          order_id: `EXC_FWD_${exchangeId}`,
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
          order_items: [{
            name: `${exchange.originalItem.name} (${exchange.requestedVariant.color}/${exchange.requestedVariant.size})`,
            sku: exchange.requestedVariant.sku,
            units: 1,
            selling_price: exchange.originalItem.price,
            discount: 0,
            tax: 0,
            hsn: 441122
          }],
          payment_method: 'Prepaid',
          sub_total: exchange.originalItem.price,
          length: 10, breadth: 10, height: 10, weight: 0.5
        };

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
          try {
            const awbResp = await shiprocketService.assignAWB(forwardResp.shipment_id);
            const awbData = awbResp?.response?.data;
            if (awbData?.awb_code) {
              exchange.forward.awb = awbData.awb_code;
              exchange.forward.trackingUrl = `https://shiprocket.co/tracking/${awbData.awb_code}`;
              exchange.forward.status = 'AWB Assigned';
              if (!exchange.courierName) exchange.courierName = awbData.courier_name || null;
            }
          } catch (awbErr) {
            console.error('Exchange forward AWB assignment failed:', awbErr.message);
          }
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
      if (!rejectionReason) {
        return res.status(400).json({ success: false, message: 'rejectionReason is mandatory when rejecting an exchange' });
      }
      exchange.status = 'Rejected';
      exchange.rejectionReason = rejectionReason;
      if (adminNotes) exchange.adminNotes = adminNotes;
      order.status = 'Delivered';  // Revert
      addTimeline(exchange, 'Rejected', 'admin', admin?._id, rejectionReason);
      addAudit(exchange, 'rejected', admin, fromStatus, 'Rejected', rejectionReason);
    }

    // ── CANCEL ────────────────────────────────────────────────────────────────
    else if (status === 'Cancelled') {
      if (!adminNotes) {
        return res.status(400).json({ success: false, message: 'adminNotes is mandatory when cancelling an exchange' });
      }
      await releaseReservedStock(exchange);
      exchange.status = 'Cancelled';
      exchange.adminNotes = adminNotes;
      order.status = 'Exchange Cancelled';
      addTimeline(exchange, 'Cancelled', 'admin', admin?._id, adminNotes);
      addAudit(exchange, 'cancelled', admin, fromStatus, 'Cancelled', adminNotes);
    }

    // ── COMPLETED ─────────────────────────────────────────────────────────────
    else if (status === 'Completed') {
      // Restore original variant stock
      if (exchange.originalItem.variationSku) {
        await Product.findOneAndUpdate(
          { _id: exchange.originalItem.productId, 'variations.sku': exchange.originalItem.variationSku },
          { $inc: { 'variations.$.stock': 1, 'variations.$.sales': -1 } }
        );
      }
      exchange.status = 'Completed';
      order.status = 'Exchange Completed';
      addTimeline(exchange, 'Completed', 'admin', admin?._id, adminNotes || 'Exchange completed');
      addAudit(exchange, 'completed', admin, fromStatus, 'Completed', adminNotes || '');
    }

    // ── FAILED ────────────────────────────────────────────────────────────────
    else if (status === 'Failed') {
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
      return res.status(400).json({ success: false, message: `Invalid status transition: ${status}` });
    }

    await exchange.save();
    await order.save();

    res.json({ success: true, message: `Exchange status updated to ${exchange.status}`, exchange });
  } catch (error) {
    console.error('updateExchangeStatus error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Webhook Handler ──────────────────────────────────────────────────────────

exports.handleExchangeWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const rawOrderId = payload.order_id || payload.awb || '';

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

    const exchange = await ExchangeRequest.findById(exchangeId);
    if (!exchange) return res.status(200).json({ success: true, message: 'Exchange not found, skipped' });

    const rawStatus = payload.current_status || payload.status || '';
    const mapped = (EXCHANGE_WEBHOOK_MAP[leg] && EXCHANGE_WEBHOOK_MAP[leg][rawStatus]) || null;

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

    if (mapped && mapped !== exchange.status) {
      const prevStatus = exchange.status;

      if (mapped === 'Completed') {
        // Restore original variant stock
        if (exchange.originalItem.variationSku) {
          await Product.findOneAndUpdate(
            { _id: exchange.originalItem.productId, 'variations.sku': exchange.originalItem.variationSku },
            { $inc: { 'variations.$.stock': 1, 'variations.$.sales': -1 } }
          );
        }
        exchange.status = 'Completed';
        if (order) order.status = 'Exchange Completed';
      } else if (mapped === 'Failed') {
        await releaseReservedStock(exchange);
        exchange[leg].failed = true;
        // Check if both legs failed → full failure
        if (exchange.reverse.failed && exchange.forward.failed) {
          exchange.status = 'Failed';
          if (order) order.status = 'Delivered';
        } else {
          exchange.status = 'Manual Review';
          if (order) order.status = 'Manual Review';
        }
      } else if (mapped === 'Manual Review') {
        exchange.status = 'Manual Review';
        if (order) order.status = 'Manual Review';
      } else {
        exchange.status = mapped;
        if (order) order.status = mapped;
      }

      addTimeline(exchange, exchange.status, 'webhook', null, `Shiprocket: ${rawStatus}`);
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
      const exchangeId = exchange._id.toString();

      if (leg === 'reverse') {
        // Create Reverse Shipment
        const reversePayload = {
          order_id: `EXC_REV_${exchangeId}`,
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
          order_items: [{
            name: exchange.originalItem.name,
            sku: exchange.originalItem.variationSku || exchange.originalItem.productId.toString(),
            units: 1,
            selling_price: exchange.originalItem.price,
            discount: 0,
            tax: 0,
            hsn: 441122
          }],
          payment_method: 'Prepaid',
          sub_total: exchange.originalItem.price,
          length: 10, breadth: 10, height: 10, weight: 0.5
        };

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
          try {
            const awbResp = await shiprocketService.assignAWB(reverseResp.shipment_id);
            const awbData = awbResp?.response?.data;
            if (awbData?.awb_code) {
              exchange.reverse.awb = awbData.awb_code;
              exchange.reverse.trackingUrl = `https://shiprocket.co/tracking/${awbData.awb_code}`;
              exchange.reverse.status = 'AWB Assigned';
              exchange.courierName = awbData.courier_name || null;
            }
          } catch (awbErr) {
            console.error('Exchange reverse AWB assignment failed:', awbErr.message);
          }
        }
      } else {
        // Create Forward Shipment
        const forwardPayload = {
          order_id: `EXC_FWD_${exchangeId}`,
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
          order_items: [{
            name: `${exchange.originalItem.name} (${exchange.requestedVariant.color}/${exchange.requestedVariant.size})`,
            sku: exchange.requestedVariant.sku,
            units: 1,
            selling_price: exchange.originalItem.price,
            discount: 0,
            tax: 0,
            hsn: 441122
          }],
          payment_method: 'Prepaid',
          sub_total: exchange.originalItem.price,
          length: 10, breadth: 10, height: 10, weight: 0.5
        };

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
          try {
            const awbResp = await shiprocketService.assignAWB(forwardResp.shipment_id);
            const awbData = awbResp?.response?.data;
            if (awbData?.awb_code) {
              exchange.forward.awb = awbData.awb_code;
              exchange.forward.trackingUrl = `https://shiprocket.co/tracking/${awbData.awb_code}`;
              exchange.forward.status = 'AWB Assigned';
              if (!exchange.courierName) exchange.courierName = awbData.courier_name || null;
            }
          } catch (awbErr) {
            console.error('Exchange forward AWB assignment failed:', awbErr.message);
          }
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
      console.log(`Notification: Shipment for ${leg} leg of Exchange ${exchangeId} has been successfully created. Tracking URL: ${exchange[leg].trackingUrl}`);

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
