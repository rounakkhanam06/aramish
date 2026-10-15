const mongoose = require('mongoose');
const Order = require('../Models/Order');
const ReturnRequest = require('../Models/ReturnRequest');
const ExchangeRequest = require('../Models/ExchangeRequest');
const { orderShipment, returnShipment, exchangeShipment, listCouriers, getCourierConfig } = require('../utils/courierSelection');

// @desc    Serviceable courier partners for one shipment, for the admin to choose from
// @route   GET /admin/shiprocket/couriers?type=order|return|exchange&id=<id>&leg=reverse|forward
// @access  Private/Admin
exports.getCourierOptions = async (req, res) => {
  try {
    const { type, id, leg } = req.query;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ success: false, message: 'Not found' });

    let shipment;
    let booked = null;
    if (type === 'order') {
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      shipment = await orderShipment(order);
      if (order.awbCode) booked = { awb: order.awbCode, courierName: order.courierName };
    } else if (type === 'return') {
      const returnRequest = await ReturnRequest.findById(id);
      if (!returnRequest) return res.status(404).json({ success: false, message: 'Return request not found' });
      const order = await Order.findById(returnRequest.orderId);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      shipment = await returnShipment(returnRequest, order);
      if (returnRequest.awbCode) booked = { awb: returnRequest.awbCode, courierName: returnRequest.courierName };
    } else if (type === 'exchange') {
      if (!['reverse', 'forward'].includes(leg)) return res.status(400).json({ success: false, message: 'leg must be reverse or forward' });
      const exchange = await ExchangeRequest.findById(id);
      if (!exchange) return res.status(404).json({ success: false, message: 'Exchange request not found' });
      const order = await Order.findById(exchange.orderId);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      shipment = exchangeShipment(exchange, order, leg);
      if (exchange[leg] && exchange[leg].awb) booked = { awb: exchange[leg].awb, courierName: exchange[leg].courierName || exchange.courierName };
    } else {
      return res.status(400).json({ success: false, message: 'type must be order, return or exchange' });
    }

    const result = await listCouriers(shipment, await getCourierConfig());
    res.status(200).json({
      success: true,
      ...result,
      booked,
      shipment: {
        kind: shipment.kind,
        pickupPincode: shipment.pickupPincode,
        deliveryPincode: shipment.deliveryPincode,
        weight: shipment.weight,
        cod: shipment.cod,
        isReturn: shipment.isReturn,
        declaredValue: shipment.declaredValue
      },
      message: result.couriers.length ? undefined
        : result.blocked.length
          ? 'Only blocked couriers serve this shipment. Unblock one in Settings → Business & Tax, or book it from the Shiprocket panel.'
          : 'No courier partner currently serves this shipment.'
    });
  } catch (error) {
    if (error.code) return res.status(error.status || 500).json({ success: false, code: error.code, message: error.message });
    console.error('getCourierOptions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
