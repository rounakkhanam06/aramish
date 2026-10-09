// Full Return & Exchange lifecycles over real HTTP (in-memory Mongo, Shiprocket mocked), for both
// ways an order reaches the customer: delivered by admin status update ("manual"/quick delivery)
// and delivered through Shiprocket webhooks. Covers approval, rejection, cancellation, pickup,
// item receipt, refund and replacement delivery, plus the return status history.

process.env.JWT_SECRET = 'test_user_secret';
process.env.JWT_ADMIN_SECRET = 'test_admin_secret';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.SHIPROCKET_WEBHOOK_SECRET = 'sr_test_secret';
process.env.SMS_INDIA_HUB_API_KEY = '';
process.env.SMS_API_KEY = '';
process.env.ENV = 'test';
Object.assign(process.env, {
  RETURN_SHIPPING_NAME: 'Aramish Shoes',
  RETURN_SHIPPING_ADDRESS: 'Khoja Haveli, 1/85, MG Rd',
  RETURN_SHIPPING_CITY: 'Agra',
  RETURN_SHIPPING_STATE: 'Uttar Pradesh',
  RETURN_SHIPPING_PHONE: '8650209559',
  SHIPROCKET_PICKUP_PINCODE: '282010'
});

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
    assignAWB: jest.fn(async () => ({ response: { data: { awb_code: `AWB${++n}`, courier_name: 'TestCourier' } } })),
    requestPickup: jest.fn(async () => ({ pickup_status: 1, response: { pickup_scheduled_date: '2026-10-10' } })),
    cancelShiprocketOrder: jest.fn(async () => ({ message: 'Order cancelled' }))
  };
});

const jwt = require('jsonwebtoken');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const app = require('../app');
const shiprocketService = require('../Router/shiprocketService');

const Order = require('../Models/Order');
const User = require('../Models/User');
const Admin = require('../Models/Admin');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const ExchangeRequest = require('../Models/ExchangeRequest');
const SystemConfig = require('../Models/SystemConfig');

jest.setTimeout(120000);

let server;
let baseUrl;
let counter = 0;
const webhookHeaders = { 'x-api-key': 'sr_test_secret' };

const api = async (method, path, { token, body, headers = {} } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  return { status: res.status, data };
};

const makeUser = async () => {
  counter += 1;
  const user = await User.create({ phone: `97${String(counter).padStart(8, '0')}`, name: `User ${counter}`, isVerified: true });
  return jwt.sign({ id: user._id, aud: 'user', tokenVersion: user.tokenVersion }, process.env.JWT_SECRET);
};

const makeAdmin = async () => {
  counter += 1;
  const admin = await Admin.create({ email: `flowadmin${counter}@test.com`, password: 'Password123!' });
  return jwt.sign({ id: admin._id, aud: 'admin' }, process.env.JWT_ADMIN_SECRET);
};

const makeProduct = async () => {
  counter += 1;
  return Product.create({
    name: `Shoe ${counter}`, category: 'Shoes', sellingPrice: 1000, mrp: 1200, stock: 8,
    sku: `P-${counter}`, article: `ART-${counter}`, shippingSpecs: { weight: 0.5 }, status: 'Approved',
    variations: [
      { color: 'Brown', size: '6', stock: 5, sku: `V-${counter}-B6` },
      { color: 'Brown', size: '7', stock: 3, sku: `V-${counter}-B7` }
    ]
  });
};

const variantStock = async (productId, sku) =>
  (await Product.findById(productId).lean()).variations.find(v => v.sku === sku).stock;

const orderWebhook = (orderId, current_status) =>
  api('POST', '/shiprocket/webhook', { headers: webhookHeaders, body: { channel_order_id: `ORD_${orderId}`, current_status } });
// Shiprocket posts return and exchange shipments to the same single webhook URL.
const returnWebhook = (returnId, current_status) =>
  api('POST', '/shiprocket/webhook', { headers: webhookHeaders, body: { order_id: `RET_${returnId}`, current_status, is_return: 1 } });
const exchangeWebhook = (exchangeId, leg, current_status) =>
  api('POST', '/shiprocket/webhook', { headers: webhookHeaders, body: { order_id: `EXC_${leg === 'reverse' ? 'REV' : 'FWD'}_${exchangeId}`, current_status } });

const DELIVERY_MODES = {
  // Quick delivery: admin moves the order along by hand, no courier tracking.
  manual: async (adminToken, orderId) => {
    for (const status of ['Processing', 'Shipped', 'Out for Delivery', 'Delivered']) {
      const r = await api('PUT', `/orders/admin/${orderId}/status`, { token: adminToken, body: { status } });
      if (r.status !== 200) throw new Error(`manual delivery failed at ${status}: ${r.data && r.data.message}`);
    }
  },
  shiprocket: async (adminToken, orderId) => {
    for (const status of ['SHIPPED', 'IN TRANSIT', 'OUT FOR DELIVERY', 'DELIVERED']) {
      const r = await orderWebhook(orderId, status);
      if (r.status !== 200) throw new Error(`Shiprocket delivery failed at ${status}`);
    }
  }
};

const setupDelivered = async (mode) => {
  const token = await makeUser();
  const adminToken = await makeAdmin();
  const p = await makeProduct();
  const placed = await api('POST', '/orders', { token, body: {
    items: [{ productId: p._id.toString(), variationSku: p.variations[0].sku, quantity: 1, name: p.name }],
    total: 1, paymentMethod: 'COD',
    deliveryAddress: { name: 'Test', type: 'Home', address: '12 MG Road, Agra, Uttar Pradesh', pincode: '282002', phone: '9999999999' }
  } });
  expect(placed.status).toBe(201);
  const orderId = placed.data.order._id;
  await DELIVERY_MODES[mode](adminToken, orderId);
  const order = await Order.findById(orderId);
  expect(order.status).toBe('Delivered');
  return { token, adminToken, p, orderId, B6: p.variations[0].sku, B7: p.variations[1].sku };
};

const requestReturn = (ctx) => api('POST', '/returns', { token: ctx.token, body: {
  orderId: ctx.orderId, items: [{ productId: ctx.p._id, variationSku: ctx.B6, quantity: 1 }], reason: 'Size/Fit Issue', refundMethod: 'Wallet'
} });
const setReturnStatus = (ctx, id, status, extra = {}) =>
  api('PUT', `/returns/admin/${id}/status`, { token: ctx.adminToken, body: { status, ...extra } });

const requestExchange = (ctx) => api('POST', '/exchanges', { token: ctx.token, body: {
  orderId: ctx.orderId,
  originalItem: { productId: ctx.p._id.toString(), variationSku: ctx.B6 },
  requestedVariant: { productId: ctx.p._id.toString(), sku: ctx.B7 },
  reason: 'Size Issue', images: ['/uploads/x.jpg']
} });
const setExchangeStatus = (ctx, id, status, extra = {}) =>
  api('PUT', `/exchanges/admin/${id}/status`, { token: ctx.adminToken, body: { status, ...extra } });

beforeAll(async () => {
  await startTestDb();
  for (const m of [Admin, ExchangeRequest, require('../Models/Cart'), require('../Models/Notification')]) {
    await m.createCollection();
  }
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  await ExchangeRequest.deleteMany({});
  jest.clearAllMocks();
  await SystemConfig.create({ returnWindowDays: 7, freeShippingEnabled: false });
});

describe.each(['manual', 'shiprocket'])('Return flow — %s delivery', (mode) => {
  test('request → approve → courier pickup → received → refund, with a dated history of every stage', async () => {
    const ctx = await setupDelivered(mode);
    expect(await variantStock(ctx.p._id, ctx.B6)).toBe(4);

    const rr = await requestReturn(ctx);
    expect(rr.status).toBe(201);
    const id = rr.data.returnRequest._id;
    expect((await Order.findById(ctx.orderId)).status).toBe('Return Requested');

    // Approval books the reverse pickup straight away (AWB + pickup request)
    expect((await setReturnStatus(ctx, id, 'Approved')).status).toBe(200);
    let ret = await ReturnRequest.findById(id);
    expect(ret.status).toBe('Pick-up Scheduled');
    expect(ret.awbCode).toMatch(/^AWB/);
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith(ret.shiprocketReturnShipmentId);

    // Courier collects it and delivers it to the warehouse
    await returnWebhook(id, 'PICKED UP');
    await returnWebhook(id, 'IN TRANSIT');
    expect((await ReturnRequest.findById(id)).status).toBe('Pick-up Scheduled');
    await returnWebhook(id, 'DELIVERED');
    expect((await ReturnRequest.findById(id)).status).toBe('Received');
    // A return reaching the warehouse is not an order delivery
    expect((await Order.findById(ctx.orderId)).status).toBe('Return Requested');

    expect((await setReturnStatus(ctx, id, 'Refunded')).status).toBe(200);
    ret = await ReturnRequest.findById(id);
    expect(ret.status).toBe('Refunded');
    expect((await Order.findById(ctx.orderId)).status).toBe('Refunded');
    expect(await variantStock(ctx.p._id, ctx.B6)).toBe(5);

    expect(ret.statusHistory.map(h => [h.status, h.actor])).toEqual([
      ['Requested', 'customer'],
      ['Approved', 'admin'],
      ['Pick-up Scheduled', 'system'],
      ['Received', 'courier'],
      ['Refunded', 'admin']
    ]);
    const times = ret.statusHistory.map(h => h.timestamp.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    // The customer's endpoint returns the history for the tracking page
    const mine = await api('GET', `/returns/by-order/${ctx.orderId}`, { token: ctx.token });
    expect(mine.data.returnRequest.statusHistory).toHaveLength(5);
  });

  test('admin can mark it received by hand when no courier update arrives', async () => {
    const ctx = await setupDelivered(mode);
    const id = (await requestReturn(ctx)).data.returnRequest._id;
    await setReturnStatus(ctx, id, 'Approved');
    expect((await setReturnStatus(ctx, id, 'Received', { adminNotes: 'Dropped at store' })).status).toBe(200);
    const ret = await ReturnRequest.findById(id);
    expect(ret.statusHistory.at(-1)).toMatchObject({ status: 'Received', actor: 'admin', note: 'Dropped at store' });
  });

  test('rejection puts the order back to Delivered, and the customer can ask again inside the window', async () => {
    const ctx = await setupDelivered(mode);
    const first = await requestReturn(ctx);
    const rej = await setReturnStatus(ctx, first.data.returnRequest._id, 'Rejected', { adminNotes: 'Worn item' });
    expect(rej.status).toBe(200);
    expect((await Order.findById(ctx.orderId)).status).toBe('Delivered');
    const ret = await ReturnRequest.findById(first.data.returnRequest._id);
    expect(ret.statusHistory.map(h => h.status)).toEqual(['Requested', 'Rejected']);
    expect(await variantStock(ctx.p._id, ctx.B6)).toBe(4);

    expect((await requestReturn(ctx)).status).toBe(201);
  });
});

describe.each(['manual', 'shiprocket'])('Exchange flow — %s delivery', (mode) => {
  test('request → approve → old item picked up → replacement dispatched → delivered', async () => {
    const ctx = await setupDelivered(mode);
    const ex = await requestExchange(ctx);
    expect(ex.status).toBe(201);
    const id = ex.data.exchangeRequest._id;

    expect((await setExchangeStatus(ctx, id, 'Approved')).status).toBe(200);
    expect(await variantStock(ctx.p._id, ctx.B7)).toBe(2); // replacement reserved
    expect((await Order.findById(ctx.orderId)).status).toBe('Exchange Approved');

    await exchangeWebhook(id, 'reverse', 'Picked Up');
    expect((await ExchangeRequest.findById(id)).status).toBe('Old Item Picked Up');
    await exchangeWebhook(id, 'forward', 'In Transit');
    expect((await ExchangeRequest.findById(id)).status).toBe('Replacement Dispatched');
    await exchangeWebhook(id, 'forward', 'Delivered');
    await exchangeWebhook(id, 'forward', 'Delivered'); // duplicate webhook is a no-op

    const done = await ExchangeRequest.findById(id);
    expect(done.status).toBe('Completed');
    expect(done.timeline.map(t => t.status)).toEqual(['Requested', 'Approved', 'Old Item Picked Up', 'Replacement Dispatched', 'Completed']);
    expect((await Order.findById(ctx.orderId)).status).toBe('Exchange Completed');
    expect(await variantStock(ctx.p._id, ctx.B6)).toBe(5); // old item back in stock once
    expect(await variantStock(ctx.p._id, ctx.B7)).toBe(2);
  });

  test('rejection puts the order back to Delivered and a return is then allowed', async () => {
    const ctx = await setupDelivered(mode);
    const id = (await requestExchange(ctx)).data.exchangeRequest._id;
    expect((await setExchangeStatus(ctx, id, 'Rejected', { rejectionReason: 'Item used' })).status).toBe(200);
    expect((await Order.findById(ctx.orderId)).status).toBe('Delivered');
    expect(await variantStock(ctx.p._id, ctx.B7)).toBe(3);
    expect((await requestReturn(ctx)).status).toBe(201);
  });

  test('cancellation releases the reserved stock, cancels both Shiprocket shipments and re-opens the order', async () => {
    const ctx = await setupDelivered(mode);
    const id = (await requestExchange(ctx)).data.exchangeRequest._id;
    await setExchangeStatus(ctx, id, 'Approved');
    const approved = await ExchangeRequest.findById(id);
    expect(await variantStock(ctx.p._id, ctx.B7)).toBe(2);

    const c = await setExchangeStatus(ctx, id, 'Cancelled', { adminNotes: 'Customer changed mind' });
    expect(c.status).toBe(200);

    const cancelled = await ExchangeRequest.findById(id);
    expect(cancelled.status).toBe('Cancelled');
    expect(cancelled.inventoryReservation.released).toBe(true);
    expect(cancelled.reverse.status).toBe('Cancelled');
    expect(cancelled.forward.status).toBe('Cancelled');
    expect(shiprocketService.cancelShiprocketOrder).toHaveBeenCalledWith(approved.reverse.orderId);
    expect(shiprocketService.cancelShiprocketOrder).toHaveBeenCalledWith(approved.forward.orderId);
    expect(await variantStock(ctx.p._id, ctx.B7)).toBe(3); // reservation released
    expect(await variantStock(ctx.p._id, ctx.B6)).toBe(4); // customer still has the original
    expect((await Order.findById(ctx.orderId)).status).toBe('Delivered');

    // A late courier update for the cancelled shipments changes nothing
    await exchangeWebhook(id, 'reverse', 'Cancelled');
    expect((await ExchangeRequest.findById(id)).status).toBe('Cancelled');
    expect(await variantStock(ctx.p._id, ctx.B7)).toBe(3);

    // The customer may now return the item...
    const rr = await requestReturn(ctx);
    expect(rr.status).toBe(201);
  });

  test('after a cancellation the customer can open a new exchange', async () => {
    const ctx = await setupDelivered(mode);
    const id = (await requestExchange(ctx)).data.exchangeRequest._id;
    await setExchangeStatus(ctx, id, 'Cancelled', { adminNotes: 'Wrong size picked' });
    expect(shiprocketService.cancelShiprocketOrder).not.toHaveBeenCalled(); // nothing was shipped yet
    const again = await requestExchange(ctx);
    expect(again.status).toBe(201);
    const latest = await api('GET', `/exchanges/by-order/${ctx.orderId}`, { token: ctx.token });
    expect(latest.data.exchangeRequest._id).toBe(again.data.exchangeRequest._id);
  });

  test('cannot be cancelled once the old item is with the courier', async () => {
    const ctx = await setupDelivered(mode);
    const id = (await requestExchange(ctx)).data.exchangeRequest._id;
    await setExchangeStatus(ctx, id, 'Approved');
    await exchangeWebhook(id, 'reverse', 'Picked Up');

    const c = await setExchangeStatus(ctx, id, 'Cancelled', { adminNotes: 'too late' });
    expect(c.status).toBe(400);
    expect((await ExchangeRequest.findById(id)).status).toBe('Old Item Picked Up');
    expect(await variantStock(ctx.p._id, ctx.B7)).toBe(2);
    expect(shiprocketService.cancelShiprocketOrder).not.toHaveBeenCalled();
  });

  test('a cancelled exchange does not extend the return window', async () => {
    const ctx = await setupDelivered(mode);
    const id = (await requestExchange(ctx)).data.exchangeRequest._id;
    await setExchangeStatus(ctx, id, 'Cancelled', { adminNotes: 'x' });
    // Delivered 30 days ago
    await Order.collection.updateOne(
      { _id: new (require('mongoose').Types.ObjectId)(ctx.orderId) },
      { $set: { 'trackingHistory.$[t].timestamp': new Date(Date.now() - 30 * 86400000) } },
      { arrayFilters: [{ 't.status': { $in: ['Delivered', 'DELIVERED'] } }] }
    );
    expect((await requestReturn(ctx)).status).toBe(400);
    expect((await requestExchange(ctx)).status).toBe(400);
  });
});
