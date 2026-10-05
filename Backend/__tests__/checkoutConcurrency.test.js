// Production-readiness: concurrent checkouts, duplicate payment submits, and auth under DB failure.
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
  sendNotificationToAdmins: jest.fn()
}));
jest.mock('../Router/shiprocketService', () => ({
  checkServiceability: jest.fn().mockResolvedValue({ data: { available_courier_companies: [{ courier_company_id: 1, freight_charge: 0, cod_charges: 0, etd: '3 days' }] } }),
  createShiprocketOrder: jest.fn().mockResolvedValue(null),
  parseCityState: () => ({ city: 'Indore', state: 'MP' }),
  trackAWB: jest.fn()
}));
jest.mock('../utils/razorpayService', () => ({
  isRazorpayConfigured: () => true,
  verifyAndCapturePayment: jest.fn().mockResolvedValue({ status: 'captured' })
}));

const jwt = require('jsonwebtoken');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const SystemConfig = require('../Models/SystemConfig');
const { createOrder } = require('../Controllers/orderController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

jest.setTimeout(120000);

let counter = 0;
const makeUser = async () => {
  counter += 1;
  return User.create({ phone: `95${String(counter).padStart(8, '0')}`, name: `User ${counter}`, isVerified: true });
};
const makeProduct = async (overrides = {}) => {
  counter += 1;
  return Product.create({
    name: `Shoe ${counter}`, category: 'Shoes', sellingPrice: 1000, mrp: 1200, stock: 50, sales: 0,
    article: `ART-C-${counter}-${Date.now()}`, sku: `SKU-C-${counter}-${Date.now()}`, shippingSpecs: { weight: 0.5 }, gstPercentage: 0, status: 'Approved', ...overrides
  });
};
const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};
const placeOrder = async (user, product, { paymentMethod = 'COD', paymentId } = {}) => {
  const res = mockRes();
  await createOrder({
    user: { _id: user._id },
    body: {
      items: [{ productId: product._id.toString(), name: product.name, quantity: 1 }],
      total: 1,
      deliveryAddress: { name: 'A', type: 'Home', address: 'Somewhere, Indore', pincode: '452001', phone: '9999999999' },
      paymentMethod,
      paymentId
    }
  }, res);
  return res;
};

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  await startTestDb();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create({ commission: 0, codChargeEnabled: false, prepaidDiscountEnabled: false });
});

describe('concurrent checkouts', () => {
  test('10 buyers race for the last 3 pairs: exactly 3 orders, stock never negative, no crash', async () => {
    const product = await makeProduct({ stock: 3 });
    const users = await Promise.all(Array.from({ length: 10 }, makeUser));

    const results = await Promise.all(users.map((u) => placeOrder(u, product)));
    const codes = results.map((r) => r.statusCode);

    expect(codes.filter((c) => c === 201)).toHaveLength(3);
    // Losers get a clear 4xx/503, never a 500
    expect(codes.every((c) => [201, 409, 503].includes(c))).toBe(true);
    expect((await Product.findById(product._id)).stock).toBe(0);
    expect(await Order.countDocuments({})).toBe(3);
  });

  test('the same Razorpay payment submitted twice at once creates one order', async () => {
    const user = await makeUser();
    const product = await makeProduct({ stock: 10 });

    const [a, b] = await Promise.all([
      placeOrder(user, product, { paymentMethod: 'Online', paymentId: 'pay_DUPLICATE1' }),
      placeOrder(user, product, { paymentMethod: 'Online', paymentId: 'pay_DUPLICATE1' })
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    const loser = a.statusCode === 409 ? a : b;
    expect(loser.body.code).toBe('PAYMENT_ALREADY_USED');
    expect(await Order.countDocuments({ paymentId: 'pay_DUPLICATE1' })).toBe(1);
    // The losing attempt's stock decrement was rolled back
    expect((await Product.findById(product._id)).stock).toBe(9);
  });

  test('retrying a payment that already has an order is recognised, not double-charged', async () => {
    const user = await makeUser();
    const product = await makeProduct({ stock: 10 });

    expect((await placeOrder(user, product, { paymentMethod: 'Online', paymentId: 'pay_RETRY1' })).statusCode).toBe(201);
    const retry = await placeOrder(user, product, { paymentMethod: 'Online', paymentId: 'pay_RETRY1' });

    expect(retry.statusCode).toBe(409);
    expect(retry.body.code).toBe('PAYMENT_ALREADY_USED');
    expect((await Product.findById(product._id)).stock).toBe(9);
  });
});

describe('auth middleware', () => {
  const run = async (token) => {
    const res = mockRes();
    const next = jest.fn();
    await protectUser({ headers: { authorization: `Bearer ${token}` } }, res, next);
    return { res, next };
  };

  test('a database error answers 503, not 401 (which would force-logout the user)', async () => {
    const user = await makeUser();
    const token = jwt.sign({ id: user._id, phone: user.phone, tokenVersion: 0, aud: 'user' }, process.env.JWT_SECRET);
    const spy = jest.spyOn(User, 'findById').mockImplementationOnce(() => ({ select: () => Promise.reject(new Error('connection pool timeout')) }));

    const { res, next } = await run(token);
    spy.mockRestore();

    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  test('a bad token is still 401, a valid one passes', async () => {
    expect((await run('not-a-jwt')).res.statusCode).toBe(401);

    const user = await makeUser();
    const token = jwt.sign({ id: user._id, phone: user.phone, tokenVersion: user.tokenVersion || 0, aud: 'user' }, process.env.JWT_SECRET);
    const { res, next } = await run(token);
    expect(res.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
