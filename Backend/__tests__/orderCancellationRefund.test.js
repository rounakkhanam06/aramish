const mongoose = require('mongoose');
const axios = require('axios');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');

const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const CouponUsage = require('../Models/CouponUsage');
const WalletTransaction = require('../Models/WalletTransaction');
const SystemConfig = require('../Models/SystemConfig');

const { handleOrderCancellationRefunds } = require('../utils/orderHelper');
const { creditOrderReward } = require('../utils/walletService');

jest.setTimeout(60000);

let userCounter = 0;
let articleCounter = 0;
let couponCounter = 0;

const makeUser = async (overrides = {}) => {
  userCounter += 1;
  return User.create({
    phone: `90000${String(userCounter).padStart(5, '0')}`,
    name: 'Test User',
    walletBalance: 0,
    isVerified: true,
    ...overrides
  });
};

const makeProduct = async (overrides = {}) => {
  articleCounter += 1;
  return Product.create({
    name: 'Test Shoe',
    category: 'Shoes',
    sellingPrice: 800,
    mrp: 960,
    stock: 10,
    sales: 5,
    article: `ART-${articleCounter}-${Date.now()}`,
    shippingSpecs: { weight: 0.5 },
    ...overrides
  });
};

const makeCoupon = async (overrides = {}) => {
  couponCounter += 1;
  return Coupon.create({
    code: `TESTCODE${couponCounter}`,
    type: 'Fixed Amount',
    value: 50,
    usage: 3,
    expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides
  });
};

const makeOrder = async ({ user, product, coupon, ...overrides }) => {
  const items = overrides.items || [{
    productId: product._id,
    name: product.name,
    price: product.sellingPrice,
    mrp: product.mrp,
    quantity: 2
  }];
  return Order.create({
    userId: user._id,
    items,
    total: 100,
    deliveryAddress: { name: 'A', type: 'Home', address: 'Somewhere', pincode: '452001' },
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Shipped',
    couponCode: coupon ? coupon.code : null,
    walletUsed: 0,
    ...overrides
  });
};

const CONFIG = { welcomeBonusCoins: 1000, orderRewardPercentage: 10, orderRewardMaxCap: 400, returnWindowDays: 2 };

beforeAll(async () => {
  await startTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create(CONFIG);
});

describe('handleOrderCancellationRefunds — full successful bundle', () => {
  test('restores stock and coupon usage exactly once, and does NOT restore redeemed coins (non-returnable)', async () => {
    const user = await makeUser({ walletBalance: 200 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const coupon = await makeCoupon({ usage: 3 });
    await CouponUsage.create({ couponId: coupon._id, userId: user._id, usageCount: 1 });

    const order = await makeOrder({ user, product, coupon, walletUsed: 50 });

    await handleOrderCancellationRefunds(order);

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12); // 10 + 2
    expect(freshProduct.sales).toBe(18); // 20 - 2

    const freshCoupon = await Coupon.findById(coupon._id);
    expect(freshCoupon.usage).toBe(2); // 3 - 1
    expect(await CouponUsage.findOne({ couponId: coupon._id, userId: user._id })).toBeNull();

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(200); // the 50 coins used on the order are NOT given back
    expect(await WalletTransaction.countDocuments({ userId: user._id })).toBe(0);

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.refundProcessed).toBe(true);
    // Unpaid COD order (only non-returnable coins used): nothing was collected, so nothing refunded.
    expect(order.paymentStatus).toBe('Cancelled');
  });

  test('claws back the locked order reward when a delivered order is cancelled/refunded', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({ user, product, status: 'Delivered' }); // 2 x 800 = 1600 -> 160 coins

    await creditOrderReward(order._id);
    expect((await User.findById(user._id)).walletBalance).toBe(160);

    await handleOrderCancellationRefunds(await Order.findById(order._id));

    expect((await User.findById(user._id)).walletBalance).toBe(0);
    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.rewardDeducted).toBe(true);

    const rewardTxn = await WalletTransaction.findOne({ orderId: order._id, type: 'ORDER_REWARD_REDUCE' });
    expect(rewardTxn.amount).toBe(-160);
  });
});

describe('handleOrderCancellationRefunds — duplicate webhook / duplicate calls', () => {
  test('a second call on an already-processed order is a safe no-op', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeOrder({ user, product, status: 'Delivered' });
    await creditOrderReward(order._id);

    await handleOrderCancellationRefunds(await Order.findById(order._id));
    const afterFirst = {
      stock: (await Product.findById(product._id)).stock,
      walletBalance: (await User.findById(user._id)).walletBalance
    };

    // Simulate a duplicate webhook delivery: a fresh fetch of the same order, called again.
    await handleOrderCancellationRefunds(await Order.findById(order._id));
    const afterSecond = {
      stock: (await Product.findById(product._id)).stock,
      walletBalance: (await User.findById(user._id)).walletBalance
    };

    expect(afterSecond).toEqual(afterFirst);
    expect(await WalletTransaction.countDocuments({ orderId: order._id, type: 'ORDER_REWARD_REDUCE' })).toBe(1);
  });
});

describe('handleOrderCancellationRefunds — concurrent racing requests', () => {
  test('two simultaneous calls on the same order only let one succeed', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeOrder({ user, product, status: 'Delivered' });
    await creditOrderReward(order._id);

    const [orderCopyA, orderCopyB] = await Promise.all([Order.findById(order._id), Order.findById(order._id)]);
    await Promise.all([
      handleOrderCancellationRefunds(orderCopyA),
      handleOrderCancellationRefunds(orderCopyB)
    ]);

    expect((await Product.findById(product._id)).stock).toBe(12); // restored exactly once
    expect((await User.findById(user._id)).walletBalance).toBe(0); // clawed back once, never negative
    expect(await WalletTransaction.countDocuments({ orderId: order._id, type: 'ORDER_REWARD_REDUCE' })).toBe(1);
  });
});

describe('handleOrderCancellationRefunds — transactional rollback + retry', () => {
  test('a failure during the reward clawback rolls back stock and coupon too; retry then completes everything exactly once', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const coupon = await makeCoupon({ usage: 3 });
    await CouponUsage.create({ couponId: coupon._id, userId: user._id, usageCount: 1 });
    const order = await makeOrder({ user, product, coupon, status: 'Delivered' });
    await creditOrderReward(order._id);

    // Fail the clawback's ledger write — the last DB step of Phase 1.
    const ledgerSpy = jest.spyOn(WalletTransaction, 'create').mockImplementationOnce(() => {
      throw new Error('Simulated ledger failure');
    });
    await expect(handleOrderCancellationRefunds(await Order.findById(order._id))).rejects.toThrow('Simulated ledger failure');
    ledgerSpy.mockRestore();

    const productAfterFailure = await Product.findById(product._id);
    expect(productAfterFailure.stock).toBe(10);
    expect(productAfterFailure.sales).toBe(20);
    expect((await Coupon.findById(coupon._id)).usage).toBe(3);
    expect(await CouponUsage.findOne({ couponId: coupon._id, userId: user._id })).not.toBeNull();
    expect((await User.findById(user._id)).walletBalance).toBe(160);
    const orderAfterFailure = await Order.findById(order._id);
    expect(orderAfterFailure.refundProcessed).toBe(false);
    expect(orderAfterFailure.rewardDeducted).toBe(false);

    await handleOrderCancellationRefunds(await Order.findById(order._id));

    const productAfterRetry = await Product.findById(product._id);
    expect(productAfterRetry.stock).toBe(12);
    expect(productAfterRetry.sales).toBe(18);
    expect((await Coupon.findById(coupon._id)).usage).toBe(2);
    expect((await User.findById(user._id)).walletBalance).toBe(0);
    expect((await Order.findById(order._id)).refundProcessed).toBe(true);
    expect(await WalletTransaction.countDocuments({ orderId: order._id, type: 'ORDER_REWARD_REDUCE' })).toBe(1);
  });

  test('a failure during stock restoration itself rolls back everything (nothing else commits)', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeOrder({ user, product });

    const productUpdateSpy = jest.spyOn(Product, 'findByIdAndUpdate').mockImplementationOnce(() => {
      throw new Error('Simulated stock update failure');
    });
    await expect(handleOrderCancellationRefunds(order)).rejects.toThrow('Simulated stock update failure');
    productUpdateSpy.mockRestore();

    expect((await Order.findById(order._id)).refundProcessed).toBe(false);

    await handleOrderCancellationRefunds(await Order.findById(order._id));
    expect((await Product.findById(product._id)).stock).toBe(12);
  });

  test('a failure during coupon restoration rolls back the stock restore from the same attempt', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const coupon = await makeCoupon({ usage: 3 });
    await CouponUsage.create({ couponId: coupon._id, userId: user._id, usageCount: 1 });
    const order = await makeOrder({ user, product, coupon });

    const couponSpy = jest.spyOn(Coupon, 'findOneAndUpdate').mockImplementationOnce(() => {
      throw new Error('Simulated coupon update failure');
    });
    await expect(handleOrderCancellationRefunds(order)).rejects.toThrow('Simulated coupon update failure');
    couponSpy.mockRestore();

    expect((await Product.findById(product._id)).stock).toBe(10);
    expect((await Order.findById(order._id)).refundProcessed).toBe(false);

    await handleOrderCancellationRefunds(await Order.findById(order._id));
    expect((await Product.findById(product._id)).stock).toBe(12);
    expect((await Coupon.findById(coupon._id)).usage).toBe(2);
  });
});

describe('handleOrderCancellationRefunds — options.restoreStock=false skips stock/coupon', () => {
  test('does not touch stock or coupon usage when restoreStock is false', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const coupon = await makeCoupon({ usage: 3 });
    await CouponUsage.create({ couponId: coupon._id, userId: user._id, usageCount: 1 });
    const order = await makeOrder({ user, product, coupon, walletUsed: 30 });

    await handleOrderCancellationRefunds(order, { restoreStock: false });

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(10);
    expect(freshProduct.sales).toBe(20);
    expect((await Coupon.findById(coupon._id)).usage).toBe(3);
    expect((await User.findById(user._id)).walletBalance).toBe(0); // coins non-returnable
  });
});

describe('handleOrderCancellationRefunds — Phase 2 (money paid -> Refund/Cash Wallet)', () => {
  const RZP_ENV = { RAZORPAY_KEY_ID: 'test_key_id', RAZORPAY_KEY_SECRET: 'test_key_secret' };
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    Object.assign(process.env, RZP_ENV);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  const makeOnlineOrder = (user, product) => makeOrder({
    user, product,
    paymentMethod: 'Online',
    paymentStatus: 'Paid',
    total: 500,
    paymentId: `pay_test_${Date.now()}_${Math.random()}`
  });

  test('credits the full amount paid to the Refund/Cash Wallet and never calls Razorpay', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const order = await makeOnlineOrder(user, await makeProduct());
    const getSpy = jest.spyOn(axios, 'get');
    const postSpy = jest.spyOn(axios, 'post');

    await handleOrderCancellationRefunds(order);

    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
    expect((await Order.findById(order._id)).onlinePaymentRefundProcessed).toBe(true);
    const fresh = await User.findById(user._id);
    expect(fresh.refundWalletBalance).toBe(500);
    expect(fresh.walletBalance).toBe(0); // never the coins wallet
    const refunds = await WalletTransaction.find({ userId: user._id, type: 'REFUND_WALLET_CREDIT' });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ source: 'REFUND', wallet: 'REFUND', idempotencyKey: `CANCEL_REFUND:${order._id}` });
  });

  test('retrying after a failed wallet credit completes it exactly once', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const order = await makeOnlineOrder(user, await makeProduct());

    const ledgerSpy = jest.spyOn(WalletTransaction, 'create').mockImplementationOnce(() => {
      throw new Error('Simulated wallet credit failure');
    });
    await handleOrderCancellationRefunds(order);
    ledgerSpy.mockRestore();

    let freshOrder = await Order.findById(order._id);
    expect(freshOrder.refundProcessed).toBe(true);
    expect(freshOrder.onlinePaymentRefundProcessed).toBe(false);
    expect((await User.findById(user._id)).refundWalletBalance).toBe(0);

    await handleOrderCancellationRefunds(await Order.findById(order._id));
    await handleOrderCancellationRefunds(await Order.findById(order._id));

    freshOrder = await Order.findById(order._id);
    expect(freshOrder.onlinePaymentRefundProcessed).toBe(true);
    expect((await User.findById(user._id)).refundWalletBalance).toBe(500);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_CREDIT' })).toBe(1);
  });

  test('an unpaid COD order credits nothing; collected COD cash is credited', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const unpaid = await makeOrder({ user, product, paymentMethod: 'COD', paymentStatus: 'Pending', total: 650 });
    await handleOrderCancellationRefunds(unpaid);
    expect((await User.findById(user._id)).refundWalletBalance).toBe(0);
    expect(unpaid.paymentStatus).toBe('Cancelled');

    const collected = await makeOrder({ user, product, paymentMethod: 'COD', paymentStatus: 'Paid', total: 650 });
    await handleOrderCancellationRefunds(collected, { restoreStock: false });
    expect((await User.findById(user._id)).refundWalletBalance).toBe(650);
  });
});

describe('Refund/Cash Wallet payout to bank/UPI (admin)', () => {
  const { getRefundPayoutSummary, createRefundPayout } = require('../utils/refundPayout');

  // ₹1,000 of products, ₹15 platform fee, ₹100 prepaid discount, paid ₹915 online.
  const makePaidOrder = async (user) => makeOrder({
    user,
    items: [
      { productId: new mongoose.Types.ObjectId(), name: 'Shirt', price: 600, quantity: 1 },
      { productId: new mongoose.Types.ObjectId(), name: 'Cap', price: 200, quantity: 2 }
    ],
    subtotal: 1000, platformCommission: 15, prepaidDiscount: 100,
    paymentMethod: 'Online', paymentStatus: 'Paid', total: 915, paymentId: `pay_${Math.random()}`
  });

  test('cancelled order: wallet gets ₹915; bank/UPI payout is ₹900 (platform fee deducted), split per product', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const order = await makePaidOrder(user);
    await handleOrderCancellationRefunds(order, { restoreStock: false });

    const summary = await getRefundPayoutSummary(order._id);
    expect(summary).toMatchObject({ creditedTotal: 915, bankableTotal: 900, chargesDeductedTotal: 15, maxWalletAmount: 915 });
    expect(summary.groups[0].items.map(i => i.bankShare)).toEqual([540, 360]);

    const { quote } = await createRefundPayout({
      orderId: order._id, walletAmount: 915, method: 'UPI', bankDetails: { upiId: 'buyer@upi' }, reference: 'UTR123'
    });
    expect(quote).toEqual({ walletAmount: 915, amount: 900, deducted: 15 });
    expect((await User.findById(user._id)).refundWalletBalance).toBe(0);
    const ledger = await WalletTransaction.findOne({ userId: user._id, type: 'REFUND_WALLET_PAYOUT' });
    expect(ledger.amount).toBe(-915);

    const after = await getRefundPayoutSummary(order._id);
    expect(after.remaining).toEqual({ walletAmount: 0, amount: 0 });
    expect(after.payouts[0]).toMatchObject({ method: 'UPI', amount: 900, walletAmount: 915, reference: 'UTR123' });
    await expect(createRefundPayout({ orderId: order._id, walletAmount: 1, method: 'UPI', bankDetails: { upiId: 'buyer@upi' } }))
      .rejects.toThrow(/Nothing left to pay out/);
  });

  test('partial payouts add up exactly and never exceed the wallet balance or the order credit', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const order = await makePaidOrder(user);
    await handleOrderCancellationRefunds(order, { restoreStock: false });
    // Customer already spent ₹415 of it
    await User.updateOne({ _id: user._id }, { $set: { refundWalletBalance: 500 } });

    const bank = { accountHolderName: 'A', accountNumber: '1234567890', ifscCode: 'sbin0001' };
    await expect(createRefundPayout({ orderId: order._id, walletAmount: 600, method: 'Bank', bankDetails: bank }))
      .rejects.toThrow(/At most ₹500/);
    const first = await createRefundPayout({ orderId: order._id, walletAmount: 300, method: 'Bank', bankDetails: bank });
    expect(first.quote).toEqual({ walletAmount: 300, amount: 295.08, deducted: 4.92 });
    expect(first.payout.bankDetails.ifscCode).toBe('SBIN0001');

    await User.updateOne({ _id: user._id }, { $set: { refundWalletBalance: 1000 } });
    const second = await createRefundPayout({ orderId: order._id, walletAmount: 615, method: 'Bank', bankDetails: bank });
    expect(second.quote.amount).toBe(604.92); // remainder: totals are exactly ₹915 -> ₹900
    const summary = await getRefundPayoutSummary(order._id);
    expect(summary.paidOut).toEqual({ walletAmount: 915, amount: 900 });
  });

  test('validates the payout details', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const order = await makePaidOrder(user);
    await handleOrderCancellationRefunds(order, { restoreStock: false });
    await expect(createRefundPayout({ orderId: order._id, walletAmount: 10, method: 'UPI', bankDetails: { upiId: 'nope' } })).rejects.toThrow(/UPI/);
    await expect(createRefundPayout({ orderId: order._id, walletAmount: 10, method: 'Bank', bankDetails: { accountNumber: '1' } })).rejects.toThrow(/IFSC/);
    await expect(createRefundPayout({ orderId: order._id, walletAmount: 10, method: 'Cash' })).rejects.toThrow(/Bank or UPI/);
  });
});
