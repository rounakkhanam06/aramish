// Refund Wallet: actual refunded money, separate from the coins wallet, no 25% limit, and
// credited back when an order paid with it is cancelled/returned.
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
  sendNotificationToAdmins: jest.fn()
}));
jest.mock('../Router/shiprocketService', () => ({
  // A ₹0 courier keeps these money tests free of delivery charges (no courier = not deliverable).
  checkServiceability: jest.fn().mockResolvedValue({ data: { available_courier_companies: [{ courier_company_id: 1, freight_charge: 0, cod_charges: 0, etd: '3 days' }] } }),
  createShiprocketOrder: jest.fn().mockResolvedValue(null),
  parseCityState: () => ({ city: 'Indore', state: 'MP' }),
  trackAWB: jest.fn()
}));

const axios = require('axios');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');

const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const WalletTransaction = require('../Models/WalletTransaction');
const SystemConfig = require('../Models/SystemConfig');

const walletService = require('../utils/walletService');
const { handleReturnRefund, handleOrderCancellationRefunds } = require('../utils/orderHelper');
const { createOrder, getWalletPreview } = require('../Controllers/orderController');
const { createReturnRequest } = require('../Controllers/returnController');
const { getWallet } = require('../Controllers/userAuthController');

jest.setTimeout(120000);

let counter = 0;
const makeUser = async (overrides = {}) => {
  counter += 1;
  return User.create({ phone: `93${String(counter).padStart(8, '0')}`, name: `User ${counter}`, isVerified: true, walletBalance: 0, refundWalletBalance: 0, ...overrides });
};
const makeProduct = async (overrides = {}) => {
  counter += 1;
  return Product.create({
    name: `Shoe ${counter}`, category: 'Shoes', sellingPrice: 1000, mrp: 1200, stock: 50, sales: 0,
    article: `ART-R-${counter}-${Date.now()}`, sku: `SKU-R-${counter}-${Date.now()}`, shippingSpecs: { weight: 0.5 }, gstPercentage: 0, status: 'Approved', ...overrides
  });
};
const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};
const checkout = async (user, product, { quantity = 1, redeemWallet = false, redeemRefundWallet = true } = {}) => {
  const res = mockRes();
  await createOrder({
    user: { _id: user._id },
    body: {
      items: [{ productId: product._id.toString(), name: product.name, quantity }],
      total: 1,
      deliveryAddress: { name: 'A', type: 'Home', address: 'Somewhere, Indore', pincode: '452001', phone: '9999999999' },
      paymentMethod: 'COD',
      redeemWallet,
      redeemRefundWallet
    }
  }, res);
  expect(res.statusCode).toBe(201);
  return res.body.order;
};
const makeReturn = (order, user, { quantity, refundAmount, refundMethod = 'Bank' }) => ReturnRequest.create({
  orderId: order._id, userId: user._id, reason: 'Changed Mind', refundAmount, refundMethod, status: 'Approved',
  items: [{ productId: order.items[0].productId, name: 'x', price: order.items[0].price, quantity }]
});
const refundBalance = async (userId) => (await User.findById(userId)).refundWalletBalance;
const mainBalance = async (userId) => (await User.findById(userId)).walletBalance;

beforeAll(async () => { await startTestDb(); });
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => {
  await clearTestDb();
  // No platform fee / COD charge, so the order amount equals the product value (matches the spec examples)
  await SystemConfig.create({ returnWindowDays: 2, commission: 0, codChargeEnabled: false });
});

describe('2. Refunds are credited to the Refund Wallet (never the coins wallet)', () => {
  test('customer selects Wallet as refund method -> Refund Wallet ₹1,500', async () => {
    const user = await makeUser();
    const product = await makeProduct({ sellingPrice: 1500 });
    const order = await Order.create({
      userId: user._id, items: [{ productId: product._id, name: 'x', price: 1500, quantity: 1 }], total: 1500,
      deliveryAddress: { name: 'A', type: 'Home', address: 'x', pincode: '452001' }, paymentMethod: 'COD', status: 'Return Requested'
    });
    const rr = await makeReturn(order, user, { quantity: 1, refundAmount: 1500, refundMethod: 'Wallet' });

    await handleReturnRefund(rr, order);

    expect(await refundBalance(user._id)).toBe(1500);
    expect(await mainBalance(user._id)).toBe(0);
    const txn = await WalletTransaction.findOne({ userId: user._id, type: 'REFUND_WALLET_CREDIT' });
    expect(txn).toMatchObject({ wallet: 'REFUND', source: 'REFUND', amount: 1500, balanceAfter: 1500 });
    expect((await ReturnRequest.findById(rr._id)).refundWalletCreditedAmount).toBe(1500);
  });

  describe('Razorpay refund failures', () => {
    const RZP = { RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' };
    let env;
    beforeEach(() => { env = { ...process.env }; Object.assign(process.env, RZP); });
    afterEach(() => { process.env = env; jest.restoreAllMocks(); });

    const onlineOrder = (user, product, status) => Order.create({
      userId: user._id, items: [{ productId: product._id, name: 'x', price: 1500, quantity: 1 }], total: 1500,
      deliveryAddress: { name: 'A', type: 'Home', address: 'x', pincode: '452001' },
      paymentMethod: 'Online', paymentStatus: 'Paid', paymentId: `pay_${Date.now()}_${Math.random()}`, status
    });

    test('return refunded to the original payment: Razorpay fails -> Refund Wallet', async () => {
      const user = await makeUser();
      const order = await onlineOrder(user, await makeProduct(), 'Return Requested');
      const rr = await makeReturn(order, user, { quantity: 1, refundAmount: 1500, refundMethod: 'Original' });
      jest.spyOn(axios, 'get').mockRejectedValue(new Error('Razorpay down'));

      await handleReturnRefund(rr, order);
      expect(await refundBalance(user._id)).toBe(1500);
      expect(await mainBalance(user._id)).toBe(0);
    });

    test('Wallet chosen on an online order -> Refund Wallet directly (Razorpay not called)', async () => {
      const user = await makeUser();
      const order = await onlineOrder(user, await makeProduct(), 'Return Requested');
      const rr = await makeReturn(order, user, { quantity: 1, refundAmount: 1500, refundMethod: 'Wallet' });
      const post = jest.spyOn(axios, 'post');

      await handleReturnRefund(rr, order);
      expect(post).not.toHaveBeenCalled();
      expect(await refundBalance(user._id)).toBe(1500);
    });

    test('cancellation: Razorpay fails -> Refund Wallet', async () => {
      const user = await makeUser();
      const order = await onlineOrder(user, await makeProduct(), 'Processing');
      jest.spyOn(axios, 'get').mockRejectedValue(new Error('Razorpay down'));

      await handleOrderCancellationRefunds(order);
      expect(await refundBalance(user._id)).toBe(1500);
      expect(await mainBalance(user._id)).toBe(0);
    });
  });
});

describe('3. No 25% limit on the Refund Wallet (checkout)', () => {
  test('Refund Wallet ₹1,500 + product ₹1,600 -> full ₹1,500 used', async () => {
    const user = await makeUser({ refundWalletBalance: 1500 });
    const order = await checkout(user, await makeProduct({ sellingPrice: 1600 }));
    expect(order.refundWalletUsed).toBe(1500);
    expect(order.total).toBe(100);
    expect(await refundBalance(user._id)).toBe(0);
    const debit = await WalletTransaction.findOne({ userId: user._id, type: 'REFUND_WALLET_DEBIT' });
    expect(debit).toMatchObject({ wallet: 'REFUND', amount: -1500, balanceAfter: 0 });
  });

  test('Refund Wallet ₹1,500 + product ₹1,000 -> ₹1,000 used, ₹500 stays', async () => {
    const user = await makeUser({ refundWalletBalance: 1500 });
    const order = await checkout(user, await makeProduct({ sellingPrice: 1000 }));
    expect(order.refundWalletUsed).toBe(1000);
    expect(order.total).toBe(0);
    expect(await refundBalance(user._id)).toBe(500);
  });

  test('coins keep their 25% rule and Refund Wallet covers the rest; balances stay separate', async () => {
    const user = await makeUser({ walletBalance: 10000, refundWalletBalance: 5000 });
    const order = await checkout(user, await makeProduct({ sellingPrice: 10000 }), { redeemWallet: true });
    expect(order.walletUsed).toBe(2500);        // coins: 25% of ₹10,000
    expect(order.refundWalletUsed).toBe(5000);  // money: no % limit
    expect(order.total).toBe(2500);
    expect(await mainBalance(user._id)).toBe(7500);
    expect(await refundBalance(user._id)).toBe(0);
  });

  test('Refund Wallet is not used unless the customer opts in', async () => {
    const user = await makeUser({ refundWalletBalance: 1500 });
    const order = await checkout(user, await makeProduct({ sellingPrice: 1000 }), { redeemRefundWallet: false });
    expect(order.refundWalletUsed).toBe(0);
    expect(await refundBalance(user._id)).toBe(1500);
  });

  test('checkout preview shows both wallets separately', async () => {
    const user = await makeUser({ walletBalance: 1000, refundWalletBalance: 1500 });
    const product = await makeProduct({ sellingPrice: 1600 });
    const res = mockRes();
    await getWalletPreview({ user: { _id: user._id }, body: { items: [{ productId: product._id, quantity: 1 }], payableTotal: 1600 } }, res);
    expect(res.body).toMatchObject({ availableBalance: 1000, maxRedeemable: 400, refundWalletBalance: 1500, maxRefundWalletUsable: 1200 });
  });
});

describe('5. Order paid with Refund Wallet is cancelled/returned -> money back to the Refund Wallet', () => {
  test('₹1,500 wallet, ₹1,000 used, order fully returned -> back to ₹1,500', async () => {
    const user = await makeUser({ refundWalletBalance: 1500 });
    const placed = await checkout(user, await makeProduct({ sellingPrice: 1000 }));
    expect(await refundBalance(user._id)).toBe(500);

    await Order.updateOne({ _id: placed._id }, { $set: { status: 'Return Requested' } });
    const order = await Order.findById(placed._id);
    const rr = await makeReturn(order, user, { quantity: 1, refundAmount: 1000, refundMethod: 'Bank' });
    await handleReturnRefund(rr, order);

    expect(await refundBalance(user._id)).toBe(1500);
    const restore = await WalletTransaction.findOne({ userId: user._id, type: 'REFUND_WALLET_RESTORE' });
    expect(restore).toMatchObject({ wallet: 'REFUND', amount: 1000, balanceAfter: 1500 });
    expect((await ReturnRequest.findById(rr._id)).refundWalletRestoredAmount).toBe(1000);
  });

  test('cancelled order -> Refund Wallet money credited back (coins still non-returnable)', async () => {
    const user = await makeUser({ walletBalance: 4000, refundWalletBalance: 1500 });
    const placed = await checkout(user, await makeProduct({ sellingPrice: 4000 }), { redeemWallet: true });
    expect(placed.walletUsed).toBe(1000);
    expect(placed.refundWalletUsed).toBe(1500);

    await handleOrderCancellationRefunds(await Order.findById(placed._id));
    await handleOrderCancellationRefunds(await Order.findById(placed._id)); // duplicate event

    expect(await refundBalance(user._id)).toBe(1500); // money restored exactly once
    expect(await mainBalance(user._id)).toBe(3000);   // redeemed coins not restored
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_RESTORE' })).toBe(1);
  });

  test('partial returns credit back only the eligible amount, never more than was used in total', async () => {
    const user = await makeUser({ refundWalletBalance: 2000 });
    const placed = await checkout(user, await makeProduct({ sellingPrice: 1000 }), { quantity: 2 });
    expect(placed.refundWalletUsed).toBe(2000);
    await Order.updateOne({ _id: placed._id }, { $set: { status: 'Return Requested' } });
    const order = await Order.findById(placed._id);

    const first = await makeReturn(order, user, { quantity: 1, refundAmount: 1000 });
    await handleReturnRefund(first, order);
    expect(await refundBalance(user._id)).toBe(1000);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_PARTIAL_REFUND' })).toBe(1);

    // Admin approves an inflated second refund: only the ₹1,000 still outstanding comes back.
    const second = await makeReturn(order, user, { quantity: 1, refundAmount: 1500 });
    await handleReturnRefund(second, await Order.findById(placed._id));
    expect(await refundBalance(user._id)).toBe(2000);
    expect((await Order.findById(placed._id)).refundWalletRestored).toBe(2000);

    // A later cancellation of the same order cannot restore anything more.
    await handleOrderCancellationRefunds(await Order.findById(placed._id), { restoreStock: false });
    expect(await refundBalance(user._id)).toBe(2000);
  });

  test('order paid part Refund Wallet / part cash: Refund Wallet share comes back first, the rest via the chosen method', async () => {
    const user = await makeUser({ refundWalletBalance: 600 });
    const placed = await checkout(user, await makeProduct({ sellingPrice: 1000 }));
    expect(placed.refundWalletUsed).toBe(600);
    expect(placed.total).toBe(400);
    await Order.updateOne({ _id: placed._id }, { $set: { status: 'Return Requested' } });
    const order = await Order.findById(placed._id);

    const rr = await makeReturn(order, user, { quantity: 1, refundAmount: 1000, refundMethod: 'Wallet' });
    await handleReturnRefund(rr, order);

    expect(await refundBalance(user._id)).toBe(1000); // 600 restored + 400 cash refund to wallet
    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.refundWalletRestoredAmount).toBe(600);
    expect(fresh.refundWalletCreditedAmount).toBe(400);
  });

  test('return request refund amount includes Refund Wallet money (not only the cash total)', async () => {
    const user = await makeUser({ refundWalletBalance: 1000 });
    const placed = await checkout(user, await makeProduct({ sellingPrice: 1000 }));
    await Order.updateOne({ _id: placed._id }, { $set: { status: 'Delivered' } });

    const res = mockRes();
    await createReturnRequest({
      user: { _id: user._id },
      body: { orderId: placed._id.toString(), items: [{ productId: placed.items[0].productId.toString(), quantity: 1 }], reason: 'Changed Mind', refundMethod: 'Wallet' }
    }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.returnRequest.refundAmount).toBe(1000); // order.total is 0, but ₹1,000 of real money was paid
  });
});

describe('4 & 6. Separate display and transaction history', () => {
  test('wallet API returns coins and Refund Wallet separately, each with its own history', async () => {
    const user = await makeUser({ walletBalance: 300, refundWalletBalance: 1500 });
    await checkout(user, await makeProduct({ sellingPrice: 1000 }));

    const res = mockRes();
    await getWallet({ user: { id: user._id } }, res);

    expect(res.body.walletBalance).toBe(300);
    expect(res.body.refundWalletBalance).toBe(500);
    expect(res.body.walletTransactions).toHaveLength(0);
    expect(res.body.refundWalletTransactions).toHaveLength(1);
    expect(res.body.refundWalletTransactions[0]).toMatchObject({ wallet: 'REFUND', type: 'REFUND_WALLET_DEBIT', direction: 'debit', amount: 1000 });
  });
});

describe('Refund Wallet safety', () => {
  test('two simultaneous checkouts can never overdraw the Refund Wallet', async () => {
    const user = await makeUser({ refundWalletBalance: 1000 });
    const product = await makeProduct({ sellingPrice: 800 });
    const attempt = async () => {
      const res = mockRes();
      await createOrder({
        user: { _id: user._id },
        body: {
          items: [{ productId: product._id.toString(), name: product.name, quantity: 1 }], total: 1,
          deliveryAddress: { name: 'A', type: 'Home', address: 'x, Indore', pincode: '452001' }, paymentMethod: 'COD', redeemRefundWallet: true
        }
      }, res);
      return res;
    };
    const results = await Promise.all([attempt(), attempt(), attempt()]);
    const used = results.filter(r => r.statusCode === 201).reduce((s, r) => s + r.body.order.refundWalletUsed, 0);
    const balance = await refundBalance(user._id);
    expect(balance).toBeGreaterThanOrEqual(0);
    expect(walletService.roundMoney(balance + used)).toBe(1000);
  });
});
