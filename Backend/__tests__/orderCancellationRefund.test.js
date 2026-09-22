const mongoose = require('mongoose');
const axios = require('axios');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');

const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const CouponUsage = require('../Models/CouponUsage');
const WalletTransaction = require('../Models/WalletTransaction');
const CoinTransaction = require('../Models/CoinTransaction');
const SystemConfig = require('../Models/SystemConfig');

const { handleOrderCancellationRefunds } = require('../utils/orderHelper');
const { creditOrderReward, deductOrderReward } = require('../utils/rewardService');

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
    welcomeBonusRemaining: 0,
    referralCoins: 0,
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
    welcomeCoinsUsed: 0,
    referralCoinsUsed: 0,
    ...overrides
  });
};

beforeAll(async () => {
  await startTestDb();
  // Config used by orderHelper.js / rewardService.js
  await SystemConfig.create({ welcomeBonusCoins: 1000, rewardCoinsPerDeliveredOrder: 100, returnWindowDays: 2 });
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create({ welcomeBonusCoins: 1000, rewardCoinsPerDeliveredOrder: 100, returnWindowDays: 2 });
});

describe('handleOrderCancellationRefunds — full successful bundle', () => {
  test('restores stock, coupon usage, wallet, welcome-bonus split, and referral coins exactly once', async () => {
    const user = await makeUser({ walletBalance: 0, welcomeBonusRemaining: 0, referralCoins: 5 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const coupon = await makeCoupon({ usage: 3 });
    await CouponUsage.create({ couponId: coupon._id, userId: user._id, usageCount: 1 });

    const order = await makeOrder({
      user, product, coupon,
      walletUsed: 50,
      welcomeCoinsUsed: 30,
      referralCoinsUsed: 20
    });

    await handleOrderCancellationRefunds(order);

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12); // 10 + 2
    expect(freshProduct.sales).toBe(18); // 20 - 2

    const freshCoupon = await Coupon.findById(coupon._id);
    expect(freshCoupon.usage).toBe(2); // 3 - 1

    const usage = await CouponUsage.findOne({ couponId: coupon._id, userId: user._id });
    expect(usage).toBeNull();

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(50);
    expect(freshUser.welcomeBonusRemaining).toBe(30);
    expect(freshUser.referralCoins).toBe(25); // 5 + 20

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.refundProcessed).toBe(true);
    expect(order.paymentStatus).toBe('Refunded');

    const walletTxn = await WalletTransaction.findOne({ userId: user._id, type: 'REFUND' });
    expect(walletTxn.amount).toBe(50);

    const coinTxn = await CoinTransaction.findOne({ userId: user._id, type: 'earned' });
    expect(coinTxn.amount).toBe(20);
  });

  test('folds in reward clawback when the order already had a reward credited', async () => {
    const user = await makeUser({ walletBalance: 100, referralCoins: 0 });
    const product = await makeProduct();

    const order = await makeOrder({
      user, product,
      status: 'Delivered',
      rewardCredited: true,
      rewardCoinsAmount: 100,
      rewardDeducted: false
    });

    await handleOrderCancellationRefunds(order);

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(0); // 100 - 100 reward clawback

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.rewardDeducted).toBe(true);

    const rewardTxn = await WalletTransaction.findOne({ orderId: order._id, type: 'ORDER_REWARD_REDUCE' });
    expect(rewardTxn.amount).toBe(-100);
  });
});

describe('handleOrderCancellationRefunds — duplicate webhook / duplicate calls', () => {
  test('a second call on an already-processed order is a safe no-op', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });

    const order = await makeOrder({ user, product, walletUsed: 50, welcomeCoinsUsed: 50, referralCoinsUsed: 10 });

    await handleOrderCancellationRefunds(order);

    const afterFirst = {
      stock: (await Product.findById(product._id)).stock,
      walletBalance: (await User.findById(user._id)).walletBalance,
      referralCoins: (await User.findById(user._id)).referralCoins
    };

    // Simulate a duplicate webhook delivery: a fresh fetch of the same order, called again.
    const orderAgain = await Order.findById(order._id);
    await handleOrderCancellationRefunds(orderAgain);

    const afterSecond = {
      stock: (await Product.findById(product._id)).stock,
      walletBalance: (await User.findById(user._id)).walletBalance,
      referralCoins: (await User.findById(user._id)).referralCoins
    };

    expect(afterSecond).toEqual(afterFirst);

    const walletTxnCount = await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND' });
    expect(walletTxnCount).toBe(1);
  });
});

describe('handleOrderCancellationRefunds — concurrent racing requests', () => {
  test('two simultaneous calls on the same order only let one succeed', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });

    const order = await makeOrder({ user, product, walletUsed: 50, welcomeCoinsUsed: 50, referralCoinsUsed: 10 });

    // Two separate in-memory copies, as two concurrent request handlers would each have
    // their own fetched document.
    const [orderCopyA, orderCopyB] = await Promise.all([
      Order.findById(order._id),
      Order.findById(order._id)
    ]);

    await Promise.all([
      handleOrderCancellationRefunds(orderCopyA),
      handleOrderCancellationRefunds(orderCopyB)
    ]);

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(50); // credited exactly once, not 100
    expect(freshUser.referralCoins).toBe(10); // credited exactly once, not 20

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12); // restored exactly once

    const walletTxnCount = await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND' });
    expect(walletTxnCount).toBe(1);
  });
});

describe('handleOrderCancellationRefunds — transactional rollback + retry', () => {
  test('a failure during referral-coin restore rolls back stock, coupon, and wallet too; retry then completes everything exactly once', async () => {
    const user = await makeUser({ walletBalance: 0, welcomeBonusRemaining: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const coupon = await makeCoupon({ usage: 3 });
    await CouponUsage.create({ couponId: coupon._id, userId: user._id, usageCount: 1 });

    const order = await makeOrder({
      user, product, coupon,
      walletUsed: 50,
      welcomeCoinsUsed: 50,
      referralCoinsUsed: 20
    });

    // Force a failure at the referral-coin ledger write (the last DB step of Phase 1),
    // after stock, coupon, and wallet writes have already executed inside the transaction.
    const coinTxnSpy = jest.spyOn(CoinTransaction, 'create').mockImplementationOnce(() => {
      throw new Error('Simulated ledger failure');
    });

    await expect(handleOrderCancellationRefunds(order)).rejects.toThrow('Simulated ledger failure');

    // Everything from this attempt must be rolled back — nothing partially applied.
    const productAfterFailure = await Product.findById(product._id);
    expect(productAfterFailure.stock).toBe(10);
    expect(productAfterFailure.sales).toBe(20);

    const couponAfterFailure = await Coupon.findById(coupon._id);
    expect(couponAfterFailure.usage).toBe(3);

    const usageAfterFailure = await CouponUsage.findOne({ couponId: coupon._id, userId: user._id });
    expect(usageAfterFailure).not.toBeNull();

    const userAfterFailure = await User.findById(user._id);
    expect(userAfterFailure.walletBalance).toBe(0);
    expect(userAfterFailure.referralCoins).toBe(0);

    const orderAfterFailure = await Order.findById(order._id);
    expect(orderAfterFailure.refundProcessed).toBe(false);

    coinTxnSpy.mockRestore();

    // Retry: the same order, refetched, should now succeed completely and exactly once.
    const orderForRetry = await Order.findById(order._id);
    await handleOrderCancellationRefunds(orderForRetry);

    const productAfterRetry = await Product.findById(product._id);
    expect(productAfterRetry.stock).toBe(12);
    expect(productAfterRetry.sales).toBe(18);

    const couponAfterRetry = await Coupon.findById(coupon._id);
    expect(couponAfterRetry.usage).toBe(2);

    const userAfterRetry = await User.findById(user._id);
    expect(userAfterRetry.walletBalance).toBe(50);
    expect(userAfterRetry.referralCoins).toBe(20);

    const orderAfterRetry = await Order.findById(order._id);
    expect(orderAfterRetry.refundProcessed).toBe(true);

    // Exactly one ledger entry each, even though the coin-restore step ran twice
    // (once failed, once succeeded) across the two attempts.
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND' })).toBe(1);
    expect(await CoinTransaction.countDocuments({ userId: user._id, type: 'earned' })).toBe(1);
  });

  test('a failure during stock restoration itself rolls back everything (nothing else commits)', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });

    const order = await makeOrder({ user, product, walletUsed: 40, referralCoinsUsed: 5 });

    const productUpdateSpy = jest.spyOn(Product, 'findByIdAndUpdate').mockImplementationOnce(() => {
      throw new Error('Simulated stock update failure');
    });

    await expect(handleOrderCancellationRefunds(order)).rejects.toThrow('Simulated stock update failure');

    const userAfterFailure = await User.findById(user._id);
    expect(userAfterFailure.walletBalance).toBe(0);
    expect(userAfterFailure.referralCoins).toBe(0);

    const orderAfterFailure = await Order.findById(order._id);
    expect(orderAfterFailure.refundProcessed).toBe(false);

    productUpdateSpy.mockRestore();

    // Retry succeeds fully.
    const orderForRetry = await Order.findById(order._id);
    await handleOrderCancellationRefunds(orderForRetry);

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12);
    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(40);
    expect(freshUser.referralCoins).toBe(5);
  });

  test('a failure during coupon restoration rolls back the stock restore from the same attempt', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const coupon = await makeCoupon({ usage: 3 });
    await CouponUsage.create({ couponId: coupon._id, userId: user._id, usageCount: 1 });

    const order = await makeOrder({ user, product, coupon });

    const couponSpy = jest.spyOn(Coupon, 'findOneAndUpdate').mockImplementationOnce(() => {
      throw new Error('Simulated coupon update failure');
    });

    await expect(handleOrderCancellationRefunds(order)).rejects.toThrow('Simulated coupon update failure');

    const productAfterFailure = await Product.findById(product._id);
    expect(productAfterFailure.stock).toBe(10); // stock restore rolled back too

    const orderAfterFailure = await Order.findById(order._id);
    expect(orderAfterFailure.refundProcessed).toBe(false);

    couponSpy.mockRestore();

    const orderForRetry = await Order.findById(order._id);
    await handleOrderCancellationRefunds(orderForRetry);

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12);
    const freshCoupon = await Coupon.findById(coupon._id);
    expect(freshCoupon.usage).toBe(2);
  });
});

describe('rewardService — creditOrderReward / deductOrderReward idempotency', () => {
  test('crediting the same order twice only credits the wallet once', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({ user, product, status: 'Delivered' });

    const first = await creditOrderReward(order._id);
    expect(first.success).toBe(true);
    expect(first.rewardAmount).toBe(100);

    const second = await creditOrderReward(order._id);
    expect(second.success).toBe(false);
    expect(second.reason).toMatch(/already credited/i);

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(100); // not 200

    expect(await WalletTransaction.countDocuments({ orderId: order._id, type: 'ORDER_REWARD' })).toBe(1);
  });

  test('concurrent credit calls on the same order only let one succeed', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({ user, product, status: 'Delivered' });

    const results = await Promise.all([
      creditOrderReward(order._id),
      creditOrderReward(order._id)
    ]);

    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(1);

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(100);
  });

  test('deducting the same order twice only deducts the wallet once, and cannot deduct an uncredited order', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({ user, product, status: 'Delivered' });

    const neverCredited = await deductOrderReward(order._id);
    expect(neverCredited.success).toBe(false);

    await creditOrderReward(order._id);

    const first = await deductOrderReward(order._id);
    expect(first.success).toBe(true);

    const second = await deductOrderReward(order._id);
    expect(second.success).toBe(false);

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(0); // +100 then -100, not double-deducted

    expect(await WalletTransaction.countDocuments({ orderId: order._id, type: 'ORDER_REWARD_REDUCE' })).toBe(1);
  });
});

describe('handleOrderCancellationRefunds — options.restoreStock=false skips stock/coupon', () => {
  test('does not touch stock or coupon usage when restoreStock is false, but still refunds coins', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const coupon = await makeCoupon({ usage: 3 });
    await CouponUsage.create({ couponId: coupon._id, userId: user._id, usageCount: 1 });

    const order = await makeOrder({ user, product, coupon, walletUsed: 30, referralCoinsUsed: 5 });

    await handleOrderCancellationRefunds(order, { restoreStock: false });

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(10); // untouched
    expect(freshProduct.sales).toBe(20); // untouched

    const freshCoupon = await Coupon.findById(coupon._id);
    expect(freshCoupon.usage).toBe(3); // untouched

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(30);
    expect(freshUser.referralCoins).toBe(5);
  });
});

describe('handleOrderCancellationRefunds — Phase 2 (online payment refund) idempotency', () => {
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

  test('calls Razorpay exactly once and does not fall back to store credit on success', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({
      user, product,
      paymentMethod: 'Online',
      paymentStatus: 'Paid',
      total: 500,
      paymentId: `pay_test_${Date.now()}`
    });

    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_1' } });

    await handleOrderCancellationRefunds(order);

    expect(postSpy).toHaveBeenCalledTimes(1);

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.onlinePaymentRefundProcessed).toBe(true);

    // No store-credit fallback transaction should exist since Razorpay succeeded.
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'Refund' })).toBe(0);

    getSpy.mockRestore();
    postSpy.mockRestore();
  });

  test('retrying after Phase 1 already succeeded still reaches and retries Phase 2', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({
      user, product,
      paymentMethod: 'Online',
      paymentStatus: 'Paid',
      total: 500,
      paymentId: `pay_test_${Date.now()}`
    });

    // First attempt: Razorpay call fails, and so does the store-credit fallback (simulated),
    // so the online claim should be released for a retry.
    const getSpy1 = jest.spyOn(axios, 'get').mockRejectedValue(new Error('Razorpay unreachable'));
    const walletUpdateSpy = jest.spyOn(User, 'findByIdAndUpdate').mockImplementationOnce(() => {
      throw new Error('Simulated store-credit fallback failure');
    });

    await handleOrderCancellationRefunds(order);
    getSpy1.mockRestore();
    walletUpdateSpy.mockRestore();

    let freshOrder = await Order.findById(order._id);
    expect(freshOrder.refundProcessed).toBe(true); // Phase 1 succeeded and stayed committed
    expect(freshOrder.onlinePaymentRefundProcessed).toBe(false); // Phase 2 claim was released

    // Retry: re-fetch the order and call again. Even though Phase 1's claim is already
    // taken, execution must still reach Phase 2 (this is the bug the tests caught and the
    // break-instead-of-return fix addresses) and this time it succeeds.
    const getSpy2 = jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [] } });
    const postSpy2 = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_2' } });

    const orderForRetry = await Order.findById(order._id);
    await handleOrderCancellationRefunds(orderForRetry);

    expect(postSpy2).toHaveBeenCalledTimes(1);
    freshOrder = await Order.findById(order._id);
    expect(freshOrder.onlinePaymentRefundProcessed).toBe(true);

    getSpy2.mockRestore();
    postSpy2.mockRestore();
  });

  test('skips creating a duplicate Razorpay refund if one already exists for the payment', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({
      user, product,
      paymentMethod: 'Online',
      paymentStatus: 'Paid',
      total: 500,
      paymentId: `pay_test_${Date.now()}`
    });

    // Simulate: Phase 1 already committed, but Phase 2's claim was left false (e.g. a crash
    // right after Razorpay actually confirmed the refund but before we recorded it).
    await Order.updateOne({ _id: order._id }, { $set: { refundProcessed: true, onlinePaymentRefundProcessed: false } });
    const orderForRetry = await Order.findById(order._id);

    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [{ id: 'rfnd_existing' }] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_should_not_happen' } });

    await handleOrderCancellationRefunds(orderForRetry);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).not.toHaveBeenCalled(); // must not create a second refund

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.onlinePaymentRefundProcessed).toBe(true);

    getSpy.mockRestore();
    postSpy.mockRestore();
  });

  test('a second call after Phase 2 already succeeded does not call Razorpay again', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({
      user, product,
      paymentMethod: 'Online',
      paymentStatus: 'Paid',
      total: 500,
      paymentId: `pay_test_${Date.now()}`
    });

    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_1' } });

    await handleOrderCancellationRefunds(order);
    expect(postSpy).toHaveBeenCalledTimes(1);

    const orderAgain = await Order.findById(order._id);
    await handleOrderCancellationRefunds(orderAgain);

    expect(postSpy).toHaveBeenCalledTimes(1); // still just once

    getSpy.mockRestore();
    postSpy.mockRestore();
  });
});
