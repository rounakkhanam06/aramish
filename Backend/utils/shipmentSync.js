/**
 * Keeping our records in step with Shiprocket when a courier is changed in the Shiprocket panel
 * (courier reassignment), for orders, returns and exchange legs.
 *
 *  - A new AWB / courier from a webhook or from Shiprocket's order details replaces ours; the
 *    replaced AWB goes to `awbHistory` and the selection is labelled as a panel change.
 *  - Events for a replaced AWB are stale: they must never switch the record back, or cancel it.
 *  - A "CANCELED" event is only an order cancellation if Shiprocket's order itself is cancelled —
 *    during a reassignment the old AWB is cancelled while the order goes on with a new one.
 */
const shiprocketService = require('../Router/shiprocketService');
const { panelSelection } = require('./courierSelection');

const norm = (v) => String(v || '').trim().toLowerCase();
const numOrNull = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// Field names per record type.
const ORDER_FIELDS = { awb: 'awbCode', name: 'courierName', id: 'courierId', selection: 'courierSelection', history: 'awbHistory' };
const RETURN_FIELDS = ORDER_FIELDS;
const LEG_FIELDS = { awb: 'awb', name: 'courierName', id: 'courierId', selection: 'courierSelection', history: 'awbHistory' };

/** True when `awb` is an AWB this record used before a reassignment (a stale event). */
const isSupersededAwb = (record, awb, f = ORDER_FIELDS) =>
  !!awb && String(awb) !== String(record[f.awb] || '') && (record[f.history] || []).map(String).includes(String(awb));

/**
 * Applies the courier Shiprocket reports ({ awb, courierName, courierId }) to `record`.
 * Returns { changed, reassigned, stale }. Never moves back to a replaced AWB.
 */
const applyShiprocketCourier = (record, { awb, courierName, courierId }, f = ORDER_FIELDS) => {
  const newAwb = awb ? String(awb) : null;
  const current = record[f.awb] ? String(record[f.awb]) : null;
  if (isSupersededAwb(record, newAwb, f)) return { changed: false, reassigned: false, stale: true };

  const previousName = record[f.name] || (record[f.selection] && record[f.selection].courierName) || null;
  const awbChanged = !!newAwb && newAwb !== current;
  const courierChanged = !!courierName && !!previousName && norm(courierName) !== norm(previousName);
  if (!awbChanged && !courierChanged) {
    if (courierName && !record[f.name]) record[f.name] = courierName;
    return { changed: false, reassigned: false, stale: false };
  }

  const reassigned = !!current; // there was a booking before: this is a reassignment
  if (awbChanged) {
    if (current) record[f.history] = [...(record[f.history] || []), current];
    record[f.awb] = newAwb;
  }
  const panel = panelSelection({ courier_name: courierName || previousName, courier_company_id: courierId });
  record[f.selection] = {
    ...panel,
    reassignedFrom: reassigned ? previousName : null,
    reassignedAt: reassigned ? new Date() : null
  };
  // Shiprocket webhooks usually send the courier name only: never keep the old courier's id.
  record[f.id] = numOrNull(courierId);
  if (courierName) record[f.name] = courierName;
  return { changed: true, reassigned, stale: false };
};

/** The shipment block of Shiprocket's "order details" reply: { orderStatus, awb, courierName, courierId, status }. */
const readOrderDetails = (details) => {
  const shipment = Array.isArray(details && details.shipments) ? details.shipments[0] : (details && details.shipments) || {};
  return {
    orderStatus: String((details && details.status) || '').toUpperCase(),
    awb: shipment.awb || (details && details.awb_data && details.awb_data.awb) || null,
    courierName: shipment.courier || null,
    courierId: numOrNull(shipment.courier_id),
    status: shipment.status ? String(shipment.status) : null
  };
};

/** Shiprocket's current state of one of its orders (throws when Shiprocket can't be reached). */
const fetchShiprocketShipment = async (srOrderId) => readOrderDetails(await shiprocketService.getOrderDetails(srOrderId));

const isCancelledStatus = (status) => ['CANCELED', 'CANCELLED'].includes(String(status || '').toUpperCase().trim());

module.exports = {
  ORDER_FIELDS,
  RETURN_FIELDS,
  LEG_FIELDS,
  isSupersededAwb,
  applyShiprocketCourier,
  readOrderDetails,
  fetchShiprocketShipment,
  isCancelledStatus
};
