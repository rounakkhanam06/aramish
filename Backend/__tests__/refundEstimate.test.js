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

test('customers are always refunded to the Refund/Cash Wallet, at the estimated amount (even if an old app asks for Bank)', async () => {
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
    expect(stored.refundMethod).toBe('Wallet');
    expect(stored.refundAmount).toBe(est.data.refunds.wallet);
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

describe('admin picks the refund destination when refunding', () => {
  const Admin = require('../Models/Admin');
  const makeAdminToken = async () => {
    const admin = await Admin.create({ email: `refundadmin${++n}@test.com`, password: 'Password123!' });
    return jwt.sign({ id: admin._id, aud: 'admin' }, process.env.JWT_ADMIN_SECRET);
  };
  const requestReturn = async () => {
    const { user, token } = await makeUser();
    const order = await makeOrder(user._id);
    const created = await api('POST', '/returns', token, { orderId: order._id, items: itemsOf(order), reason: 'Size/Fit Issue' });
    return { user, order, returnId: created.data.returnRequest._id };
  };

  test('admin sees the amount per destination', async () => {
    const adminToken = await makeAdminToken();
    const { returnId } = await requestReturn();
    const r = await api('GET', `/returns/admin/${returnId}`, adminToken);
    expect(r.data.refundOptions).toEqual({ wallet: 6007, bank: 5997, upi: 5997 });
  });

  test('UPI: refunds the item price only, records the UPI ID and reference, and credits no wallet', async () => {
    const adminToken = await makeAdminToken();
    const { user, returnId } = await requestReturn();
    const missing = await api('PUT', `/returns/admin/${returnId}/status`, adminToken, { status: 'Refunded', refundMethod: 'UPI' });
    expect(missing.status).toBe(400);

    const r = await api('PUT', `/returns/admin/${returnId}/status`, adminToken, {
      status: 'Refunded', refundMethod: 'UPI', bankDetails: { upiId: 'buyer@upi' }, payoutReference: 'UTR9'
    });
    expect(r.status).toBe(200);
    const stored = await ReturnRequest.findById(returnId);
    expect(stored).toMatchObject({ status: 'Refunded', refundMethod: 'UPI', refundAmount: 5997, payoutReference: 'UTR9' });
    expect(stored.bankDetails.upiId).toBe('buyer@upi');
    expect((await User.findById(user._id)).refundWalletBalance || 0).toBe(0);
  });

  test('Bank: an amount above the bank/UPI limit is refused', async () => {
    const adminToken = await makeAdminToken();
    const { returnId } = await requestReturn();
    const r = await api('PUT', `/returns/admin/${returnId}/status`, adminToken, {
      status: 'Refunded', refundMethod: 'Bank', refundAmount: 6007,
      bankDetails: { accountHolderName: 'A', accountNumber: '123', ifscCode: 'SBIN0001' }
    });
    expect(r.status).toBe(400);
    expect((await ReturnRequest.findById(returnId)).status).toBe('Requested');
  });

  test('Wallet: the full wallet amount goes to the Refund/Cash Wallet', async () => {
    const adminToken = await makeAdminToken();
    const { user, returnId } = await requestReturn();
    const r = await api('PUT', `/returns/admin/${returnId}/status`, adminToken, { status: 'Refunded', refundMethod: 'Wallet' });
    expect(r.status).toBe(200);
    expect((await User.findById(user._id)).refundWalletBalance).toBe(6007);
  });
});
