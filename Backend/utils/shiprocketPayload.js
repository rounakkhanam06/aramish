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
const DEFAULT_BOX_CM = 10; // used only when a product has no box size set in admin
// Shiprocket requires an email and phone; these are used only when the customer has none.
// Most customers sign up with a phone OTP and have no email, so their Shiprocket emails go to the
// store's own inbox (customers still get SMS updates). Never a made-up address on someone else's
// domain — those emails carry the customer's name, address and items.
const DEFAULT_STORE_EMAIL = 'aramishshoes@gmail.com';
const fallbackEmail = () =>
  (process.env.SHIPROCKET_FALLBACK_EMAIL || '').trim() || (process.env.RETURN_SHIPPING_EMAIL || '').trim() || DEFAULT_STORE_EMAIL;
const FALLBACK_PHONE = '9876543210';

const toShiprocketDate = (date) => new Date(date || Date.now()).toISOString().slice(0, 16).replace('T', ' ');

/**
 * Parcel size (cm) for a list of items, from each product's box size in admin: boxes stacked on
 * top of each other (longest length, widest width, heights added up).
 */
const packageDimensions = (items, byId) => {
  const fallback = { length: DEFAULT_BOX_CM, breadth: DEFAULT_BOX_CM, height: DEFAULT_BOX_CM };
  let length = 0, breadth = 0, height = 0;
  for (const item of items || []) {
    const s = (byId.get(String(item.productId)) || {}).shippingSpecs || {};
    if (!(s.length > 0 && s.width > 0 && s.height > 0)) return fallback;
    length = Math.max(length, s.length);
    breadth = Math.max(breadth, s.width);
    height += s.height * (item.quantity || 1);
  }
  return height > 0 ? { length, breadth, height } : fallback;
};

/**
 * What Shiprocket needs per shipment, from the products in admin: total weight (kg), parcel
 * size (cm), HSN codes and article numbers (sent as the SKU).
 */
const loadShippingDetails = async (items, sessionOpt = {}) => {
  const ids = [...new Set((items || []).filter(i => i.productId).map(i => String(i.productId)))];
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } }, 'shippingSpecs hsnCode article', sessionOpt).lean()
    : [];
  const byId = new Map(products.map(p => [String(p._id), p]));

  let weight = 0;
  for (const item of items || []) {
    const product = byId.get(String(item.productId));
    const unitWeight = (product && product.shippingSpecs && product.shippingSpecs.weight) || DEFAULT_WEIGHT_KG;
    weight += unitWeight * (item.quantity || 1);
  }

  const hsnByProductId = {};
  const articleByProductId = {};
  for (const p of products) {
    const hsn = p.hsnCode && String(p.hsnCode).trim();
    if (hsn) hsnByProductId[String(p._id)] = hsn;
    const article = p.article && String(p.article).trim();
    if (article) articleByProductId[String(p._id)] = article;
  }

  return {
    weight: Math.round(weight * 1000) / 1000 || DEFAULT_WEIGHT_KG,
    dimensions: packageDimensions(items, byId),
    hsnByProductId,
    articleByProductId
  };
};

/**
 * The SKU printed on Shiprocket's invoice and label: the article number (e.g. NCF-1004), the
 * same for every colour and size, so a product's weight is frozen in Shiprocket once per article.
 * Falls back to the variant SKU, then the product id.
 */
const itemSku = (item, articleByProductId = {}) =>
  String(item.article || articleByProductId[String(item.productId)] || item.variationSku || item.productId || 'PRODUCT');

/** Item name with its colour and size, e.g. "LACEUP BOOT (BLACK/7)", since the SKU no longer has them. */
const itemLabel = (item) => {
  const a = item.attributes || {};
  const get = (k) => {
    if (typeof a.get === 'function') return a.get(k) ?? a.get(k.toLowerCase());
    return a[k] ?? a[k.toLowerCase()];
  };
  const parts = [item.color || get('Color'), item.size || get('Size')].filter(Boolean);
  const alreadyLabelled = /\([^)]*\)\s*$/.test(item.name || '');
  return parts.length && !alreadyLabelled ? `${item.name} (${parts.join('/')})` : item.name;
};

/**
 * One Shiprocket order line. The HSN is only sent when the product has one set in admin; the SKU
 * becomes the product's article number when one is set.
 */
const toOrderItem = ({ name, sku, units, price, productId }, hsnByProductId = {}, articleByProductId = {}) => {
  const article = productId && articleByProductId[String(productId)];
  const line = { name, sku: article || sku, units: units || 1, selling_price: price, discount: 0, tax: 0 };
  const hsn = productId && hsnByProductId[String(productId)];
  if (hsn) line.hsn = hsn;
  return line;
};

/**
 * The cheapest courier by delivery (freight) charge — the same rule checkout uses to price
 * delivery. The customer is charged freight only: Shiprocket's own `cod_charges` are never
 * passed on, because COD is billed solely through the Admin-configured COD charge. (For a COD
 * order the courier list itself comes from a COD serviceability check, so the chosen courier
 * can collect cash.) Returns null when none are available.
 */
const cheapestCourier = (couriers) => {
  let best = null;
  for (const c of couriers || []) {
    const charge = Number(c.freight_charge) || 0;
    if (!best || charge < best.charge) best = { courier: c, charge };
  }
  return best;
};

/**
 * What Shiprocket charges us for shipping an order with `courier`: its freight, plus its own
 * COD fee when the courier collects cash (COD with something left to pay). Our expense only —
 * never added to the customer's bill.
 */
const shiprocketCostsFor = (courier, { isCod }) => ({
  shippingCost: Math.round((Number(courier?.freight_charge) || 0) * 100) / 100,
  shiprocketCodFee: isCod ? Math.round((Number(courier?.cod_charges) || 0) * 100) / 100 : 0
});

/**
 * Shiprocket "adhoc" order payload for one of our orders.
 * `order.total` is what the customer still has to pay — on a COD order that is exactly what
 * the courier must collect. An order fully paid with coins / Refund Wallet is sent as Prepaid.
 */
const buildShiprocketOrderPayload = (order, user, { weight, dimensions, hsnByProductId, articleByProductId } = {}) => {
  const addr = order.deliveryAddress || {};
  const { city, state } = parseCityState(addr.address);
  // Rounded to paise: stored totals can carry float leftovers (e.g. 1989.7199999999998).
  const payable = Math.max(0, Math.round((Number(order.total) || 0) * 100) / 100);
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
    billing_email: (user && user.email) || fallbackEmail(),
    billing_phone: addr.phone || (user && user.phone) || FALLBACK_PHONE,
    shipping_is_billing: true,
    order_items: (order.items || []).map(item => toOrderItem({
      name: itemLabel(item),
      sku: itemSku(item, articleByProductId),
      units: item.quantity,
      price: item.price,
      productId: item.productId
    }, hsnByProductId, articleByProductId)),
    payment_method: isCod ? 'COD' : 'Prepaid',
    sub_total: declaredValue,
    length: dimensions?.length || DEFAULT_BOX_CM,
    breadth: dimensions?.breadth || DEFAULT_BOX_CM,
    height: dimensions?.height || DEFAULT_BOX_CM,
    weight: weight || DEFAULT_WEIGHT_KG
  };
};

// The warehouse returns and exchange pickups are delivered back to. These must come from the
// server's .env — there is deliberately no made-up fallback address, since a return sent to a
// wrong address is worse than one that fails with a clear message admin can see and retry.
const RETURN_WAREHOUSE_ENV = {
  address: 'RETURN_SHIPPING_ADDRESS',
  city: 'RETURN_SHIPPING_CITY',
  state: 'RETURN_SHIPPING_STATE',
  phone: 'RETURN_SHIPPING_PHONE',
  pincode: 'SHIPROCKET_PICKUP_PINCODE'
};

/** Names of the return-warehouse settings missing from the environment (empty when all set). */
const missingReturnWarehouseSettings = () =>
  Object.values(RETURN_WAREHOUSE_ENV).filter(key => !String(process.env[key] || '').trim());

/** The return warehouse address, or throws naming the missing .env settings. */
const getReturnWarehouse = () => {
  const missing = missingReturnWarehouseSettings();
  if (missing.length) {
    throw new Error(`Return warehouse address is not configured on the server (missing ${missing.join(', ')} in .env)`);
  }
  const env = (key) => String(process.env[key]).trim();
  return {
    name: (process.env.RETURN_SHIPPING_NAME || '').trim() || 'Aramish Warehouse',
    address: env(RETURN_WAREHOUSE_ENV.address),
    address_2: (process.env.RETURN_SHIPPING_ADDRESS_2 || '').trim(),
    city: env(RETURN_WAREHOUSE_ENV.city),
    state: env(RETURN_WAREHOUSE_ENV.state),
    country: 'India',
    pincode: env(RETURN_WAREHOUSE_ENV.pincode),
    phone: env(RETURN_WAREHOUSE_ENV.phone),
    email: (process.env.RETURN_SHIPPING_EMAIL || '').trim() || fallbackEmail()
  };
};

module.exports = {
  itemSku,
  itemLabel,
  packageDimensions,
  missingReturnWarehouseSettings,
  getReturnWarehouse,
  DEFAULT_WEIGHT_KG,
  fallbackEmail,
  FALLBACK_PHONE,
  toShiprocketDate,
  loadShippingDetails,
  toOrderItem,
  cheapestCourier,
  shiprocketCostsFor,
  buildShiprocketOrderPayload
};
