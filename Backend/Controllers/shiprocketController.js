const shiprocketService = require('../Router/shiprocketService');
const Order = require('../Models/Order');
const mongoose = require('mongoose');
const { handleOrderCancellationRefunds } = require('../utils/orderHelper');
const { processDeliveredOrderRewards } = require('../utils/walletService');
const { verifyWebhookToken } = require('../utils/shiprocketWebhookAuth');
const { loadShippingDetails, buildShiprocketOrderPayload, cheapestCourier, shiprocketCostsFor } = require('../utils/shiprocketPayload');
const { srErrorMessage, readAwbResult, readLabelResult, requestPickupChecked } = require('../utils/shiprocketResults');
const { issueInvoiceSafely } = require('../utils/invoiceService');
const {
    orderShipment, resolveSelectedCourier, assignAwbWithCourier, mismatchWarning, panelSelection,
    acquireBookingLock, releaseBookingLock, getCourierConfig
} = require('../utils/courierSelection');
const { isSupersededAwb, applyShiprocketCourier, fetchShiprocketShipment, isCancelledStatus } = require('../utils/shipmentSync');

/**
 * A cancel event for an order still on its way: Shiprocket also cancels the OLD AWB when a courier
 * is reassigned in its panel, while the order itself goes on with a new AWB. Only Shiprocket's own
 * order status tells the two apart. Returns { cancelled: true } for a real cancellation, otherwise
 * { cancelled: false, shipment } (the current shipment, to sync). Throws when Shiprocket can't be
 * reached, so the caller can fail and be retried instead of refunding on a guess.
 */
const confirmOrderCancellation = async (order) => {
    if (!order.shiprocketOrderId) return { cancelled: true }; // no Shiprocket order to ask: as before
    const shipment = await fetchShiprocketShipment(order.shiprocketOrderId);
    return { cancelled: isCancelledStatus(shipment.orderStatus), shipment };
};

/** Records a courier change learnt from Shiprocket on an order's timeline. */
const noteCourierChange = (order, previous, sync) => {
    if (!sync.changed) return;
    order.trackingHistory.push({
        status: sync.reassigned ? 'Courier Reassigned' : 'AWB Assigned',
        timestamp: new Date(),
        activity: sync.reassigned
            ? `Courier changed in Shiprocket: ${previous.courierName || 'previous courier'}${previous.awb ? ` (AWB ${previous.awb})` : ''} → ${order.courierName || 'new courier'} (AWB ${order.awbCode})`
            : `AWB ${order.awbCode} assigned in Shiprocket via ${order.courierName || 'courier'}`,
        location: ''
    });
};

/**
 * Books the admin-selected courier for an order: validates the choice against Shiprocket's live
 * list, assigns the AWB with exactly that courier and records it (with our real freight cost —
 * the customer's bill never changes). Throws a courierError for a missing / blocked / no longer
 * serviceable courier. Returns { error } when Shiprocket refused, else { warning }.
 */
const bookOrderCourier = async (order, courierId, admin) => {
    const config = await getCourierConfig();
    const shipment = await orderShipment(order);
    const courier = await resolveSelectedCourier(shipment, courierId, config);
    const result = await assignAwbWithCourier(order.shipmentId, courier, { admin });
    if (result.error) {
        order.shiprocketResponses.push({ type: 'AWB_ASSIGN_FAILED', data: { courierId: courier.courierId, courierName: courier.name, error: result.error, response: result.data || null } });
        return { error: `AWB not assigned with ${courier.name}: ${result.error}. No other courier was tried — choose a courier and try again.` };
    }
    const { awbInfo, selection } = result;
    order.awbCode = awbInfo.awb_code;
    order.courierName = awbInfo.courier_name || courier.name;
    order.courierId = selection.assignedCourierId || courier.courierId;
    order.courierSelection = selection;
    order.shipmentStatus = 'AWB Assigned';
    // Our real Shiprocket cost is the booked courier's (finance only; the customer's bill is unchanged)
    order.shippingCost = courier.freight;
    order.shiprocketCodFee = shipment.cod ? courier.codCharges : 0;
    order.shiprocketResponses.push({ type: 'AWB_ASSIGN', data: awbInfo });
    order.trackingHistory.push({
        status: 'AWB Assigned',
        timestamp: new Date(),
        activity: `AWB ${awbInfo.awb_code} assigned via ${order.courierName}`,
        location: ''
    });
    return { warning: mismatchWarning(selection) };
};


// The goods leave our hands when the courier picks them up: the GST invoice is due then
// (CGST Act s.31(1)(a)). PICKED UP still maps the order to 'Processing', hence allowProcessing.
const DISPATCHED_SR_STATUSES = ['PICKED UP', 'PICKED_UP', 'SHIPPED', 'IN TRANSIT', 'IN_TRANSIT', 'DISPATCHED', 'OUT FOR DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const issueInvoiceOnDispatch = (order, srStatus) => {
    if (DISPATCHED_SR_STATUSES.includes(srStatus) || ['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status)) {
        return issueInvoiceSafely(order._id, { allowProcessing: true });
    }
    return null;
};

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
        // Free Shipping for Customers: the customer pays ₹0 (Shiprocket freight is our cost);
        // the quote above still confirms the pincode is deliverable.
        const SystemConfig = require('../Models/SystemConfig');
        const config = await SystemConfig.findOne({}).select('freeShippingEnabled').lean();
        const freeShipping = !config || config.freeShippingEnabled !== false;
        res.status(200).json({ success: true, deliveryCharge: freeShipping ? 0 : best.charge, freeShipping, etd: best.courier.etd || '' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Phase 2: Assign AWB (by orderId from our DB)
exports.assignAWB = async (req, res) => {
    const { orderId, courierId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });
    if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!courierId) {
        return res.status(400).json({ success: false, code: 'COURIER_REQUIRED', message: 'Please select a courier partner before assigning the AWB.' });
    }
    const order = await acquireBookingLock(Order, orderId).catch(() => null);
    if (!order) {
        const exists = await Order.exists({ _id: orderId });
        return exists
            ? res.status(409).json({ success: false, code: 'BOOKING_IN_PROGRESS', message: 'A courier booking for this order is already in progress. Please wait and refresh.' })
            : res.status(404).json({ success: false, message: 'Order not found' });
    }
    // The booking is saved and the lock released BEFORE replying, so the admin panel's refresh
    // (or a next click) right after the reply never sees a half-finished booking.
    let reply;
    try {
        if (!order.shipmentId) {
            reply = [400, { success: false, message: 'Create the Shiprocket order first (no shipment yet).' }];
        } else if (order.awbCode) {
            reply = [409, { success: false, code: 'AWB_EXISTS', message: `AWB ${order.awbCode} is already assigned with ${order.courierName || 'a courier'}.`, order }];
        } else {
            const { error, warning } = await bookOrderCourier(order, courierId, req.admin || req.user);
            await order.save();
            reply = error
                ? [400, { success: false, message: error }]
                : [200, { success: true, message: `AWB ${order.awbCode} assigned with ${order.courierName}`, warning, order }];
        }
    } catch (error) {
        if (error.code) {
            reply = [error.status || 500, { success: false, code: error.code, message: error.message }];
        } else {
            console.error('Error assigning AWB:', error.response?.data || error.message);
            reply = [500, { success: false, message: `AWB not assigned: ${srErrorMessage(error)}` }];
        }
    } finally {
        await releaseBookingLock(Order, order._id);
        order.bookingLockAt = null;
    }
    res.status(reply[0]).json(reply[1]);
};

// List serviceable couriers for an order/return/exchange leg (manual courier selection).
// @route GET /admin/shiprocket/couriers?type=order|return|exchange&id=<id>&leg=reverse|forward
exports.getCourierOptions = (req, res) => require('./courierController').getCourierOptions(req, res);

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

        if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(404).json({ success: false, message: 'Order not found' });
        let order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (!order.shipmentId) return res.status(400).json({ success: false, message: 'Order has no Shiprocket shipmentId' });

        const results = { awb: null, pickup: null, label: null };

        // Each step needs the previous one to have really succeeded (no AWB → no pickup → no
        // label), and only a confirmed success updates the shipment status and timeline.
        let failure = null;
        let warning = null;

        // Step 1: Assign the AWB with the courier the admin selected — never an automatic one.
        if (!order.awbCode) {
            if (!courierId) {
                return res.status(400).json({ success: false, code: 'COURIER_REQUIRED', message: 'Please select a courier partner before processing this order.' });
            }
            const locked = await acquireBookingLock(Order, order._id);
            if (!locked) {
                return res.status(409).json({ success: false, code: 'BOOKING_IN_PROGRESS', message: 'A courier booking for this order is already in progress. Please wait and refresh.' });
            }
            // Saved and unlocked before any reply (see assignAWB).
            let bookingReply = null;
            try {
                // A parallel request may have booked it between our read and the lock.
                if (locked.awbCode) {
                    bookingReply = [409, { success: false, code: 'AWB_EXISTS', message: `AWB ${locked.awbCode} is already assigned with ${locked.courierName || 'a courier'}.`, order: locked }];
                } else {
                    const booked = await bookOrderCourier(locked, courierId, req.admin || req.user);
                    await locked.save();
                    if (booked.error) {
                        bookingReply = [400, { success: false, message: booked.error, results, order: locked }];
                    } else {
                        warning = booked.warning;
                        results.awb = { awbCode: locked.awbCode, courierName: locked.courierName };
                        // Pickup and label continue on the booked order
                        order = locked;
                    }
                }
            } catch (courierErr) {
                if (!courierErr.code) throw courierErr;
                bookingReply = [courierErr.status || 500, { success: false, code: courierErr.code, message: courierErr.message }];
            } finally {
                await releaseBookingLock(Order, locked._id);
                locked.bookingLockAt = null;
            }
            if (bookingReply) return res.status(bookingReply[0]).json(bookingReply[1]);
        } else {
            results.awb = { skipped: true, message: 'AWB already assigned', awbCode: order.awbCode };
        }

        // Step 2: Request Pickup
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

        // Step 3: Generate Label
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
            warning,
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

        // The courier may have been assigned or changed in the Shiprocket panel: take the current
        // AWB/courier from Shiprocket first, so we never track (and act on) a replaced AWB.
        let srShipment = null;
        if (order.shiprocketOrderId) {
            try {
                srShipment = await fetchShiprocketShipment(order.shiprocketOrderId);
                const previous = { awb: order.awbCode, courierName: order.courierName };
                noteCourierChange(order, previous, applyShiprocketCourier(order, srShipment));
            } catch (detailsErr) {
                console.error('Could not refresh the courier from Shiprocket order details:', srErrorMessage(detailsErr));
            }
        }

        if (!order.awbCode) {
            await order.save();
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
                    // A cancelled AWB is only a cancelled order when Shiprocket's order says so
                    // (a reassigned courier cancels the old AWB too). Unconfirmed: leave it as is.
                    const confirmed = !isCancelledStatus(srStatus) || !order.shiprocketOrderId
                        || (srShipment && isCancelledStatus(srShipment.orderStatus));
                    if (confirmed) mappedStatus = 'Cancelled';
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
                await issueInvoiceOnDispatch(order, srStatus);
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
            // A late event for an AWB replaced by a courier reassignment: keep it for the record,
            // change nothing (it must not switch the order back to the old AWB, or cancel it).
            if (isSupersededAwb(order, awbCode)) {
                order.shiprocketResponses.push({ type: 'WEBHOOK_STALE_AWB', data: payload });
                await order.save();
                return res.status(200).json({ success: true, ignored: 'superseded AWB' });
            }

            // Map Shiprocket status to Aramish status
            let mappedStatus = order.status;
            const srStatus = currentStatus ? String(currentStatus).toUpperCase().trim() : '';
            const previousCourier = { awb: order.awbCode, courierName: order.courierName };
            // Set when a "cancel" turns out to be a courier reassignment (order goes on)
            let reassignedShipment = null;

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
                    // A cancel may only be the old AWB of a courier reassignment: confirm with
                    // Shiprocket first (if it can't be reached this throws → 500 → Shiprocket retries).
                    const check = (order.status !== 'Cancelled' && isCancelledStatus(srStatus))
                        ? await confirmOrderCancellation(order)
                        : { cancelled: true };
                    if (!check.cancelled) {
                        reassignedShipment = check.shipment;
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
            order.status = mappedStatus;
            let courierSync;
            if (reassignedShipment) {
                // The cancelled AWB was replaced: take the current shipment from Shiprocket.
                courierSync = applyShiprocketCourier(order, reassignedShipment);
                order.shipmentStatus = reassignedShipment.status || 'AWB Assigned';
            } else {
                if (currentStatus) order.shipmentStatus = currentStatus;
                // An AWB assigned or reassigned (new AWB, or same AWB with another courier)
                // directly in the Shiprocket panel is learnt here.
                courierSync = applyShiprocketCourier(order, { awb: awbCode, courierName, courierId: payload.courier_company_id || payload.courier_id });
            }
            noteCourierChange(order, previousCourier, courierSync);

            // Log response and update tracking history
            order.shiprocketResponses.push({ type: reassignedShipment ? 'WEBHOOK_REASSIGN_CANCEL' : 'WEBHOOK_UPDATE', data: payload });
            if (!reassignedShipment) {
                order.trackingHistory.push({
                    status: currentStatus || 'Updated',
                    timestamp: new Date(),
                    activity: payload.activity || currentStatus || 'Order Status Updated',
                    location: payload.location || ''
                });
            }

            await order.save();

            // Shiprocket fulfilment path: identical, idempotent reward crediting to the manual
            // admin status update. Duplicate DELIVERED webhooks are no-ops.
            if (order.status === 'Delivered') {
                await processDeliveredOrderRewards(order._id);
            }
            await issueInvoiceOnDispatch(order, srStatus);
            // Reward clawback for a Cancelled/RTO'd order is handled inside
            // handleOrderCancellationRefunds above.

            await order.populate('userId');

            // Send SMS via SMS India Hub — to the phone on the delivery address (the person
            // receiving the parcel), falling back to the account phone.
            const smsPhone = (order.deliveryAddress && order.deliveryAddress.phone) || (order.userId && order.userId.phone);
            // No tracking SMS for an internal courier switch (the "cancel" was only the old AWB).
            if (smsPhone && !reassignedShipment) {
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

