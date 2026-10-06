const shiprocketService = require('../Router/shiprocketService');
const Order = require('../Models/Order');
const mongoose = require('mongoose');
const { handleOrderCancellationRefunds } = require('../utils/orderHelper');
const { processDeliveredOrderRewards } = require('../utils/walletService');
const { verifyWebhookToken } = require('../utils/shiprocketWebhookAuth');
const { loadShippingDetails, buildShiprocketOrderPayload, cheapestCourier, shiprocketCostsFor } = require('../utils/shiprocketPayload');
const { srErrorMessage, readAwbResult, readLabelResult, requestPickupChecked } = require('../utils/shiprocketResults');

// Forward-shipping updates (Processing/Shipped/Out for Delivery/Delivered) must never pull an
// order back out of a cancelled or post-delivery state — e.g. a late or duplicate DELIVERED
// webhook for a Cancelled/Refunded/Return Requested order, which would otherwise re-open it
// and make it eligible for reward coins again.
const FINAL_OR_POST_DELIVERY_STATUSES = [
    'Cancelled', 'Refunded', 'Partially Refunded', 'Return Requested',
    'Exchange Requested', 'Exchange Approved', 'Pickup Scheduled', 'Old Item Picked Up',
    'Replacement Dispatched', 'Exchange Completed', 'Exchange Rejected', 'Exchange Cancelled',
    'Exchange Failed', 'Manual Review'
];
const FORWARD_SHIPPING_STATUSES = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
const keepFinalStatus = (currentStatus, mappedStatus) =>
    (FINAL_OR_POST_DELIVERY_STATUSES.includes(currentStatus) && FORWARD_SHIPPING_STATUSES.includes(mappedStatus))
        ? currentStatus
        : mappedStatus;
// Delivered or later (returns/exchanges): the forward shipment is done, so a cancel/RTO for it
// must not trigger a cancellation refund.
const isPastForwardShipping = (status) =>
    status === 'Delivered' || (status !== 'Cancelled' && FINAL_OR_POST_DELIVERY_STATUSES.includes(status));

// Shipment states that end the forward delivery: the order is cancelled, refunded and its stock
// restored. "RTO Initiated" / "RTO In Transit" are deliberately NOT here — the parcel is still
// on its way back, so stock is only restored once it has actually returned ("RTO Delivered").
const SHIPMENT_ENDED_STATUSES = ['CANCELLED', 'CANCELED', 'RTO DELIVERED', 'RTO_DELIVERED'];

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
        let data;
        try {
            data = await shiprocketService.checkServiceability(pickupPincode, deliveryPincode, weight || 0.5, cod || 0);
        } catch (svcErr) {
            return res.status(503).json({ success: false, message: 'Could not calculate the delivery charge right now. Please try again in a few minutes.' });
        }

        // Same rule checkout charges by. No courier means no delivery — never "free delivery".
        const best = cheapestCourier(data?.data?.available_courier_companies);
        if (!best) {
            return res.status(400).json({ success: false, message: `Delivery is not available to pincode ${deliveryPincode}${Number(cod) === 1 ? ' with Cash on Delivery' : ''}.` });
        }
        res.status(200).json({ success: true, deliveryCharge: best.charge, etd: best.courier.etd || '' });
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
        const { awbInfo, error } = readAwbResult(data);

        if (error) {
            if (order) {
                order.shiprocketResponses.push({ type: 'AWB_ASSIGN_FAILED', data: data?.response?.data || data });
                await order.save();
            }
            return res.status(400).json({ success: false, message: `AWB not assigned: ${error}`, data });
        }

        if (order) {
            order.awbCode = awbInfo.awb_code;
            if (awbInfo.courier_name) order.courierName = awbInfo.courier_name;
            order.shipmentStatus = 'AWB Assigned';
            order.shiprocketResponses.push({ type: 'AWB_ASSIGN', data: awbInfo });
            order.trackingHistory.push({
                status: 'AWB Assigned',
                timestamp: new Date(),
                activity: `AWB ${awbInfo.awb_code} assigned via ${awbInfo.courier_name || 'courier'}`,
                location: ''
            });
            await order.save();
        } else {
            // Fallback: update by shipmentId directly
            await Order.findOneAndUpdate(
                { shipmentId: String(shipmentId) },
                { awbCode: awbInfo.awb_code, courierName: awbInfo.courier_name, shipmentStatus: 'AWB Assigned' }
            );
        }

        res.status(200).json({ success: true, data, order });
    } catch (error) {
        console.error('Error assigning AWB:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: `AWB not assigned: ${srErrorMessage(error)}` });
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
        if (order && !order.awbCode) {
            return res.status(400).json({ success: false, message: 'Assign an AWB before requesting a pickup' });
        }

        // "Already scheduled" counts as success; any other refusal is reported to admin.
        const { scheduled, error, data } = await requestPickupChecked(shiprocketService, shipmentId);
        if (!scheduled) {
            if (order) {
                order.shiprocketResponses.push({ type: 'PICKUP_REQUEST_FAILED', data });
                await order.save();
            }
            return res.status(400).json({ success: false, message: `Pickup not scheduled: ${error}`, data });
        }

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
        res.status(500).json({ success: false, message: `Pickup not scheduled: ${srErrorMessage(error)}` });
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
        const { error } = readLabelResult(data, shipmentId);

        if (error) {
            if (order) {
                order.shiprocketResponses.push({ type: 'LABEL_FAILED', data });
                await order.save();
            }
            return res.status(400).json({ success: false, message: `Label not generated: ${error}`, data });
        }

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
        res.status(500).json({ success: false, message: `Label not generated: ${srErrorMessage(error)}` });
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
        // Shiprocket's charges for the courier we auto-book (applied only once the AWB is assigned)
        let bookedCosts = null;

        // Step 1: If no courier ID provided, pick the cheapest courier for the order's real
        // weight — the same courier the customer's delivery charge was priced on at checkout.
        if (!finalCourierId && !order.awbCode) {
            try {
                const isCod = order.paymentMethod === 'COD' && Number(order.total) > 0;
                const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
                const { weight } = await loadShippingDetails(order.items);
                const svcData = await shiprocketService.checkServiceability(pickupPincode, order.deliveryAddress.pincode, weight, isCod ? 1 : 0);
                const best = cheapestCourier(svcData?.data?.available_courier_companies);
                if (best && best.courier.courier_company_id) {
                    finalCourierId = best.courier.courier_company_id;
                    bookedCosts = shiprocketCostsFor(best.courier, { isCod });
                }
            } catch (svcErr) {
                console.error('Could not auto-select courier, will let Shiprocket decide:', svcErr.message);
            }
        }

        // Each step needs the previous one to have really succeeded (no AWB → no pickup → no
        // label), and only a confirmed success updates the shipment status and timeline.
        let failure = null;

        // Step 2: Assign AWB
        if (!order.awbCode) {
            try {
                const awbData = await shiprocketService.assignAWB(order.shipmentId, finalCourierId);
                results.awb = awbData;
                const { awbInfo, error } = readAwbResult(awbData);
                if (error) {
                    failure = `AWB not assigned: ${error}`;
                    order.shiprocketResponses.push({ type: 'AWB_ASSIGN_FAILED', data: awbData?.response?.data || awbData });
                } else {
                    order.awbCode = awbInfo.awb_code;
                    if (awbInfo.courier_name) order.courierName = awbInfo.courier_name;
                    order.shipmentStatus = 'AWB Assigned';
                    order.shiprocketResponses.push({ type: 'AWB_ASSIGN', data: awbInfo });
                    order.trackingHistory.push({
                        status: 'AWB Assigned',
                        timestamp: new Date(),
                        activity: `AWB ${awbInfo.awb_code} assigned via ${awbInfo.courier_name || 'courier'}`,
                        location: ''
                    });
                    // Our real Shiprocket cost is the booked courier's (the customer's bill is unchanged)
                    if (bookedCosts) {
                        order.shippingCost = bookedCosts.shippingCost;
                        order.shiprocketCodFee = bookedCosts.shiprocketCodFee;
                    }
                }
            } catch (awbErr) {
                console.error('AWB assignment failed:', awbErr.response?.data || awbErr.message);
                failure = `AWB not assigned: ${srErrorMessage(awbErr)}`;
                results.awb = { error: srErrorMessage(awbErr) };
            }
        } else {
            results.awb = { skipped: true, message: 'AWB already assigned', awbCode: order.awbCode };
        }

        // Step 3: Request Pickup
        if (!failure && !order.pickupScheduled) {
            const pickup = await requestPickupChecked(shiprocketService, order.shipmentId);
            const pickupData = pickup.data || (pickup.error ? { error: pickup.error } : null);
            if (!pickup.scheduled) {
                console.error('Pickup request failed:', pickup.error);
                failure = `Pickup not scheduled: ${pickup.error}`;
            }
            results.pickup = pickupData;
            if (failure) {
                order.shiprocketResponses.push({ type: 'PICKUP_REQUEST_FAILED', data: pickupData });
            } else {
                order.pickupScheduled = true;
                order.shipmentStatus = 'Pickup Scheduled';
                order.shiprocketResponses.push({ type: 'PICKUP_REQUEST', data: pickupData });
                order.trackingHistory.push({
                    status: 'Pickup Scheduled',
                    timestamp: new Date(),
                    activity: 'Pickup has been scheduled with courier partner',
                    location: ''
                });
            }
        } else if (order.pickupScheduled) {
            results.pickup = { skipped: true, message: 'Pickup already scheduled' };
        }

        // Step 4: Generate Label
        if (!failure) {
            try {
                const labelData = await shiprocketService.generateLabel(order.shipmentId);
                results.label = labelData;
                const { error } = readLabelResult(labelData, order.shipmentId);
                if (error) {
                    failure = `Label not generated: ${error}`;
                    order.shiprocketResponses.push({ type: 'LABEL_FAILED', data: labelData });
                } else {
                    order.shiprocketResponses.push({ type: 'LABEL_GENERATED', data: labelData });
                    order.trackingHistory.push({
                        status: 'Label Generated',
                        timestamp: new Date(),
                        activity: 'Shipping label has been generated',
                        location: ''
                    });
                }
            } catch (labelErr) {
                console.error('Label generation failed:', labelErr.response?.data || labelErr.message);
                failure = `Label not generated: ${srErrorMessage(labelErr)}`;
                results.label = { error: srErrorMessage(labelErr) };
            }
        }

        await order.save();

        res.status(failure ? 400 : 200).json({
            success: !failure,
            message: failure || 'Order processed: AWB assigned, pickup scheduled and label generated',
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

        if (!['Pending', 'Processing', 'Shipped', 'Out for Delivery'].includes(order.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel order with status: ${order.status}` });
        }

        // Cancel on Shiprocket if shiprocketOrderId exists
        let srCancelData = null;
        if (order.shiprocketOrderId) {
            srCancelData = await shiprocketService.cancelShiprocketOrder(order.shiprocketOrderId)
                || { error: 'Shiprocket cancel failed — cancel it in the Shiprocket panel too' };
        }

        // Restore stock & coupon usage, claw back any reward, process the online payment
        // refund. Redeemed coins are non-returnable and are not restored.
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
                } else if (SHIPMENT_ENDED_STATUSES.includes(srStatus) && !isPastForwardShipping(order.status)) {
                    mappedStatus = 'Cancelled';
                }
                mappedStatus = keepFinalStatus(order.status, mappedStatus);
                if (mappedStatus === 'Delivered' && order.paymentMethod === 'COD') {
                    order.paymentStatus = 'Paid';
                }

                const wasAlreadyCancelled = order.status === 'Cancelled';
                order.shipmentStatus = currentStatus;

                if (mappedStatus === 'Cancelled' && !wasAlreadyCancelled) {
                    // Only flip the order to Cancelled if the refund actually succeeds. If we
                    // set order.status first and the refund then failed, the swallowed error
                    // below would still let order.save() persist "Cancelled" — and since the
                    // next sync would see wasAlreadyCancelled=true, the refund would never be
                    // retried. Keeping the order in its prior status on failure means the next
                    // sync call will retry this block.
                    try {
                        // Stock/coupon restore, wallet/coin refund, and reward clawback all
                        // happen atomically together inside handleOrderCancellationRefunds.
                        await handleOrderCancellationRefunds(order);
                        order.status = mappedStatus;
                    } catch (err) {
                        console.error('Failed to process cancellation refund on Shiprocket sync; order status left unchanged so it can be retried:', err.message);
                    }
                } else {
                    order.status = mappedStatus;
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

                // Shiprocket fulfilment path: identical, idempotent reward crediting to the manual
                // admin status update (order reward + per-order referral reward).
                if (order.status === 'Delivered') {
                    await processDeliveredOrderRewards(order._id);
                }
                // Reward clawback for a Cancelled/RTO'd order is handled inside
                // handleOrderCancellationRefunds above.
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
        const authError = verifyWebhookToken(req);
        if (authError) {
            return res.status(authError.status).json({ success: false, message: authError.message });
        }

        // Shiprocket posts every shipment of the account to this one URL, including the
        // exchange reverse-pickup/replacement shipments (EXC_REV_/EXC_FWD_ channel ids).
        const channelRef = String(payload.order_id || payload.channel_order_id || '');
        if (channelRef.startsWith('EXC_')) {
            return require('./exchangeController').handleExchangeWebhook(req, res);
        }
        // Return pickups (RET_ ids, flagged is_return: 1) arrive at this same URL. They must never
        // be handled as a forward order — e.g. a return "DELIVERED" to the warehouse is not an
        // order delivery.
        if (channelRef.startsWith('RET_') || Number(payload.is_return) === 1) {
            const matched = await require('./returnController').handleReturnWebhook(payload);
            if (!matched) console.log('No matching return found for webhook payload:', payload);
            return res.status(200).json({ success: true });
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
            } else if (SHIPMENT_ENDED_STATUSES.includes(srStatus)) {
                if (isPastForwardShipping(order.status)) {
                    // A late cancel/RTO for a shipment that already reached the customer (or
                    // already went through a return/exchange) must not refund/restock again.
                    mappedStatus = order.status;
                } else {
                    if (order.status !== 'Cancelled') {
                        // Stock/coupon restore and reward clawback happen atomically together
                        // (redeemed coins are not restored). If this throws, it propagates to the outer webhook
                        // try/catch (no local swallow here), so order.save() below is never
                        // reached and order.status is never persisted as Cancelled without the
                        // refund having actually succeeded — Shiprocket's webhook retry will then
                        // safely re-attempt the whole thing.
                        await handleOrderCancellationRefunds(order);
                    }
                    mappedStatus = 'Cancelled';
                }
            } else if (['NEW', 'PICKUP SCHEDULED', 'AWB ASSIGNED', 'PICKUP GENERATED', 'OUT FOR PICKUP', 'PICKED UP', 'READY TO SHIP', 'AWB_ASSIGNED', 'PICKUP_SCHEDULED', 'PICKUP_GENERATED', 'OUT_FOR_PICKUP', 'PICKED_UP', 'READY_TO_SHIP'].includes(srStatus)) {
                mappedStatus = 'Processing';
            }
            mappedStatus = keepFinalStatus(order.status, mappedStatus);
            // Mark COD payment as Paid on delivery
            if (mappedStatus === 'Delivered' && order.paymentMethod === 'COD') {
                order.paymentStatus = 'Paid';
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

            // Shiprocket fulfilment path: identical, idempotent reward crediting to the manual
            // admin status update. Duplicate DELIVERED webhooks are no-ops.
            if (order.status === 'Delivered') {
                await processDeliveredOrderRewards(order._id);
            }
            // Reward clawback for a Cancelled/RTO'd order is handled inside
            // handleOrderCancellationRefunds above.

            await order.populate('userId');

            // Send SMS via SMS India Hub — to the phone on the delivery address (the person
            // receiving the parcel), falling back to the account phone.
            const smsPhone = (order.deliveryAddress && order.deliveryAddress.phone) || (order.userId && order.userId.phone);
            if (smsPhone) {
                try {
                    const smsApiKey = process.env.SMS_INDIA_HUB_API_KEY || process.env.SMS_API_KEY;
                    if (!smsApiKey) {
                        console.warn('⚠️ SMS API key is not configured in environment. Skipping status update SMS.');
                    } else {
                        const axios = require('axios');
                        let phone = smsPhone.toString().replace(/\D/g, '');
                        if (phone.length === 10) phone = '91' + phone;

                        const msg = `Dear Customer, your Aramish order tracking update: Status is now ${currentStatus || mappedStatus}.`;
                        const smsSenderId = process.env.SMS_INDIA_HUB_SENDER_ID || process.env.SMS_SENDER_ID || 'BGADEC';
                        const rawUrl = process.env.SMS_INDIA_HUB_URL || 'https://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
                        const gwid = process.env.SMS_INDIA_HUB_GWID || '2';
                        let smsUrl = `${rawUrl}?APIKey=${smsApiKey}&msisdn=${phone}&sid=${smsSenderId}&msg=${encodeURIComponent(msg)}&fl=0&gwid=${gwid}`;
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

        const User = require('../Models/User');

        const user = await User.findById(order.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const { weight, hsnByProductId } = await loadShippingDetails(order.items);
        const shiprocketOrderData = buildShiprocketOrderPayload(order, user, { weight, hsnByProductId });

        const srResponse = await shiprocketService.createShiprocketOrder(shiprocketOrderData);
        if (!srResponse || !srResponse.order_id) {
            order.shiprocketResponses.push({ type: 'CREATE_ORDER_RETRY_FAILED', data: srResponse || null });
            await order.save();
            const reason = srResponse?.message || 'Shiprocket did not return an order id';
            return res.status(400).json({ success: false, message: `Shiprocket order not created: ${reason}` });
        }
        order.shiprocketResponses.push({ type: 'CREATE_ORDER_RETRY', data: srResponse });
        order.shiprocketOrderId = srResponse.order_id;
        order.shipmentId = srResponse.shipment_id;

        // Refresh the delivery estimate only. The delivery charge is part of the total the
        // customer already agreed to, so it is never rewritten here.
        try {
            const isCod = order.paymentMethod === 'COD' && Number(order.total) > 0;
            const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
            const serviceResponse = await shiprocketService.checkServiceability(pickupPincode, order.deliveryAddress.pincode, weight, isCod ? 1 : 0);
            order.shiprocketResponses.push({ type: 'SERVICEABILITY', data: serviceResponse });
            const best = cheapestCourier(serviceResponse?.data?.available_courier_companies);
            if (best && best.courier.etd) order.etd = best.courier.etd;
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

