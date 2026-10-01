// End-to-end API flow tests: real HTTP requests against the Express app (in-memory Mongo
// replica set), with every external service (Shiprocket, Razorpay, Firebase, SMS) mocked.
// Covers variant stock management across order -> cancel -> return -> exchange.

// Must be set BEFORE app.js runs dotenv.config(): dotenv never overrides existing vars, so
// this keeps live keys from .env out of the test run.
process.env.JWT_SECRET = 'test_user_secret';
process.env.JWT_ADMIN_SECRET = 'test_admin_secret';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.SHIPROCKET_WEBHOOK_SECRET = 'sr_test_secret';
process.env.SMS_INDIA_HUB_API_KEY = '';
process.env.SMS_API_KEY = '';
process.env.ENV = 'test';

jest.mock('axios');
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToAdmins: jest.fn(),
  sendNotificationToUser: jest.fn(() => Promise.resolve())
}));
jest.mock('../Router/shiprocketService', () => {
  const actual = jest.requireActual('../Router/shiprocketService');
  let n = 0;
  return {
    ...actual,
    getShiprocketToken: jest.fn(async () => null),
    checkServiceability: jest.fn(async () => ({
      data: { available_courier_companies: [{ freight_charge: 50, cod_charges: 0, etd: '3 days' }] }
    })),
    createShiprocketOrder: jest.fn(async () => ({ order_id: `SR${++n}`, shipment_id: `SH${n}` })),
    createShiprocketReturnOrder: jest.fn(async () => ({ order_id: `SRR${++n}`, shipment_id: `SHR${n}` })),
    createExchangeForwardOrder: jest.fn(async () => ({ order_id: `SRF${++n}`, shipment_id: `SHF${n}` })),
    assignAWB: jest.fn(async () => ({ response: { data: { awb_code: `AWB${++n}`, courier_name: 'TestCourier' } } }))
  };
});

const jwt = require('jsonwebtoken');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const app = require('../app');

const Order = require('../Models/Order');
const User = require('../Models/User');
const Admin = require('../Models/Admin');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const CouponUsage = require('../Models/CouponUsage');
const ReturnRequest = require('../Models/ReturnRequest');
const ExchangeRequest = require('../Models/ExchangeRequest');
const SystemConfig = require('../Models/SystemConfig');

jest.setTimeout(120000);

let server;
let baseUrl;
let counter = 0;

const api = async (method, path, { token, body, headers = {} } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  return { status: res.status, data };
};

const makeUser = async () => {
  counter += 1;
  const user = await User.create({ phone: `98${String(counter).padStart(8, '0')}`, name: `User ${counter}`, isVerified: true });
  const token = jwt.sign({ id: user._id, aud: 'user', tokenVersion: user.tokenVersion }, process.env.JWT_SECRET);
  return { user, token };
};

const makeAdmin = async () => {
  counter += 1;
  const admin = await Admin.create({ email: `admin${counter}@test.com`, password: 'Password123!' });
  return jwt.sign({ id: admin._id, aud: 'admin' }, process.env.JWT_ADMIN_SECRET);
};

const makeProduct = async (overrides = {}) => {
  counter += 1;
  return Product.create({
    name: `Shoe ${counter}`,
    category: 'Shoes',
    sellingPrice: 1000,
    mrp: 1200,
    stock: 50, // top-level stock: should be irrelevant for variant products
    sku: `P-${counter}`,
    article: `ART-${counter}`,
    shippingSpecs: { weight: 0.5 },
    status: 'Approved',
    variations: [
      { color: 'Black', size: '8', stock: 5, sku: `V-${counter}-B8` },
      { color: 'Black', size: '9', stock: 3, sku: `V-${counter}-B9` },
      { color: 'White', size: '8', stock: 1, sku: `V-${counter}-W8`, useDefaultPricing: false, mrp: 1500, sellingPrice: 1300 }
    ],
    ...overrides
  });
};

const variantStock = async (productId, sku) => {
  const p = await Product.findById(productId).lean();
  return p.variations.find(v => v.sku === sku).stock;
};

const address = { name: 'Test', type: 'Home', address: '12 MG Road, Indore, Madhya Pradesh', pincode: '452001', phone: '9999999999' };

const placeOrder = (token, items, extra = {}) => api('POST', '/orders', {
  token,
  body: {
    items: items.map(i => ({ productId: i.product._id.toString(), variationSku: i.sku, quantity: i.qty, name: i.product.name })),
    total: 1,
    deliveryAddress: address,
    paymentMethod: 'COD',
    ...extra
  }
});

// Fast-forward an order to Delivered through the admin endpoint (the real path).
const deliver = async (adminToken, orderId) => {
  for (const status of ['Processing', 'Shipped', 'Out for Delivery', 'Delivered']) {
    const r = await api('PUT', `/orders/admin/${orderId}/status`, { token: adminToken, body: { status } });
    if (r.status !== 200) throw new Error(`deliver failed at ${status}: ${r.data && r.data.message}`);
  }
};

beforeAll(async () => {
  await startTestDb();
  for (const m of [Admin, Cart(), ExchangeRequest, require('../Models/Notification')]) {
    await m.createCollection();
  }
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

function Cart() { return require('../Models/Cart'); }

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create({ returnWindowDays: 7 });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Order placement & variant stock', () => {
  test('ordering a variant decrements only that variant (not siblings, not product.stock)', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 2 }]);
    expect(r.status).toBe(201);

    const fresh = await Product.findById(p._id).lean();
    expect(fresh.variations[0].stock).toBe(3);
    expect(fresh.variations[1].stock).toBe(3);
    expect(fresh.variations[2].stock).toBe(1);
    expect(fresh.stock).toBe(7); // total of the variants, kept in sync
    expect(fresh.sales).toBe(2);
  });

  test('variant-specific price is charged, server ignores client price', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[2].sku, qty: 1 }]);
    expect(r.status).toBe(201);
    expect(r.data.order.items[0].price).toBe(1300);
    expect(r.data.order.subtotal).toBe(1300);
  });

  test('ordering more than variant stock is rejected', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[1].sku, qty: 4 }]);
    expect(r.status).toBe(409);
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(3);
  });

  test('multi-item order rolls back all stock when one line is out of stock', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [
      { product: p, sku: p.variations[0].sku, qty: 2 },
      { product: p, sku: p.variations[2].sku, qty: 5 } // only 1 in stock
    ]);
    expect(r.status).toBe(409);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(5);
    expect(await Order.countDocuments()).toBe(0);
  });

  test('negative / zero / fractional quantities are rejected and cannot inflate stock or lower the total', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const other = await makeProduct();
    for (const qty of [-2, 0.5]) {
      const r = await placeOrder(token, [
        { product: other, sku: other.variations[0].sku, qty: 1 },
        { product: p, sku: p.variations[0].sku, qty }
      ]);
      expect(r.status).toBe(400);
    }
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(5);
    expect(await Order.countDocuments()).toBe(0);
  });

  test('a variant product cannot be ordered without choosing a variant', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: null, qty: 1 }]);
    expect(r.status).toBe(400);
    expect((await Product.findById(p._id)).stock).toBe(9);
  });

  test('a non-approved (unpublished) product cannot be ordered', async () => {
    const { token } = await makeUser();
    const p = await makeProduct({ status: 'Pending' });
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    expect(r.status).toBe(400);
  });

  test('concurrent orders for the last unit: exactly one succeeds, stock never negative', async () => {
    const p = await makeProduct();
    const sku = p.variations[2].sku; // stock 1
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser()));
    const results = await Promise.all(users.map(u => placeOrder(u.token, [{ product: p, sku, qty: 1 }])));
    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(await variantStock(p._id, sku)).toBe(0);
  });

  test('COD charge, delivery, GST and platform fee are computed server-side', async () => {
    const { token } = await makeUser();
    const p = await makeProduct({ gstPercentage: 12 });
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    const o = r.data.order;
    expect(o.subtotal).toBe(1000);
    expect(o.gstAmount).toBe(120);
    expect(o.codCharge).toBe(150);
    expect(o.deliveryCharge).toBe(50);
    expect(o.total).toBe(1000 + 120 + o.platformCommission + 50 + 150);
  });

  test('coupon: applied once per user, usage restored on cancel', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    await Coupon.create({ code: 'SAVE10', type: 'Percentage', value: 10, minOrder: 500, usageLimit: 10, status: 'Active', expiry: new Date(Date.now() + 86400000) });
    const r1 = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }], { couponCode: 'save10' });
    expect(r1.status).toBe(201);
    expect(r1.data.order.discountAmount).toBe(100);
    const r2 = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }], { couponCode: 'SAVE10' });
    expect(r2.status).toBe(400);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(4); // failed order rolled back

    const c = await api('POST', `/orders/${r1.data.order._id}/cancel`, { token });
    expect(c.status).toBe(200);
    expect((await Coupon.findOne({ code: 'SAVE10' })).usage).toBe(0);
    expect(await CouponUsage.countDocuments()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Cart', () => {
  test('cart enforces per-variant stock and rejects unknown variants', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const sku = p.variations[1].sku; // 3
    expect((await api('POST', '/cart', { token, body: { productId: p._id, variationSku: sku, quantity: 2 } })).status).toBe(200);
    expect((await api('POST', '/cart', { token, body: { productId: p._id, variationSku: sku, quantity: 2 } })).status).toBe(400);
    expect((await api('PUT', '/cart', { token, body: { productId: p._id, variationSku: sku, quantity: 3 } })).status).toBe(200);
    expect((await api('PUT', '/cart', { token, body: { productId: p._id, variationSku: sku, quantity: 4 } })).status).toBe(400);
    expect((await api('POST', '/cart', { token, body: { productId: p._id, variationSku: 'NOPE', quantity: 1 } })).status).toBe(404);
  });

  test('cart rejects a variant product added without a variant', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await api('POST', '/cart', { token, body: { productId: p._id, quantity: 1 } });
    expect(r.status).toBe(400);
  });

  test('cart is cleared after a successful order', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    await api('POST', '/cart', { token, body: { productId: p._id, variationSku: p.variations[0].sku, quantity: 1 } });
    await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    const cart = await api('GET', '/cart', { token });
    expect(cart.data.data.items).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Cancellation', () => {
  test('user cancel restores variant stock and sales', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 2 }]);
    const c = await api('POST', `/orders/${r.data.order._id}/cancel`, { token });
    expect(c.status).toBe(200);
    const fresh = await Product.findById(p._id).lean();
    expect(fresh.variations[0].stock).toBe(5);
    expect(fresh.sales).toBe(0);
    // second cancel is refused and does not double-restore
    expect((await api('POST', `/orders/${r.data.order._id}/cancel`, { token })).status).toBe(400);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(5);
  });

  test('another user cannot cancel my order', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(a.token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    expect((await api('POST', `/orders/${r.data.order._id}/cancel`, { token: b.token })).status).toBe(403);
  });

  test('admin cancel restores variant stock', async () => {
    const { token } = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[1].sku, qty: 3 }]);
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(0);
    const c = await api('PUT', `/orders/admin/${r.data.order._id}/status`, { token: adminToken, body: { status: 'Cancelled' } });
    expect(c.status).toBe(200);
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(3);
  });

  test('admin delete of an active order restores VARIANT stock (not product.stock)', async () => {
    const { token } = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 2 }]);
    const d = await api('DELETE', `/orders/admin/${r.data.order._id}`, { token: adminToken });
    expect(d.status).toBe(200);
    const fresh = await Product.findById(p._id).lean();
    expect(fresh.variations[0].stock).toBe(5);
    expect(fresh.stock).toBe(9);
  });

  test('invalid admin status transitions are rejected', async () => {
    const { token } = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    expect((await api('PUT', `/orders/admin/${r.data.order._id}/status`, { token: adminToken, body: { status: 'Delivered' } })).status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Returns', () => {
  const setupDelivered = async (lines) => {
    const u = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(u.token, lines(p));
    expect(r.status).toBe(201);
    await deliver(adminToken, r.data.order._id);
    return { ...u, adminToken, p, order: r.data.order };
  };

  test('full return -> refunded restores the VARIANT stock', async () => {
    const { token, adminToken, p, order } = await setupDelivered(p => [{ product: p, sku: p.variations[0].sku, qty: 2 }]);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(3);

    const rr = await api('POST', '/returns', { token, body: { orderId: order._id, items: [{ productId: p._id, variationSku: p.variations[0].sku, quantity: 2 }], reason: 'Size/Fit Issue' } });
    expect(rr.status).toBe(201);
    const id = rr.data.returnRequest._id;
    expect((await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Approved' } })).status).toBe(200);
    expect((await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Received' } })).status).toBe(200);
    expect((await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Refunded' } })).status).toBe(200);

    const fresh = await Product.findById(p._id).lean();
    expect(fresh.variations[0].stock).toBe(5);
    expect(fresh.stock).toBe(9);
    expect((await Order.findById(order._id)).status).toBe('Refunded');
  });

  test('returning one of two variants of the same product targets the right variant', async () => {
    const { token, adminToken, p, order } = await setupDelivered(p => [
      { product: p, sku: p.variations[0].sku, qty: 1 }, // 1000
      { product: p, sku: p.variations[2].sku, qty: 1 }  // 1300
    ]);
    const rr = await api('POST', '/returns', { token, body: { orderId: order._id, items: [{ productId: p._id, variationSku: p.variations[2].sku, quantity: 1 }], reason: 'Size/Fit Issue' } });
    expect(rr.status).toBe(201);
    expect(rr.data.returnRequest.refundAmount).toBe(1300);
    const id = rr.data.returnRequest._id;
    await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Refunded' } });
    expect(await variantStock(p._id, p.variations[2].sku)).toBe(1);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(4);
  });

  test('duplicate return lines cannot exceed the ordered quantity', async () => {
    const { token, p, order } = await setupDelivered(p => [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    const rr = await api('POST', '/returns', { token, body: { orderId: order._id, items: [
      { productId: p._id, variationSku: p.variations[0].sku, quantity: 1 },
      { productId: p._id, variationSku: p.variations[0].sku, quantity: 1 }
    ], reason: 'Size/Fit Issue' } });
    expect(rr.status).toBe(400);
  });

  test('partial return leaves the order in a terminal state (cannot be cancelled/refunded again)', async () => {
    const { token, adminToken, p, order } = await setupDelivered(p => [
      { product: p, sku: p.variations[0].sku, qty: 1 },
      { product: p, sku: p.variations[1].sku, qty: 1 }
    ]);
    const rr = await api('POST', '/returns', { token, body: { orderId: order._id, items: [{ productId: p._id, variationSku: p.variations[1].sku, quantity: 1 }], reason: 'Size/Fit Issue' } });
    const id = rr.data.returnRequest._id;
    await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Approved' } });
    expect((await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Refunded' } })).status).toBe(200);
    const o = await Order.findById(order._id);
    expect(o.status).not.toBe('Return Requested');
    // admin "Cancelled" on the order must not re-run a full refund / stock restore
    await api('PUT', `/orders/admin/${order._id}/status`, { token: adminToken, body: { status: 'Cancelled' } });
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(4);
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(3);
  });

  test('cannot return an undelivered order; cannot open two returns; rejection reverts to Delivered', async () => {
    const u = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(u.token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    const body = { orderId: r.data.order._id, items: [{ productId: p._id, quantity: 1 }], reason: 'Other' };
    expect((await api('POST', '/returns', { token: u.token, body })).status).toBe(400);
    await deliver(adminToken, r.data.order._id);
    const first = await api('POST', '/returns', { token: u.token, body });
    expect(first.status).toBe(201);
    expect((await api('POST', '/returns', { token: u.token, body })).status).toBe(400);
    const rej = await api('PUT', `/returns/admin/${first.data.returnRequest._id}/status`, { token: adminToken, body: { status: 'Rejected' } });
    expect(rej.status).toBe(200);
    expect((await Order.findById(r.data.order._id)).status).toBe('Delivered');
  });

  test('return window is measured from delivery, not from the last order update', async () => {
    const { token, adminToken, p, order } = await setupDelivered(p => [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    // Pretend delivery happened 30 days ago, then some later write touched the order.
    const longAgo = new Date(Date.now() - 30 * 86400000);
    await Order.collection.updateOne({ _id: new (require('mongoose').Types.ObjectId)(order._id) }, { $set: { 'trackingHistory.$[t].timestamp': longAgo, updatedAt: new Date() } }, { arrayFilters: [{ 't.status': 'Delivered' }] });
    const rr = await api('POST', '/returns', { token, body: { orderId: order._id, items: [{ productId: p._id, quantity: 1 }], reason: 'Other' } });
    expect(rr.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Exchanges', () => {
  const setupExchange = async () => {
    const u = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(u.token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]); // B8: 5 -> 4
    await deliver(adminToken, r.data.order._id);
    const ex = await api('POST', '/exchanges', { token: u.token, body: {
      orderId: r.data.order._id,
      originalItem: { productId: p._id.toString(), variationSku: p.variations[0].sku },
      requestedVariant: { productId: p._id.toString(), sku: p.variations[1].sku }, // B9 same price
      reason: 'Size Issue',
      images: ['/uploads/x.jpg']
    } });
    expect(ex.status).toBe(201);
    return { ...u, adminToken, p, order: r.data.order, exchange: ex.data.exchangeRequest };
  };

  test('happy path: approve reserves new variant, complete restocks the returned variant', async () => {
    const { adminToken, p, exchange, order } = await setupExchange();
    const a = await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    expect(a.status).toBe(200);
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(2);
    const c = await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Completed' } });
    expect(c.status).toBe(200);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(5);
    expect((await Order.findById(order._id)).status).toBe('Exchange Completed');
  });

  test('approving twice does not reserve stock twice', async () => {
    const { adminToken, p, exchange } = await setupExchange();
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(2);
  });

  test('completing twice (or completing an un-approved exchange) does not inflate stock', async () => {
    const { adminToken, p, exchange } = await setupExchange();
    const early = await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Completed' } });
    expect(early.status).toBe(400);
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Completed' } });
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Completed' } });
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(5);
  });

  test('rejecting an approved exchange releases the reserved stock', async () => {
    const { adminToken, p, exchange } = await setupExchange();
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Cancelled', adminNotes: 'customer asked' } });
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(3);
    // cancelling again must not release again
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Failed' } });
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(3);
  });

  test('user cannot cancel (and get refunded for) an order that is in an exchange', async () => {
    const { token, adminToken, p, exchange, order } = await setupExchange();
    expect((await api('POST', `/orders/${order._id}/cancel`, { token })).status).toBe(400);
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Cancelled', adminNotes: 'x' } });
    expect((await api('POST', `/orders/${order._id}/cancel`, { token })).status).toBe(400);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(4);
  });

  test('exchange webhook rejects unauthenticated calls', async () => {
    const { adminToken, p, exchange } = await setupExchange();
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await api('POST', '/exchanges/webhook/shiprocket', { body: { order_id: `EXC_FWD_${exchange._id}`, current_status: 'Delivered' } });
    expect((await ExchangeRequest.findById(exchange._id)).status).toBe('Approved');
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(4);
  });

  test('authenticated exchange webhook Delivered completes the exchange exactly once', async () => {
    const { adminToken, p, exchange } = await setupExchange();
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    const headers = { 'x-api-key': process.env.SHIPROCKET_WEBHOOK_SECRET };
    await api('POST', '/exchanges/webhook/shiprocket', { headers, body: { order_id: `EXC_FWD_${exchange._id}`, current_status: 'Delivered' } });
    await api('POST', '/exchanges/webhook/shiprocket', { headers, body: { order_id: `EXC_FWD_${exchange._id}`, current_status: 'Delivered' } });
    expect((await ExchangeRequest.findById(exchange._id)).status).toBe('Completed');
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(5);
  });

  test('exchange to a cheaper variant is refused; out-of-stock variant is refused', async () => {
    const u = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(u.token, [{ product: p, sku: p.variations[2].sku, qty: 1 }]); // 1300, W8 -> 0
    await deliver(adminToken, r.data.order._id);
    const cheaper = await api('POST', '/exchanges', { token: u.token, body: {
      orderId: r.data.order._id,
      originalItem: { productId: p._id.toString(), variationSku: p.variations[2].sku },
      requestedVariant: { productId: p._id.toString(), sku: p.variations[0].sku },
      reason: 'Size Issue', images: ['/uploads/x.jpg']
    } });
    expect(cheaper.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Shiprocket order webhook', () => {
  test('rejects calls without the shared secret', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    const w = await api('POST', '/shiprocket/webhook', { body: { channel_order_id: `ORD_${r.data.order._id}`, current_status: 'DELIVERED' } });
    expect(w.status).toBe(401);
  });

  test('DELIVERED marks COD paid; CANCELLED for an already-refunded order does not restock again', async () => {
    const { token } = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    const headers = { 'x-api-key': process.env.SHIPROCKET_WEBHOOK_SECRET };
    await api('POST', '/shiprocket/webhook', { headers, body: { channel_order_id: `ORD_${r.data.order._id}`, current_status: 'DELIVERED' } });
    const o = await Order.findById(r.data.order._id);
    expect(o.status).toBe('Delivered');
    expect(o.paymentStatus).toBe('Paid');

    const rr = await api('POST', '/returns', { token, body: { orderId: o._id, items: [{ productId: p._id, quantity: 1 }], reason: 'Other' } });
    await api('PUT', `/returns/admin/${rr.data.returnRequest._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await api('PUT', `/returns/admin/${rr.data.returnRequest._id}/status`, { token: adminToken, body: { status: 'Refunded' } });
    const afterReturn = await variantStock(p._id, p.variations[0].sku);

    await api('POST', '/shiprocket/webhook', { headers, body: { channel_order_id: `ORD_${o._id}`, current_status: 'CANCELLED' } });
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(afterReturn);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
const expectTotalInSync = async (productId) => {
  const p = await Product.findById(productId).lean();
  expect(p.stock).toBe(p.variations.reduce((sum, v) => sum + v.stock, 0));
};

describe('Product stock total stays in sync with variants', () => {
  test('order, cancel, return and exchange all keep the total equal to the variant sum', async () => {
    const { token } = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    await expectTotalInSync(p._id);

    const cancelled = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 2 }]);
    await expectTotalInSync(p._id);
    await api('POST', `/orders/${cancelled.data.order._id}/cancel`, { token });
    await expectTotalInSync(p._id);

    const returned = await placeOrder(token, [{ product: p, sku: p.variations[1].sku, qty: 1 }]);
    await deliver(adminToken, returned.data.order._id);
    const rr = await api('POST', '/returns', { token, body: { orderId: returned.data.order._id, items: [{ productId: p._id, quantity: 1 }], reason: 'Other' } });
    await api('PUT', `/returns/admin/${rr.data.returnRequest._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await api('PUT', `/returns/admin/${rr.data.returnRequest._id}/status`, { token: adminToken, body: { status: 'Refunded' } });
    await expectTotalInSync(p._id);

    const exchanged = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    await deliver(adminToken, exchanged.data.order._id);
    const ex = await api('POST', '/exchanges', { token, body: {
      orderId: exchanged.data.order._id,
      originalItem: { productId: p._id.toString(), variationSku: p.variations[0].sku },
      requestedVariant: { productId: p._id.toString(), sku: p.variations[1].sku },
      reason: 'Size Issue', images: ['/uploads/x.jpg']
    } });
    await api('PUT', `/exchanges/admin/${ex.data.exchangeRequest._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    await expectTotalInSync(p._id);
    await api('PUT', `/exchanges/admin/${ex.data.exchangeRequest._id}/status`, { token: adminToken, body: { status: 'Completed' } });
    await expectTotalInSync(p._id);
  });
});

describe('Admin product edit cannot overwrite stock with stale data', () => {
  // Simulates the admin edit form: it loaded the product earlier and sends every variant back.
  const formVariations = (loaded, stockBySku = {}) => loaded.variations.map(v => ({
    _id: String(v._id), color: v.color, size: v.size, sku: v.sku,
    useDefaultPricing: v.useDefaultPricing, mrp: v.mrp, sellingPrice: v.sellingPrice,
    originalStock: v.stock,
    stock: stockBySku[v.sku] !== undefined ? stockBySku[v.sku] : v.stock
  }));

  test('stock untouched in the form keeps the live stock that orders changed meanwhile', async () => {
    const { token } = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const loaded = await Product.findById(p._id).lean();
    await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 2 }]); // 5 -> 3 while the form is open

    const r = await api('PUT', `/admin/catalog/products/${p._id}`, { token: adminToken, body: { name: 'Renamed', variations: formVariations(loaded) } });
    expect(r.status).toBe(200);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(3);
    expect((await Product.findById(p._id)).name).toBe('Renamed');
    await expectTotalInSync(p._id);
  });

  test('changing a variant whose live stock also moved is refused with 409', async () => {
    const { token } = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const loaded = await Product.findById(p._id).lean();
    await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 2 }]);

    const r = await api('PUT', `/admin/catalog/products/${p._id}`, { token: adminToken, body: { variations: formVariations(loaded, { [p.variations[0].sku]: 20 }) } });
    expect(r.status).toBe(409);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(3);
  });

  test('changing a variant whose live stock did not move is applied', async () => {
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const loaded = await Product.findById(p._id).lean();
    const r = await api('PUT', `/admin/catalog/products/${p._id}`, { token: adminToken, body: { variations: formVariations(loaded, { [p.variations[1].sku]: 12 }) } });
    expect(r.status).toBe(200);
    expect(await variantStock(p._id, p.variations[1].sku)).toBe(12);
    await expectTotalInSync(p._id);
  });

  test('a request without originalStock cannot change stock to a value other than the live one', async () => {
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const loaded = await Product.findById(p._id).lean();
    const vars = formVariations(loaded, { [p.variations[0].sku]: 40 }).map(({ originalStock, ...v }) => v);
    const r = await api('PUT', `/admin/catalog/products/${p._id}`, { token: adminToken, body: { variations: vars } });
    expect(r.status).toBe(409);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(5);
  });

  test('editing only the total stock of a variant product is refused', async () => {
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await api('PUT', `/admin/catalog/products/${p._id}`, { token: adminToken, body: { stock: 100 } });
    expect(r.status).toBe(400);
    expect((await Product.findById(p._id)).stock).toBe(9);
  });

  test('an order landing between the read and the save is not lost (save retries on fresh data)', async () => {
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const loaded = await Product.findById(p._id).lean();
    // Make the first save attempt see a concurrent order: decrement right after the handler reads.
    const realFindById = Product.findById.bind(Product);
    let injected = false;
    const spy = jest.spyOn(Product, 'findById').mockImplementation((...args) => {
      const q = realFindById(...args);
      if (!injected) {
        injected = true;
        return q.then(async (doc) => {
          await Product.updateOne({ _id: p._id, 'variations.sku': p.variations[0].sku }, { $inc: { 'variations.$.stock': -1, stock: -1 } });
          return doc;
        });
      }
      return q;
    });
    try {
      const r = await api('PUT', `/admin/catalog/products/${p._id}`, { token: adminToken, body: { name: 'Raced', variations: formVariations(loaded) } });
      expect(r.status).toBe(200);
    } finally {
      spy.mockRestore();
    }
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(4);
    expect((await Product.findById(p._id)).name).toBe('Raced');
    await expectTotalInSync(p._id);
  });
});

describe('COD cancellation payment status', () => {
  test('cancelled COD order with nothing collected is not marked Refunded', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]);
    await api('POST', `/orders/${r.data.order._id}/cancel`, { token });
    expect((await Order.findById(r.data.order._id)).paymentStatus).toBe('Cancelled');
  });

  test('cancelled paid online order is marked Refunded', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }], { paymentMethod: 'Online', paymentId: 'pay_test_cancel_1' });
    expect(r.status).toBe(201);
    await api('POST', `/orders/${r.data.order._id}/cancel`, { token });
    expect((await Order.findById(r.data.order._id)).paymentStatus).toBe('Refunded');
  });
});

describe('Admin refund amount limit', () => {
  const setupReturn = async (refundMethod) => {
    const u = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(u.token, [{ product: p, sku: p.variations[0].sku, qty: 1 }, { product: p, sku: p.variations[1].sku, qty: 1 }]);
    await deliver(adminToken, r.data.order._id);
    const rr = await api('POST', '/returns', { token: u.token, body: { orderId: r.data.order._id, refundMethod, items: [{ productId: p._id, variationSku: p.variations[0].sku, quantity: 1 }], reason: 'Other' } });
    expect(rr.status).toBe(201);
    return { adminToken, id: rr.data.returnRequest._id, eligible: rr.data.returnRequest.refundAmount };
  };

  test('an amount above the eligible refund is rejected and nothing changes', async () => {
    const { adminToken, id, eligible } = await setupReturn('Original');
    expect(eligible).toBe(1000);
    const r = await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Refunded', refundAmount: 5000 } });
    expect(r.status).toBe(400);
    const rr = await ReturnRequest.findById(id);
    expect(rr.status).toBe('Requested');
    expect(rr.refundAmount).toBe(1000);
  });

  test('negative or non-numeric amounts are rejected', async () => {
    const { adminToken, id } = await setupReturn('Original');
    expect((await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Approved', refundAmount: -1 } })).status).toBe(400);
    expect((await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Approved', refundAmount: 'abc' } })).status).toBe(400);
  });

  test('a lower amount (e.g. damaged item) is accepted and refunded', async () => {
    const { adminToken, id } = await setupReturn('Wallet');
    const r = await api('PUT', `/returns/admin/${id}/status`, { token: adminToken, body: { status: 'Refunded', refundAmount: 600 } });
    expect(r.status).toBe(200);
    const rr = await ReturnRequest.findById(id);
    expect(rr.refundAmount).toBe(600);
    expect(rr.refundWalletCreditedAmount).toBe(600);
  });
});

describe('Exchange price difference refund', () => {
  const setupPaidDifferenceExchange = async (paymentMethod = 'Online') => {
    const u = await makeUser();
    const adminToken = await makeAdmin();
    const p = await makeProduct();
    const r = await placeOrder(u.token, [{ product: p, sku: p.variations[0].sku, qty: 1 }]); // 1000
    await deliver(adminToken, r.data.order._id);
    const ex = await api('POST', '/exchanges', { token: u.token, body: {
      orderId: r.data.order._id,
      originalItem: { productId: p._id.toString(), variationSku: p.variations[0].sku },
      requestedVariant: { productId: p._id.toString(), sku: p.variations[2].sku }, // 1300 -> ₹300 difference
      reason: 'Size Issue', images: ['/uploads/x.jpg'],
      paymentMethod, paymentId: paymentMethod === 'Online' ? `pay_diff_${counter}` : undefined
    } });
    expect(ex.status).toBe(201);
    expect(ex.data.exchangeRequest.additionalAmount).toBe(300);
    return { ...u, adminToken, p, exchange: ex.data.exchangeRequest };
  };

  test('cancelled after approval: ₹300 refunded once (Refund Wallet when Razorpay is unavailable) and stock released', async () => {
    const { user, adminToken, p, exchange } = await setupPaidDifferenceExchange();
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    const c = await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Cancelled', adminNotes: 'no stock at warehouse' } });
    expect(c.status).toBe(200);
    expect((await ExchangeRequest.findById(exchange._id)).paymentStatus).toBe('Refunded');
    expect((await User.findById(user._id)).refundWalletBalance).toBe(300);
    expect(await variantStock(p._id, p.variations[2].sku)).toBe(1);
    // terminal: a second attempt is refused and does not refund again
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Failed' } });
    expect((await User.findById(user._id)).refundWalletBalance).toBe(300);
  });

  test('rejected request: the difference is refunded', async () => {
    const { user, adminToken, exchange } = await setupPaidDifferenceExchange();
    const r = await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Rejected', rejectionReason: 'worn item' } });
    expect(r.status).toBe(200);
    expect((await User.findById(user._id)).refundWalletBalance).toBe(300);
  });

  test('failed via webhook (both legs failed): the difference is refunded once', async () => {
    const { user, adminToken, exchange } = await setupPaidDifferenceExchange();
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Approved' } });
    const headers = { 'x-api-key': process.env.SHIPROCKET_WEBHOOK_SECRET };
    await api('POST', '/shiprocket/webhook', { headers, body: { order_id: `EXC_REV_${exchange._id}`, current_status: 'LOST' } });
    await api('POST', '/shiprocket/webhook', { headers, body: { order_id: `EXC_FWD_${exchange._id}`, current_status: 'LOST' } });
    await api('POST', '/shiprocket/webhook', { headers, body: { order_id: `EXC_FWD_${exchange._id}`, current_status: 'LOST' } });
    const ex = await ExchangeRequest.findById(exchange._id);
    expect(ex.status).toBe('Failed');
    expect(ex.paymentStatus).toBe('Refunded');
    expect((await User.findById(user._id)).refundWalletBalance).toBe(300);
  });

  test('COD difference that was never collected is not refunded, just no longer due', async () => {
    const { user, adminToken, exchange } = await setupPaidDifferenceExchange('COD');
    await api('PUT', `/exchanges/admin/${exchange._id}/status`, { token: adminToken, body: { status: 'Cancelled', adminNotes: 'x' } });
    expect((await ExchangeRequest.findById(exchange._id)).paymentStatus).toBe('Not Required');
    expect((await User.findById(user._id)).refundWalletBalance || 0).toBe(0);
  });

  test('a payment id can only pay for one exchange', async () => {
    const { token, adminToken, exchange } = await setupPaidDifferenceExchange();
    const p2 = await makeProduct();
    const r = await placeOrder(token, [{ product: p2, sku: p2.variations[0].sku, qty: 1 }]);
    await deliver(adminToken, r.data.order._id);
    const ex2 = await api('POST', '/exchanges', { token, body: {
      orderId: r.data.order._id,
      originalItem: { productId: p2._id.toString(), variationSku: p2.variations[0].sku },
      requestedVariant: { productId: p2._id.toString(), sku: p2.variations[2].sku },
      reason: 'Size Issue', images: ['/uploads/x.jpg'], paymentMethod: 'Online', paymentId: exchange.paymentId
    } });
    expect(ex2.status).toBe(400);
  });
});

describe('Checkout returns 4xx for client problems', () => {
  test('bad product id -> 400, reused payment id -> 409 with stock rolled back', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const bad = await api('POST', '/orders', { token, body: { items: [{ productId: 'not-an-id', quantity: 1 }], total: 1, deliveryAddress: address, paymentMethod: 'COD' } });
    expect(bad.status).toBe(400);
    const first = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }], { paymentMethod: 'Online', paymentId: 'pay_reuse_1' });
    expect(first.status).toBe(201);
    const again = await placeOrder(token, [{ product: p, sku: p.variations[0].sku, qty: 1 }], { paymentMethod: 'Online', paymentId: 'pay_reuse_1' });
    expect(again.status).toBe(409);
    expect(await variantStock(p._id, p.variations[0].sku)).toBe(4);
  });
});
