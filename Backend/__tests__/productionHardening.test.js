// Production hardening: OTP abuse limits, public catalog caching/limits, and HTTP rate limiting.
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
  sendNotificationToAdmins: jest.fn()
}));

process.env.ENV = 'development'; // static OTP 123456, no real SMS
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const User = require('../Models/User');
const Product = require('../Models/Product');
const { sendOtp, verifyOtp } = require('../Controllers/userAuthController');
const { getHomepageData, getProducts } = require('../Controllers/productController');
const { cachePublicCatalog, clearCatalogCache } = require('../utils/catalogCache');

jest.setTimeout(120000);

const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};
const send = async (phone) => {
  const res = mockRes();
  await sendOtp({ body: { phone } }, res);
  return res;
};
const verify = async (phone, otp) => {
  const res = mockRes();
  await verifyOtp({ body: { phone, otp } }, res);
  return res;
};
// Lets the next send pass the 30s resend cooldown without waiting
const skipCooldown = (phone) => User.updateOne({ phone }, { $set: { otpLastSentAt: new Date(Date.now() - 31 * 1000) } });

const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, () => resolve(server));
});

let counter = 0;
const makeProducts = (n, overrides = {}) => Product.insertMany(Array.from({ length: n }, (_, i) => {
  counter += 1;
  return {
    name: `Shoe ${counter}`, category: 'Shoes', sellingPrice: 1000, mrp: 1200, stock: 5, status: 'Approved',
    article: `ART-H-${counter}`, sku: `SKU-H-${counter}`, shippingSpecs: { weight: 0.5 }, createdAt: new Date(Date.now() - i * 1000), ...overrides
  };
}));

beforeAll(async () => { await startTestDb(); });
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => {
  await clearTestDb();
  clearCatalogCache();
});

describe('send-otp limits', () => {
  test('enforces the 30s resend cooldown', async () => {
    expect((await send('9000000001')).statusCode).toBe(200);
    const again = await send('9000000001');
    expect(again.statusCode).toBe(429);
    expect(again.body.secondsRemaining).toBeGreaterThan(0);
  });

  test('allows 5 OTPs per hour per number, then resets after the hour', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await send('9000000002')).statusCode).toBe(200);
      await skipCooldown('9000000002');
    }
    const blocked = await send('9000000002');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body.message).toMatch(/Too many OTP requests/);

    await User.updateOne({ phone: '9000000002' }, { $set: { otpSendWindowStart: new Date(Date.now() - 61 * 60 * 1000) } });
    expect((await send('9000000002')).statusCode).toBe(200);
  });

  test('10 parallel requests for one number send exactly one OTP', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => send('9000000003')));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 429)).toHaveLength(9);
    expect((await User.findOne({ phone: '9000000003' })).otpSendCount).toBe(1);
  });
});

describe('verify-otp attempt limit', () => {
  test('5 wrong guesses discard the OTP; the right code no longer works after that', async () => {
    await send('9000000004');
    for (let left = 4; left >= 1; left--) {
      const wrong = await verify('9000000004', '000000');
      expect(wrong.statusCode).toBe(401);
      expect(wrong.body.attemptsLeft).toBe(left);
    }
    expect((await verify('9000000004', '000000')).statusCode).toBe(429);
    expect((await verify('9000000004', '123456')).statusCode).toBe(401);
    expect((await User.findOne({ phone: '9000000004' })).otp).toBeNull();
  });

  test('a burst of 50 parallel guesses only gets 5 checked', async () => {
    await send('9000000005');
    const guesses = Array.from({ length: 50 }, (_, i) => String(100000 + i)); // never 123456
    const results = await Promise.all(guesses.map((g) => verify('9000000005', g)));
    expect(results.filter((r) => r.statusCode === 401)).toHaveLength(4);
    expect(results.filter((r) => r.statusCode === 429)).toHaveLength(46);
    expect((await User.findOne({ phone: '9000000005' })).otpFailedAttempts).toBe(5);
  });

  test('the right code within the limit logs in, and a new OTP resets the counter', async () => {
    await send('9000000006');
    await verify('9000000006', '000000');
    await verify('9000000006', '000000');
    const ok = await verify('9000000006', '123456');
    expect(ok.statusCode).toBe(200);
    expect(ok.body.token).toBeTruthy();

    await skipCooldown('9000000006');
    await send('9000000006');
    expect((await User.findOne({ phone: '9000000006' })).otpFailedAttempts).toBe(0);
  });
});

describe('catalog limits', () => {
  test('homepage returns a first page plus the flagged sections, not the whole catalog', async () => {
    await makeProducts(30);
    await makeProducts(3, { flags: { crazyDeals: true } });
    const res = mockRes();
    await getHomepageData({ query: {} }, res);

    expect(res.body.products).toHaveLength(24);
    expect(res.body.totalProducts).toBe(33);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.crazyDeals).toHaveLength(3);
  });

  test('storefront product lists are capped at 100; the admin list is not', async () => {
    await makeProducts(105);
    const storefront = mockRes();
    await getProducts({ query: { status: 'Approved' } }, storefront);
    expect(storefront.body.products).toHaveLength(100);

    const page2 = mockRes();
    await getProducts({ query: { status: 'Approved', limit: '100', page: '2' } }, page2);
    expect(page2.body.products).toHaveLength(5);

    const adminScreen = mockRes();
    await getProducts({ query: {} }, adminScreen);
    expect(adminScreen.body.products).toHaveLength(105);
  });

  test('the flag filter returns only that section', async () => {
    await makeProducts(5);
    await makeProducts(2, { flags: { topSection: true } });
    const res = mockRes();
    await getProducts({ query: { status: 'Approved', flag: 'topSection' } }, res);
    expect(res.body.products).toHaveLength(2);
  });
});

describe('public catalog cache', () => {
  let server;
  let calls;
  let base;
  beforeAll(async () => {
    const app = express();
    app.get('/list', (req, res, next) => { if (req.query.admin) req.admin = {}; next(); }, cachePublicCatalog, async (req, res) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 50));
      res.status(200).json({ success: true, n: calls });
    });
    server = await listen(app);
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));
  beforeEach(() => { calls = 0; });

  test('100 concurrent requests run the handler once; a catalog change clears it', async () => {
    const bodies = await Promise.all(Array.from({ length: 100 }, () => fetch(`${base}/list`).then((r) => r.json())));
    expect(calls).toBe(1);
    expect(bodies.every((b) => b.n === 1)).toBe(true);

    clearCatalogCache();
    expect((await (await fetch(`${base}/list`)).json()).n).toBe(2);
  });

  test('admin requests bypass the cache', async () => {
    await fetch(`${base}/list?admin=1`);
    await fetch(`${base}/list?admin=1`);
    expect(calls).toBe(2);
  });
});

describe('HTTP rate limiting in the real app', () => {
  let server;
  let base;
  beforeAll(async () => {
    server = await listen(require('../app'));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  test('send-otp is limited per network across different numbers', async () => {
    const statuses = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await post('/auth/send-otp', { phone: `91000${String(i).padStart(5, '0')}` })).status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  test('admin login is limited after 10 failures', async () => {
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await post('/admin/auth/login', { email: 'nobody@example.com', password: 'wrong' })).status);
    }
    expect(statuses[10]).toBe(429);
  });
});
