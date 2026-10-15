/**
 * Manual courier selection for every Shiprocket booking (orders, returns, exchange legs).
 *
 *  - The admin picks the courier from Shiprocket's live serviceability list for the exact
 *    shipment (pincodes, weight, dimensions, declared value, COD/prepaid, return or forward).
 *  - Blocked couriers (Settings → Business & Tax) are never offered or accepted.
 *  - Booking without a selected courier is refused: Shiprocket's assign-AWB API picks a default
 *    courier when no courier_id is sent, so courier_id is always sent here.
 *  - The selection is re-checked against a fresh list right before booking; a courier that is no
 *    longer serviceable is refused, never swapped for another one.
 *  - If Shiprocket books a different courier than the one requested, that is recorded and flagged.
 */
const shiprocketService = require('../Router/shiprocketService');
const SystemConfig = require('../Models/SystemConfig');
const { loadShippingDetails, getReturnWarehouse, DEFAULT_WEIGHT_KG } = require('./shiprocketPayload');
const { srErrorMessage, readAwbResult } = require('./shiprocketResults');

const courierError = (code, message, status = 400) => Object.assign(new Error(message), { code, status });

const numOrNull = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pickupPincode = () => process.env.SHIPROCKET_PICKUP_PINCODE || '201301';

// Same box as every payload we send Shiprocket (orders, returns, exchanges).
const BOX = { length: 10, breadth: 10, height: 10 };

// ---------- shipment parameters (must match what the booked Shiprocket order declares) ----------

/** Forward delivery of one of our orders (payload: buildShiprocketOrderPayload). */
const orderShipment = async (order) => {
  const { weight } = await loadShippingDetails(order.items);
  const payable = Math.max(0, money(order.total));
  const cod = order.paymentMethod === 'COD' && payable > 0;
  return {
    kind: 'order',
    pickupPincode: pickupPincode(),
    deliveryPincode: order.deliveryAddress && order.deliveryAddress.pincode,
    weight: weight || DEFAULT_WEIGHT_KG,
    cod,
    isReturn: false,
    declaredValue: cod ? payable : money(payable + (Number(order.walletUsed) || 0) + (Number(order.refundWalletUsed) || 0)),
    ...BOX
  };
};

/** Reverse pickup for a return: customer → return warehouse (payload: createReturnShipment). */
const returnShipment = async (returnRequest, order) => {
  const { weight } = await loadShippingDetails(returnRequest.items);
  const warehouse = getReturnWarehouse();
  const itemsValue = returnRequest.items.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 1), 0);
  return {
    kind: 'return',
    pickupPincode: order.deliveryAddress && order.deliveryAddress.pincode,
    deliveryPincode: warehouse.pincode,
    weight: weight || DEFAULT_WEIGHT_KG,
    cod: false,
    isReturn: true,
    declaredValue: money(itemsValue) || money(returnRequest.refundAmount),
    ...BOX
  };
};

/** Exchange legs (payloads: buildReversePayload / buildForwardPayload, both 0.5 kg). */
const exchangeShipment = (exchange, order, leg) => {
  if (leg === 'reverse') {
    const warehouse = getReturnWarehouse();
    return {
      kind: 'exchange_reverse',
      pickupPincode: order.deliveryAddress && order.deliveryAddress.pincode,
      deliveryPincode: warehouse.pincode,
      weight: 0.5,
      cod: false,
      isReturn: true,
      declaredValue: money(exchange.originalItem && exchange.originalItem.price),
      ...BOX
    };
  }
  const codDifference = exchange.paymentMethod === 'COD' && Number(exchange.additionalAmount) > 0;
  return {
    kind: 'exchange_forward',
    pickupPincode: pickupPincode(),
    deliveryPincode: order.deliveryAddress && order.deliveryAddress.pincode,
    weight: 0.5,
    cod: codDifference,
    isReturn: false,
    declaredValue: money(codDifference ? exchange.additionalAmount : exchange.requestedVariant && exchange.requestedVariant.price),
    ...BOX
  };
};

// ---------- courier list ----------

const normalizeCourier = (c) => ({
  courierId: Number(c.courier_company_id),
  name: c.courier_name || `Courier ${c.courier_company_id}`,
  freight: money(numOrNull(c.freight_charge) ?? numOrNull(c.rate) ?? 0),
  codCharges: money(numOrNull(c.cod_charges) ?? 0),
  etd: c.etd || null,
  estimatedDays: numOrNull(c.estimated_delivery_days),
  rating: numOrNull(c.rating),
  deliveryPerformance: numOrNull(c.delivery_performance),
  pickupPerformance: numOrNull(c.pickup_performance),
  rtoPerformance: numOrNull(c.rto_performance),
  trackingPerformance: numOrNull(c.tracking_performance),
  isSurface: c.is_surface === undefined ? null : !!c.is_surface,
  codAvailable: c.cod === undefined ? null : Number(c.cod) === 1
});

const blockedCourierMap = (config) =>
  new Map(((config && config.blockedCouriers) || []).map(b => [Number(b.courierId), b]));

/** What booking this courier costs us: freight, plus its COD fee when it collects cash. */
const costToUs = (courier, cod) => money(courier.freight + (cod ? courier.codCharges : 0));

/**
 * Live, serviceable couriers for a shipment. Blocked couriers are removed (and listed separately).
 * Throws a courierError when Shiprocket can't be reached.
 */
const listCouriers = async (shipment, config) => {
  if (!shipment.pickupPincode || !shipment.deliveryPincode) {
    throw courierError('SHIPMENT_INCOMPLETE', 'Pickup or delivery pincode is missing for this shipment.', 400);
  }
  let data;
  try {
    data = await shiprocketService.checkServiceability(
      shipment.pickupPincode, shipment.deliveryPincode, shipment.weight, shipment.cod ? 1 : 0,
      { length: shipment.length, breadth: shipment.breadth, height: shipment.height, declaredValue: shipment.declaredValue, isReturn: shipment.isReturn }
    );
  } catch (err) {
    throw courierError('COURIERS_UNAVAILABLE', `Could not fetch courier partners from Shiprocket: ${srErrorMessage(err)}`, 502);
  }
  const blocked = blockedCourierMap(config);
  const all = ((data && data.data && data.data.available_courier_companies) || [])
    .filter(c => c && c.courier_company_id)
    .map(normalizeCourier)
    // A COD shipment needs a courier that collects cash.
    .filter(c => !shipment.cod || c.codAvailable !== false);
  const couriers = all.filter(c => !blocked.has(c.courierId))
    .map(c => ({ ...c, totalCost: costToUs(c, shipment.cod) }))
    .sort((a, b) => a.totalCost - b.totalCost);
  const hiddenBlocked = all.filter(c => blocked.has(c.courierId)).map(c => ({ courierId: c.courierId, name: c.name }));

  const cheapest = couriers[0] || null;
  const rated = couriers.filter(c => c.rating !== null)
    .sort((a, b) => (b.rating - a.rating) || ((b.deliveryPerformance || 0) - (a.deliveryPerformance || 0)) || (a.totalCost - b.totalCost));
  const recommended = numOrNull(data && data.data && (data.data.recommended_courier_company_id || data.data.shiprocket_recommended_courier_id));
  return {
    couriers,
    blocked: hiddenBlocked,
    cheapestCourierId: cheapest ? cheapest.courierId : null,
    bestRatedCourierId: rated[0] ? rated[0].courierId : null,
    shiprocketRecommendedId: couriers.some(c => c.courierId === recommended) ? recommended : null
  };
};

/**
 * The admin's chosen courier, re-validated against a fresh list for this shipment.
 * Never substitutes another courier: missing / blocked / no longer serviceable all throw.
 */
const resolveSelectedCourier = async (shipment, courierId, config) => {
  const id = numOrNull(courierId);
  if (!id) throw courierError('COURIER_REQUIRED', 'Please select a courier partner before assigning the AWB.', 400);
  const blocked = blockedCourierMap(config).get(id);
  if (blocked) {
    throw courierError('COURIER_BLOCKED', `${blocked.name || `Courier ${id}`} is in your blocked couriers list. Please choose another courier.`, 400);
  }
  const { couriers } = await listCouriers(shipment, config);
  const courier = couriers.find(c => c.courierId === id);
  if (!courier) {
    throw courierError('COURIER_UNAVAILABLE', `The selected courier (ID ${id}) is no longer available for this shipment. Please refresh the list and choose a courier.`, 409);
  }
  return courier;
};

/** Assigns the AWB with exactly this courier. Returns { awbInfo, selection } or { error }. */
const assignAwbWithCourier = async (shipmentId, courier, { isReturn = false, admin = null } = {}) => {
  let data;
  try {
    data = await shiprocketService.assignAWB(shipmentId, courier.courierId, { isReturn });
  } catch (err) {
    return { error: srErrorMessage(err), data: err.response && err.response.data };
  }
  const { awbInfo, error } = readAwbResult(data);
  if (error) return { error, data };
  const assignedId = numOrNull(awbInfo.courier_company_id);
  return {
    awbInfo,
    selection: {
      courierId: courier.courierId,
      courierName: courier.name,
      freight: courier.freight,
      codCharges: courier.codCharges,
      etd: courier.etd,
      estimatedDays: courier.estimatedDays,
      rating: courier.rating,
      isSurface: courier.isSurface,
      source: 'admin',
      selectedAt: new Date(),
      selectedBy: (admin && admin._id) || null,
      selectedByName: (admin && (admin.name || admin.email)) || null,
      assignedCourierId: assignedId,
      assignedCourierName: awbInfo.courier_name || null,
      mismatch: !!assignedId && assignedId !== courier.courierId
    }
  };
};

/** Warning text when Shiprocket booked a different courier than the one chosen. */
const mismatchWarning = (selection) => (selection && selection.mismatch
  ? `Shiprocket booked ${selection.assignedCourierName || `courier ${selection.assignedCourierId}`} instead of the selected ${selection.courierName}. Check this shipment in the Shiprocket panel.`
  : null);

/** Selection record for an AWB assigned directly in the Shiprocket panel (learnt from a webhook). */
const panelSelection = (payload) => ({
  courierId: numOrNull(payload.courier_company_id || payload.courier_id),
  courierName: payload.courier_name || payload.courier || null,
  source: 'shiprocket_panel',
  selectedAt: new Date(),
  assignedCourierId: numOrNull(payload.courier_company_id || payload.courier_id),
  assignedCourierName: payload.courier_name || payload.courier || null,
  mismatch: false
});

// ---------- duplicate-request guard ----------
const LOCK_STALE_MS = 2 * 60 * 1000;

/** Atomically claims the booking lock of a document; null when another booking is running. */
const acquireBookingLock = (Model, id) => {
  const now = new Date();
  return Model.findOneAndUpdate(
    { _id: id, $or: [{ bookingLockAt: null }, { bookingLockAt: { $lt: new Date(now.getTime() - LOCK_STALE_MS) } }] },
    { $set: { bookingLockAt: now } },
    { new: true }
  );
};
const releaseBookingLock = (Model, id) => Model.updateOne({ _id: id }, { $set: { bookingLockAt: null } });

const getCourierConfig = () => SystemConfig.findOne({}).lean();

module.exports = {
  courierError,
  orderShipment,
  returnShipment,
  exchangeShipment,
  listCouriers,
  resolveSelectedCourier,
  assignAwbWithCourier,
  mismatchWarning,
  panelSelection,
  acquireBookingLock,
  releaseBookingLock,
  getCourierConfig,
  normalizeCourier
};
