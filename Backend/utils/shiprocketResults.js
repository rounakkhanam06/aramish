/**
 * Reading Shiprocket's replies. Shiprocket reports most failures (low wallet balance, courier
 * not serviceable, ...) inside a normal HTTP 200 body, so a reply alone is never success — each
 * step is checked for its real result here, the same way for orders, returns and exchanges.
 */

const srErrorMessage = (err) => err.response?.data?.message || err.message;

/** Returns { awbInfo } when an AWB was really assigned, otherwise { error }. */
const readAwbResult = (data) => {
  const awbInfo = data?.response?.data;
  if (awbInfo?.awb_code) return { awbInfo };
  return { error: awbInfo?.awb_assign_error || data?.message || 'Shiprocket did not assign an AWB' };
};

/** Pickup succeeded when Shiprocket confirms it (pickup_status 1). */
const readPickupResult = (data) => {
  if (data?.pickup_status === 1) return {};
  const detail = data?.response?.data;
  return { error: (typeof detail === 'string' && detail) || data?.message || 'Shiprocket did not schedule the pickup' };
};

/** "Already in pickup queue" / "pickup already scheduled": the pickup exists, so it counts as success. */
const isPickupAlreadyScheduled = (message) =>
  /already in pickup queue|pickup (is )?already (been )?(scheduled|generated|requested)|already (scheduled|generated) for pickup/i
    .test(String(message || ''));

/** Returns { labelUrl } when a label was really created, otherwise { error }. */
const readLabelResult = (data, shipmentId) => {
  if (data?.label_created === 1 && data.label_url) return { labelUrl: data.label_url };
  const reason = data?.not_created?.[shipmentId] || data?.response || data?.message;
  return { error: reason || 'Shiprocket did not generate the label' };
};

/**
 * Requests the courier pickup for a shipment that already has an AWB.
 * Resolves to { scheduled: true, data } or { scheduled: false, error, data }; never throws.
 */
const requestPickupChecked = async (shiprocketService, shipmentId) => {
  try {
    const data = await shiprocketService.requestPickup(shipmentId);
    const { error } = readPickupResult(data);
    if (!error || isPickupAlreadyScheduled(error)) return { scheduled: true, data };
    return { scheduled: false, error, data };
  } catch (err) {
    const message = srErrorMessage(err);
    if (isPickupAlreadyScheduled(message)) return { scheduled: true, data: err.response?.data };
    return { scheduled: false, error: message, data: err.response?.data || null };
  }
};

/** Shiprocket tracking statuses that mean the courier pickup is booked or already done. */
const PICKUP_BOOKED_OR_LATER = /PICKUP SCHEDULED|PICKUP GENERATED|PICKUP QUEUED|OUT FOR PICKUP|PICKED UP|IN TRANSIT|SHIPPED|REACHED|OUT FOR DELIVERY|DELIVERED/;

module.exports = {
  srErrorMessage,
  readAwbResult,
  readPickupResult,
  isPickupAlreadyScheduled,
  readLabelResult,
  requestPickupChecked,
  PICKUP_BOOKED_OR_LATER
};
