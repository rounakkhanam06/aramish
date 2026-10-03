/**
 * Builds what the app sends to Shiprocket for a customer's order, in one place, so checkout,
 * the Razorpay webhook and admin's "Create order on Shiprocket" all send the same thing:
 *  - the name/phone of the address the customer selected (not the account's),
 *  - the amount still to be paid as the COD amount (after coins / Refund Wallet),
 *  - each product's own HSN code and shipping weight.
 */
const Product = require('../Models/Product');
const { parseCityState } = require('../Router/shiprocketService');

const DEFAULT_WEIGHT_KG = 0.5;
// Shiprocket requires an email and phone; these are used only when the customer has none.
const FALLBACK_EMAIL = 'customer@aramish.com';
const FALLBACK_PHONE = '9876543210';

const toShiprocketDate = (date) => new Date(date || Date.now()).toISOString().slice(0, 16).replace('T', ' ');

/** Total shipping weight (kg) and product HSN codes for a list of order items. */
const loadShippingDetails = async (items, sessionOpt = {}) => {
  const ids = [...new Set((items || []).filter(i => i.productId).map(i => String(i.productId)))];
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } }, 'shippingSpecs hsnCode', sessionOpt).lean()
    : [];
  const byId = new Map(products.map(p => [String(p._id), p]));

  let weight = 0;
  for (const item of items || []) {
    const product = byId.get(String(item.productId));
    const unitWeight = (product && product.shippingSpecs && product.shippingSpecs.weight) || DEFAULT_WEIGHT_KG;
    weight += unitWeight * (item.quantity || 1);
  }

  const hsnByProductId = {};
  for (const p of products) {
    const hsn = p.hsnCode && String(p.hsnCode).trim();
    if (hsn) hsnByProductId[String(p._id)] = hsn;
  }

  return { weight: Math.round(weight * 1000) / 1000 || DEFAULT_WEIGHT_KG, hsnByProductId };
};

/** One Shiprocket order line. The HSN is only sent when the product has one set in admin. */
const toOrderItem = ({ name, sku, units, price, productId }, hsnByProductId = {}) => {
  const line = { name, sku, units: units || 1, selling_price: price, discount: 0, tax: 0 };
  const hsn = productId && hsnByProductId[String(productId)];
  if (hsn) line.hsn = hsn;
  return line;
};

/**
 * The cheapest courier the customer can be charged for (freight, plus the courier's COD fee
 * on COD) — the same rule checkout uses to price delivery. Returns null when none are available.
 */
const cheapestCourier = (couriers, isCod) => {
  let best = null;
  for (const c of couriers || []) {
    const charge = (Number(c.freight_charge) || 0) + (isCod ? (Number(c.cod_charges) || 0) : 0);
    if (!best || charge < best.charge) best = { courier: c, charge };
  }
  return best;
};

/**
 * Shiprocket "adhoc" order payload for one of our orders.
 * `order.total` is what the customer still has to pay — on a COD order that is exactly what
 * the courier must collect. An order fully paid with coins / Refund Wallet is sent as Prepaid.
 */
const buildShiprocketOrderPayload = (order, user, { weight, hsnByProductId } = {}) => {
  const addr = order.deliveryAddress || {};
  const { city, state } = parseCityState(addr.address);
  const payable = Math.max(0, Number(order.total) || 0);
  const isCod = order.paymentMethod === 'COD' && payable > 0;
  // Prepaid: declare the full order value (what was paid in any form), for the invoice/insurance.
  const declaredValue = isCod
    ? payable
    : Math.round((payable + (Number(order.walletUsed) || 0) + (Number(order.refundWalletUsed) || 0)) * 100) / 100;

  return {
    order_id: `ORD_${order._id}`,
    order_date: toShiprocketDate(order.createdAt),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    billing_customer_name: addr.name || (user && user.name) || 'Customer',
    billing_last_name: '',
    billing_address: addr.address,
    billing_city: city,
    billing_pincode: addr.pincode,
    billing_state: state,
    billing_country: 'India',
    billing_email: (user && user.email) || FALLBACK_EMAIL,
    billing_phone: addr.phone || (user && user.phone) || FALLBACK_PHONE,
    shipping_is_billing: true,
    order_items: (order.items || []).map(item => toOrderItem({
      name: item.name,
      sku: String(item.productId),
      units: item.quantity,
      price: item.price,
      productId: item.productId
    }, hsnByProductId)),
    payment_method: isCod ? 'COD' : 'Prepaid',
    sub_total: declaredValue,
    length: 10,
    breadth: 10,
    height: 10,
    weight: weight || DEFAULT_WEIGHT_KG
  };
};

module.exports = {
  DEFAULT_WEIGHT_KG,
  FALLBACK_EMAIL,
  FALLBACK_PHONE,
  toShiprocketDate,
  loadShippingDetails,
  toOrderItem,
  cheapestCourier,
  buildShiprocketOrderPayload
};
