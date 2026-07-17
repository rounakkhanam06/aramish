const shiprocketService = require('../Router/shiprocketService');
const Order = require('../Models/Order');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { handleOrderCancellationStockAndCoupon, handleOrderCancellationRefunds, checkAndTriggerReferral } = require('../utils/orderHelper');

exports.checkServiceability = async (req, res) => {
    try {
        const { pickupPincode, deliveryPincode, weight, cod } = req.body;
        const data = await shiprocketService.checkServiceability(pickupPincode, deliveryPincode, weight, cod);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.estimateShipping = async (req, res) => {
    try {
        const { deliveryPincode, weight, cod } = req.body;
        console.log(`[ESTIMATE_API] Pincode: ${deliveryPincode}, Weight: ${weight}, COD: ${cod}`);
        const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
        const data = await shiprocketService.checkServiceability(pickupPincode, deliveryPincode, weight || 0.5, cod || 0);
        
        let minFreight = 0;
        let etd = '';
        if (data && data.data && data.data.available_courier_companies && data.data.available_courier_companies.length > 0) {
            const couriers = data.data.available_courier_companies;
            const calculateTotalFreight = (c) => cod ? (c.freight_charge + (c.cod_charges || 0)) : c.freight_charge;
            minFreight = Math.min(...couriers.map(calculateTotalFreight));
            const bestCourier = couriers.find(c => calculateTotalFreight(c) === minFreight);
            etd = bestCourier ? bestCourier.etd : '';
        }
        res.status(200).json({ success: true, deliveryCharge: minFreight, etd });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Phase 2: Assign AWB (by orderId from our DB)
exports.assignAWB = async (req, res) => {
    try {
        const { orderId, courierId } = req.body;

        // Support both: direct shipmentId or our DB orderId
        let order = null;
        let shipmentId = req.body.shipmentId;

        if (orderId) {
            order = await Order.findById(orderId);
            if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
            shipmentId = order.shipmentId;
        }

        if (!shipmentId) return res.status(400).json({ success: false, message: 'shipmentId is required' });

        const data = await shiprocketService.assignAWB(shipmentId, courierId);

        if (order && data && data.response && data.response.data) {
            const awbData = data.response.data;
            if (awbData.awb_code) order.awbCode = awbData.awb_code;
            if (awbData.courier_name) order.courierName = awbData.courier_name;
            order.shipmentStatus = 'AWB Assigned';
            order.shiprocketResponses.push({ type: 'AWB_ASSIGN', data: awbData });
            order.trackingHistory.push({
                status: 'AWB Assigned',
                timestamp: new Date(),
                activity: `AWB ${awbData.awb_code || ''} assigned via ${awbData.courier_name || 'courier'}`,
                location: ''
            });
            await order.save();
        } else if (!order && data && data.response && data.response.data && data.response.data.awb_code) {
            // Fallback: update by shipmentId directly
            await Order.findOneAndUpdate(
                { shipmentId: String(shipmentId) },
                { awbCode: data.response.data.awb_code, courierName: data.response.data.courier_name, shipmentStatus: 'AWB Assigned' }
            );
        }

        res.status(200).json({ success: true, data, order });
    } catch (error) {
        console.error('Error assigning AWB:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
    }
};

// Phase 2: Request Pickup (by orderId from our DB)
exports.requestPickup = async (req, res) => {
    try {
        const { orderId } = req.body;
        let order = null;
        let shipmentId = req.body.shipmentId;

        if (orderId) {
            order = await Order.findById(orderId);
            if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
            shipmentId = order.shipmentId;
        }

        if (!shipmentId) return res.status(400).json({ success: false, message: 'shipmentId is required' });

        const data = await shiprocketService.requestPickup(shipmentId);

        if (order) {
            order.pickupScheduled = true;
            order.shipmentStatus = 'Pickup Scheduled';
            order.shiprocketResponses.push({ type: 'PICKUP_REQUEST', data });
            order.trackingHistory.push({
                status: 'Pickup Scheduled',
                timestamp: new Date(),
                activity: 'Pickup has been scheduled with courier partner',
                location: ''
            });
            await order.save();
        }

        res.status(200).json({ success: true, data, order });
    } catch (error) {
        console.error('Error requesting pickup:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
    }
};

// Phase 2: Generate Label (by orderId from our DB)
exports.generateLabel = async (req, res) => {
    try {
        const { orderId } = req.body;
        let order = null;
        let shipmentId = req.body.shipmentId;

        if (orderId) {
            order = await Order.findById(orderId);
            if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
            shipmentId = order.shipmentId;
        }

        if (!shipmentId) return res.status(400).json({ success: false, message: 'shipmentId is required' });

        const data = await shiprocketService.generateLabel(shipmentId);

        if (order) {
            order.shiprocketResponses.push({ type: 'LABEL_GENERATED', data });
            order.trackingHistory.push({
                status: 'Label Generated',
                timestamp: new Date(),
                activity: 'Shipping label has been generated',
                location: ''
            });
            await order.save();
        }

        res.status(200).json({ success: true, data, order });
    } catch (error) {
        console.error('Error generating label:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
    }
};

// Phase 3: One-click Process Order (AWB + Pickup + Label in one go)
// @route POST /admin/shiprocket/process-order
exports.processOrder = async (req, res) => {
    try {
        const { orderId, courierId } = req.body;

        if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (!order.shipmentId) return res.status(400).json({ success: false, message: 'Order has no Shiprocket shipmentId' });

        const results = { awb: null, pickup: null, label: null };
        let finalCourierId = courierId;

        // Step 1: If no courier ID provided, find recommended courier from serviceability
        if (!finalCourierId) {
            try {
                const isCod = order.paymentMethod === 'COD' ? 1 : 0;
                const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
                const svcData = await shiprocketService.checkServiceability(pickupPincode, order.deliveryAddress.pincode, 0.5, isCod);
                if (svcData && svcData.data && svcData.data.recommended_courier_company_id) {
                    finalCourierId = svcData.data.recommended_courier_company_id;
                }
            } catch (svcErr) {
                console.error('Could not auto-select courier, will let Shiprocket decide:', svcErr.message);
            }
        }

        // Step 2: Assign AWB
        if (!order.awbCode) {
            try {
                const awbData = await shiprocketService.assignAWB(order.shipmentId, finalCourierId);
                results.awb = awbData;

                if (awbData && awbData.response && awbData.response.data) {
                    const awbInfo = awbData.response.data;
                    if (awbInfo.awb_code) order.awbCode = awbInfo.awb_code;
                    if (awbInfo.courier_name) order.courierName = awbInfo.courier_name;
                    order.shipmentStatus = 'AWB Assigned';
                    order.shiprocketResponses.push({ type: 'AWB_ASSIGN', data: awbInfo });
                    order.trackingHistory.push({
                        status: 'AWB Assigned',
                        timestamp: new Date(),
                        activity: `AWB ${awbInfo.awb_code || ''} assigned via ${awbInfo.courier_name || 'courier'}`,
                        location: ''
                    });
                }
            } catch (awbErr) {
                console.error('AWB assignment failed:', awbErr.response?.data || awbErr.message);
                results.awb = { error: awbErr.response?.data?.message || awbErr.message };
            }
        } else {
            results.awb = { skipped: true, message: 'AWB already assigned', awbCode: order.awbCode };
        }

        // Step 3: Request Pickup
        if (!order.pickupScheduled) {
            try {
                const pickupData = await shiprocketService.requestPickup(order.shipmentId);
                results.pickup = pickupData;
                order.pickupScheduled = true;
                order.shipmentStatus = 'Pickup Scheduled';
                order.shiprocketResponses.push({ type: 'PICKUP_REQUEST', data: pickupData });
                order.trackingHistory.push({
                    status: 'Pickup Scheduled',
                    timestamp: new Date(),
                    activity: 'Pickup has been scheduled with courier partner',
                    location: ''
                });
            } catch (pickupErr) {
                console.error('Pickup request failed:', pickupErr.response?.data || pickupErr.message);
                results.pickup = { error: pickupErr.response?.data?.message || pickupErr.message };
            }
        } else {
            results.pickup = { skipped: true, message: 'Pickup already scheduled' };
        }

        // Step 4: Generate Label
        try {
            const labelData = await shiprocketService.generateLabel(order.shipmentId);
            results.label = labelData;
            order.shiprocketResponses.push({ type: 'LABEL_GENERATED', data: labelData });
            order.trackingHistory.push({
                status: 'Label Generated',
                timestamp: new Date(),
                activity: 'Shipping label has been generated',
                location: ''
            });
        } catch (labelErr) {
            console.error('Label generation failed:', labelErr.response?.data || labelErr.message);
            results.label = { error: labelErr.response?.data?.message || labelErr.message };
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Order processed successfully',
            order: {
                _id: order._id,
                status: order.status,
                shipmentStatus: order.shipmentStatus,
                awbCode: order.awbCode,
                courierName: order.courierName,
                pickupScheduled: order.pickupScheduled
            },
            results
        });
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cancel order on Shiprocket
// @route POST /admin/shiprocket/cancel-order
exports.cancelShiprocketOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (['Delivered', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel order with status: ${order.status}` });
        }

        // Cancel on Shiprocket if shiprocketOrderId exists
        let srCancelData = null;
        if (order.shiprocketOrderId) {
            try {
                const token = await shiprocketService.getShiprocketToken();
                if (token) {
                    const axios = require('axios');
                    const SHIPROCKET_API_BASE = process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in';
                    const cancelRes = await axios.post(`${SHIPROCKET_API_BASE}/v1/external/orders/cancel`, {
                        ids: [order.shiprocketOrderId]
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    srCancelData = cancelRes.data;
                }
            } catch (srErr) {
                console.error('Shiprocket cancel failed:', srErr.response?.data || srErr.message);
                srCancelData = { error: srErr.response?.data?.message || srErr.message };
            }
        }

        // Restore stock & coupon usage
        await handleOrderCancellationStockAndCoupon(order);
        // Process refunds (wallet, coins, and online payments)
        await handleOrderCancellationRefunds(order);

        // Update order status
        order.status = 'Cancelled';
        order.shipmentStatus = 'Cancelled';
        order.shiprocketResponses.push({ type: 'CANCEL_ORDER', data: srCancelData });
        order.trackingHistory.push({
            status: 'Cancelled',
            timestamp: new Date(),
            activity: 'Order has been cancelled',
            location: ''
        });
        await order.save();

        res.status(200).json({ success: true, message: 'Order cancelled successfully', order, srCancelData });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Sync order status from Shiprocket (manual pull)
// @route POST /admin/shiprocket/sync-status
exports.syncOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (!order.awbCode) {
            return res.status(400).json({ success: false, message: 'Order has no AWB code to track' });
        }

        const trackingData = await shiprocketService.trackAWB(order.awbCode);
        
        if (trackingData && trackingData.tracking_data) {
            const shipmentTrack = trackingData.tracking_data.shipment_track;
            const activities = trackingData.tracking_data.shipment_track_activities || [];

            if (shipmentTrack && shipmentTrack.length > 0) {
                const latestTrack = shipmentTrack[0];
                const currentStatus = latestTrack.current_status;

                // Map to Aramish status
                let mappedStatus = order.status;
                const srStatus = currentStatus ? String(currentStatus).toUpperCase().trim() : '';

                if (['SHIPPED', 'IN TRANSIT', 'DISPATCHED'].includes(srStatus)) {
                    mappedStatus = 'Shipped';
                } else if (['OUT FOR DELIVERY', 'OUT_FOR_DELIVERY'].includes(srStatus)) {
                    mappedStatus = 'Out for Delivery';
                } else if (srStatus === 'DELIVERED') {
                    mappedStatus = 'Delivered';
                    if (order.paymentMethod === 'COD') {
                        order.paymentStatus = 'Paid';
                    }
                } else if (['CANCELLED', 'RTO INITIATED', 'RTO DELIVERED'].includes(srStatus)) {
                    mappedStatus = 'Cancelled';
                }

                const wasAlreadyCancelled = order.status === 'Cancelled';
                order.status = mappedStatus;
                order.shipmentStatus = currentStatus;

                if (mappedStatus === 'Cancelled' && !wasAlreadyCancelled) {
                    try {
                        await handleOrderCancellationStockAndCoupon(order);
                        await handleOrderCancellationRefunds(order);
                    } catch (err) {
                        console.error('Failed to restore stock on Shiprocket sync cancel:', err.message);
                    }
                }

                // Rebuild tracking history from Shiprocket activities
                if (activities.length > 0) {
                    const existingWebhookEntries = order.trackingHistory.filter(t => 
                        ['AWB Assigned', 'Pickup Scheduled', 'Label Generated', 'Cancelled'].includes(t.status)
                    );
                    order.trackingHistory = [
                        ...existingWebhookEntries,
                        ...activities.map(a => ({
                            status: a.activity || a['sr-status'] || 'Update',
                            timestamp: new Date(a.date),
                            activity: a.activity || 'Tracking update',
                            location: a.location || ''
                        }))
                    ];
                }

                order.shiprocketResponses.push({ type: 'SYNC_STATUS', data: trackingData });
                await order.save();
                await checkAndTriggerReferral(order);
            }
        }

        res.status(200).json({ success: true, message: 'Order synced with Shiprocket', order });
    } catch (error) {
        console.error('Error syncing order status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Phase 4: Webhook
exports.webhookReceiver = async (req, res) => {
    try {
        const payload = req.body;
        const signature = req.headers['x-shiprocket-signature'];
        const webhookSecret = process.env.SHIPROCKET_WEBHOOK_SECRET;

        if (webhookSecret || process.env.ENV === 'production') {
            if (!signature) {
                console.error('Shiprocket Webhook signature missing.');
                return res.status(401).json({ success: false, message: 'Unauthorized: Missing signature' });
            }
            if (!webhookSecret) {
                console.error('SHIPROCKET_WEBHOOK_SECRET is not set in environment.');
                return res.status(500).json({ success: false, message: 'Server configuration error' });
            }
            const expectedSig = crypto
                .createHmac('sha256', webhookSecret)
                .update(req.rawBody)
                .digest('hex');

            if (signature !== expectedSig) {
                console.error('Shiprocket Webhook signature mismatch.');
                return res.status(401).json({ success: false, message: 'Unauthorized: Invalid signature' });
            }
        }

        // Shiprocket sends POST request to this endpoint
        console.log('Shiprocket Webhook received:', payload);

        const orderId = payload.order_id || payload.shiprocket_order_id;
        const channelOrderId = payload.channel_order_id;
        const awbCode = payload.awb || payload.awb_code;
        const currentStatus = payload.current_status || payload.status;
        const courierName = payload.courier_name || payload.courier;

        let order = null;

        // 1. Try finding by Shiprocket Order ID
        if (orderId && !String(orderId).startsWith('ORD_')) {
            order = await Order.findOne({ shiprocketOrderId: String(orderId) });
        }

        // 2. Try finding by MongoDB ID from Channel Order ID
        if (!order) {
            const possibleChannelId = (channelOrderId || (typeof orderId === 'string' && orderId.startsWith('ORD_') ? orderId : null));
            if (possibleChannelId && possibleChannelId.startsWith('ORD_')) {
                const mongoId = possibleChannelId.replace('ORD_', '');
                if (mongoose.Types.ObjectId.isValid(mongoId)) {
                    order = await Order.findById(mongoId);
                }
            }
        }

        // 3. Try finding by AWB code
        if (!order && awbCode) {
            order = await Order.findOne({ awbCode });
        }

        if (order) {
            // Map Shiprocket status to Aramish status
            let mappedStatus = order.status;
            const srStatus = currentStatus ? String(currentStatus).toUpperCase().trim() : '';

            if (['SHIPPED', 'IN TRANSIT', 'DISPATCHED', 'IN_TRANSIT'].includes(srStatus)) {
                mappedStatus = 'Shipped';
            } else if (['OUT FOR DELIVERY', 'OUT_FOR_DELIVERY'].includes(srStatus)) {
                mappedStatus = 'Out for Delivery';
            } else if (srStatus === 'DELIVERED') {
                mappedStatus = 'Delivered';
                // Mark COD payment as Paid on delivery
                if (order.paymentMethod === 'COD') {
                    order.paymentStatus = 'Paid';
                }
            } else if (['CANCELLED', 'RTO INITIATED', 'RTO DELIVERED', 'RTO_INITIATED', 'RTO_DELIVERED', 'CANCELED'].includes(srStatus)) {
                if (order.status !== 'Cancelled') {
                    await handleOrderCancellationStockAndCoupon(order);
                    await handleOrderCancellationRefunds(order);
                }
                mappedStatus = 'Cancelled';
            } else if (['NEW', 'PICKUP SCHEDULED', 'AWB ASSIGNED', 'PICKUP GENERATED', 'OUT FOR PICKUP', 'PICKED UP', 'READY TO SHIP', 'AWB_ASSIGNED', 'PICKUP_SCHEDULED', 'PICKUP_GENERATED', 'OUT_FOR_PICKUP', 'PICKED_UP', 'READY_TO_SHIP'].includes(srStatus)) {
                mappedStatus = 'Processing';
            }

            // Update order details
            if (currentStatus) order.shipmentStatus = currentStatus;
            order.status = mappedStatus;
            if (awbCode) order.awbCode = awbCode;
            if (courierName) order.courierName = courierName;

            // Log response and update tracking history
            order.shiprocketResponses.push({ type: 'WEBHOOK_UPDATE', data: payload });
            order.trackingHistory.push({
                status: currentStatus || 'Updated',
                timestamp: new Date(),
                activity: payload.activity || currentStatus || 'Order Status Updated',
                location: payload.location || ''
            });

            await order.save();
            await checkAndTriggerReferral(order);
            await order.populate('userId');

            // Send SMS via SMS India Hub
            if (order.userId && order.userId.phone) {
                try {
                    const smsApiKey = process.env.SMS_API_KEY;
                    if (!smsApiKey) {
                        console.warn('⚠️ SMS_API_KEY is not configured in environment. Skipping status update SMS.');
                    } else {
                        const axios = require('axios');
                        let phone = order.userId.phone.toString().replace(/\D/g, '');
                        if (phone.length === 10) phone = '91' + phone;

                        const msg = `Dear Customer, your Aramish order tracking update: Status is now ${currentStatus || mappedStatus}.`;
                        const smsSenderId = process.env.SMS_SENDER_ID || 'IIDMTB';
                        let smsUrl = `https://cloud.smsindiahub.in/vendorsms/pushsms.aspx?APIKey=${smsApiKey}&msisdn=${phone}&sid=${smsSenderId}&msg=${encodeURIComponent(msg)}&fl=0&gwid=2`;
                        const smsPeId = process.env.SMS_PE_ID;
                        if (smsPeId) {
                            smsUrl += `&EntityId=${smsPeId}`;
                        }
                        const smsTrackingTemplateId = process.env.SMS_TRACKING_TEMPLATE_ID;
                        if (smsTrackingTemplateId) {
                            smsUrl += `&dlttemplateid=${smsTrackingTemplateId}`;
                        }

                        axios.get(smsUrl).then(response => {
                            console.log('SMS sent for webhook update:', response.data);
                        }).catch(err => {
                            console.error('SMS send failed:', err.message);
                        });
                    }
                } catch (smsErr) {
                    console.error('Error preparing SMS:', smsErr.message);
                }
            }
        } else {
            console.log('No matching order found for webhook payload:', payload);
        }

        // Always return 200 OK to Shiprocket
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.trackOrder = async (req, res) => {
    try {
        const { awb } = req.params;
        if (!awb) return res.status(400).json({ success: false, message: 'AWB is required' });
        const data = await shiprocketService.trackAWB(awb);
        res.status(200).json({ success: true, tracking: data });
    } catch (error) {
        console.error('Error tracking AWB:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Manually create Shiprocket order for an existing database order (if it failed at checkout)
// @route POST /admin/shiprocket/create-order
exports.createShiprocketOrderForExisting = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (order.shipmentId) return res.status(400).json({ success: false, message: 'Shiprocket order already created' });

        const Product = require('../Models/Product');
        const User = require('../Models/User');

        const user = await User.findById(order.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Calculate total order weight based on products
        let totalOrderWeight = 0;
        for (const item of order.items) {
            if (item.productId) {
                const product = await Product.findById(item.productId);
                const productWeight = (product && product.shippingSpecs && product.shippingSpecs.weight) ? product.shippingSpecs.weight : 0.5;
                totalOrderWeight += (productWeight * (item.quantity || 1));
            }
        }

        const cityState = shiprocketService.parseCityState(order.deliveryAddress.address);

        const shiprocketOrderData = {
            order_id: `ORD_${order._id}`,
            order_date: new Date(order.createdAt).toISOString().slice(0, 16).replace('T', ' '),
            pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Home',
            billing_customer_name: user.name || order.deliveryAddress.name || 'Customer',
            billing_last_name: '',
            billing_address: order.deliveryAddress.address,
            billing_city: cityState.city,
            billing_pincode: order.deliveryAddress.pincode,
            billing_state: cityState.state,
            billing_country: 'India',
            billing_email: user.email || 'customer@aramish.com',
            billing_phone: user.phone || '9876543210',
            shipping_is_billing: true,
            order_items: order.items.map(item => ({
                name: item.name,
                sku: item.productId.toString(),
                units: item.quantity || 1,
                selling_price: item.price,
                discount: 0,
                tax: 0,
                hsn: 441122
            })),
            payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
            sub_total: order.total,
            length: 10,
            breadth: 10,
            height: 10,
            weight: totalOrderWeight || 0.5
        };

        const srResponse = await shiprocketService.createShiprocketOrder(shiprocketOrderData);
        
        if (srResponse) {
            order.shiprocketResponses.push({ type: 'CREATE_ORDER_RETRY', data: srResponse });
            if (srResponse.order_id) {
                order.shiprocketOrderId = srResponse.order_id;
                order.shipmentId = srResponse.shipment_id;
            }
        }

        // Fetch delivery charges (serviceability) and store it
        try {
            const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
            const serviceResponse = await shiprocketService.checkServiceability(pickupPincode, order.deliveryAddress.pincode, totalOrderWeight || 0.5, order.paymentMethod === 'COD' ? 1 : 0);
            order.shiprocketResponses.push({ type: 'SERVICEABILITY', data: serviceResponse });
            
            if (serviceResponse && serviceResponse.data && serviceResponse.data.available_courier_companies) {
                const couriers = serviceResponse.data.available_courier_companies;
                if (couriers.length > 0) {
                    const isCod = order.paymentMethod === 'COD';
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

        res.status(200).json({ success: true, message: 'Shiprocket order created successfully', order });
    } catch (error) {
        console.error('Error creating manual Shiprocket order:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
    }
};

