// The return screen's per-destination refund amounts come from the server and must equal what a
// return request then records (no over-promising, e.g. the COD charge is never refunded).
process.env.JWT_SECRET = 'test_user_secret';
process.env.JWT_ADMIN_SECRET = 'test_admin_secret';
process.env.ENV = 'test';

jest.mock('axios');
jest.mock('../Router/firebaseAdmin', () => ({ sendNotificationToAdmins: jest.fn(), sendNotificationToUser: jest.fn(() => Promise.resolve()) }));

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const app = require('../app');
const Order = require('../Models/Order');
const User = require('../Models/User');
const ReturnRequest = require('../Models/ReturnRequest');
const SystemConfig = require('../Models/SystemConfig');

jest.setTimeout(120000);

let server;
let baseUrl;
let n = 0;

const api = async (method, path, token, body) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const makeUser = async () => {
  const user = await User.create({ phone: `95${String(++n).padStart(8, '0')}`, name: `U${n}`, isVerified: true });
  return { user, token: jwt.sign({ id: user._id, aud: 'user', tokenVersion: user.tokenVersion }, process.env.JWT_SECRET) };
};

// Same shape as return RET-703A14: three boots, ₹10 platform fee, ₹50 COD charge, ₹6,057 paid.
const makeOrder = (userId) => Order.create({
  userId,
  items: [
    { productId: new mongoose.Types.ObjectId(), name: 'Chelsea', price: 2299, quantity: 1, variationSku: 'CH-5' },
    { productId: new mongoose.Types.ObjectId(), name: 'Laceup', price: 1799, quantity: 1, variationSku: 'LA-5' },
    { productId: new mongoose.Types.ObjectId(), name: 'Chukka', price: 1899, quantity: 1, variationSku: 'CK-5' }
  ],
  subtotal: 5997, platformCommission: 10, codCharge: 50, deliveryCharge: 0, total: 6057,
  deliveryAddress: { name: 'A', type: 'Home', address: 'Indore', pincode: '452001' },
  paymentMethod: 'COD', paymentStatus: 'Paid', status: 'Delivered',
  trackingHistory: [{ status: 'DELIVERED', timestamp: new Date() }]
});
const itemsOf = (order, idx = [0, 1, 2]) => idx.map(i => ({ productId: String(order.items[i].productId), variationSku: order.items[i].variationSku, quantity: 1 }));

beforeAll(async () => {
  await startTestDb();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create({ returnWindowDays: 7 });
});

test('full return: Refund Wallet adds the platform fee (never the COD charge); Bank/UPI item price only', async () => {
  const { user, token } = await makeUser();
  const order = await makeOrder(user._id);
  const r = await api('POST', '/returns/refund-estimate', token, { orderId: order._id, items: itemsOf(order) });
  expect(r.status).toBe(200);
  expect(r.data).toMatchObject({ isFullReturn: true, refunds: { wallet: 6007, bank: 5997, upi: 5997 }, walletExtra: 10 });
});

test('partial return: no extra with the wallet (fees are only refunded on a full return)', async () => {
  const { user, token } = await makeUser();
  const order = await makeOrder(user._id);
  const r = await api('POST', '/returns/refund-estimate', token, { orderId: order._id, items: itemsOf(order, [0]) });
  expect(r.data).toMatchObject({ isFullReturn: false, refunds: { wallet: 2299, bank: 2299 }, walletExtra: 0 });
});

test('the estimate equals what the return request records, for each destination', async () => {
  for (const method of ['Wallet', 'Bank']) {
    await clearTestDb();
    await SystemConfig.create({ returnWindowDays: 7 });
    const { user, token } = await makeUser();
    const order = await makeOrder(user._id);
    const est = await api('POST', '/returns/refund-estimate', token, { orderId: order._id, items: itemsOf(order) });
    const created = await api('POST', '/returns', token, {
      orderId: order._id, items: itemsOf(order), reason: 'Size/Fit Issue', refundMethod: method,
      ...(method === 'Bank' ? { bankDetails: { upiId: 'buyer@upi' } } : {})
    });
    expect(created.status).toBe(201);
    const stored = await ReturnRequest.findById(created.data.returnRequest._id);
    expect(stored.refundAmount).toBe(method === 'Wallet' ? est.data.refunds.wallet : est.data.refunds.bank);
  }
});

test('only the order owner can ask, and items are validated like a real return', async () => {
  const { user, token } = await makeUser();
  const other = await makeUser();
  const order = await makeOrder(user._id);
  expect((await api('POST', '/returns/refund-estimate', other.token, { orderId: order._id, items: itemsOf(order) })).status).toBe(403);
  expect((await api('POST', '/returns/refund-estimate', null, { orderId: order._id, items: itemsOf(order) })).status).toBe(401);
  const bad = await api('POST', '/returns/refund-estimate', token, { orderId: order._id, items: [{ productId: String(new mongoose.Types.ObjectId()), quantity: 1 }] });
  expect(bad.status).toBe(400);
  const tooMany = await api('POST', '/returns/refund-estimate', token, { orderId: order._id, items: [{ ...itemsOf(order, [0])[0], quantity: 2 }] });
  expect(tooMany.status).toBe(400);
});
