const axios = require('axios');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');

const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const WalletTransaction = require('../Models/WalletTransaction');
const CoinTransaction = require('../Models/CoinTransaction');
const SystemConfig = require('../Models/SystemConfig');

const { handleReturnRefund } = require('../utils/orderHelper');
const { creditOrderReward, deductOrderReward } = require('../utils/rewardService');

jest.setTimeout(60000);

let userCounter = 0;
let articleCounter = 0;

const makeUser = async (overrides = {}) => {
  userCounter += 1;
  return User.create({
    phone: `91000${String(userCounter).padStart(5, '0')}`,
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

const makeOrder = async ({ user, product, ...overrides }) => {
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
    total: 1600,
    deliveryAddress: { name: 'A', type: 'Home', address: 'Somewhere', pincode: '452001' },
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Delivered',
    walletUsed: 0,
    welcomeCoinsUsed: 0,
    referralCoinsUsed: 0,
    ...overrides
  });
};

const makeReturn = async ({ user, order, product, ...overrides }) => {
  return ReturnRequest.create({
    orderId: order._id,
    userId: user._id,
    items: overrides.items || [{
      productId: product._id,
      name: product.name,
      price: product.sellingPrice,
      quantity: 2
    }],
    reason: 'Changed Mind',
    refundAmount: overrides.refundAmount !== undefined ? overrides.refundAmount : 1600,
    refundMethod: overrides.refundMethod || 'Wallet',
    status: overrides.status || 'Approved',
    ...overrides
  });
};

beforeAll(async () => {
  await startTestDb();
  await SystemConfig.create({ welcomeBonusCoins: 1000, rewardCoinsPerDeliveredOrder: 100, returnWindowDays: 2 });
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create({ welcomeBonusCoins: 1000, rewardCoinsPerDeliveredOrder: 100, returnWindowDays: 2 });
});

describe('handleReturnRefund — full successful bundle (COD / Wallet refund method)', () => {
  test('restores stock for returned items only, restores wallet/referral coins, and credits cash refund to wallet exactly once', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 5 });
    const product = await makeProduct({ stock: 10, sales: 20 });

    const order = await makeOrder({
      user, product,
      walletUsed: 50,
      welcomeCoinsUsed: 30,
      referralCoinsUsed: 20,
      status: 'Return Requested'
    });

    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    await handleReturnRefund(returnRequest, order);
    await returnRequest.save();

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12); // 10 + 2
    expect(freshProduct.sales).toBe(18); // 20 - 2

    const freshUser = await User.findById(user._id);
    // walletUsed restore (50) + welcome split + referral (20) + cash refund to wallet (1600)
    expect(freshUser.walletBalance).toBe(50 + 1600);
    expect(freshUser.welcomeBonusRemaining).toBe(30);
    expect(freshUser.referralCoins).toBe(25);

    const freshReturn = await ReturnRequest.findById(returnRequest._id);
    expect(freshReturn.stockRefundClaimed).toBe(true);
    expect(freshReturn.walletRefundProcessed).toBe(true);
    expect(freshReturn.cashRefundProcessed).toBe(true);

    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'Refund' })).toBe(1); // cash refund entry
    expect(await CoinTransaction.countDocuments({ userId: user._id, type: 'earned' })).toBe(1);
  });
});

describe('handleReturnRefund — duplicate/retried calls (the core idempotency fix)', () => {
  test('calling it twice on the same return does not double-restore stock or double-credit cash/wallet', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeOrder({ user, product, walletUsed: 40, referralCoinsUsed: 10, status: 'Return Requested' });
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    await handleReturnRefund(returnRequest, order);
    await returnRequest.save();

    const afterFirst = {
      stock: (await Product.findById(product._id)).stock,
      walletBalance: (await User.findById(user._id)).walletBalance,
      referralCoins: (await User.findById(user._id)).referralCoins
    };

    // Simulate a retry: fresh fetch of the same (already-refunded) return + order, as would
    // happen if an admin re-submitted the same 'Refunded' status update, or the request
    // handler retried after a downstream failure (e.g. order.save() throwing).
    const returnAgain = await ReturnRequest.findById(returnRequest._id);
    const orderAgain = await Order.findById(order._id);
    await handleReturnRefund(returnAgain, orderAgain);
    await returnAgain.save();

    const afterSecond = {
      stock: (await Product.findById(product._id)).stock,
      walletBalance: (await User.findById(user._id)).walletBalance,
      referralCoins: (await User.findById(user._id)).referralCoins
    };

    expect(afterSecond).toEqual(afterFirst);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'Refund' })).toBe(1);
    expect(await CoinTransaction.countDocuments({ userId: user._id, type: 'earned' })).toBe(1);
  });

  test('concurrent duplicate calls only let one succeed', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeOrder({ user, product, walletUsed: 40, referralCoinsUsed: 10, status: 'Return Requested' });
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    const [returnA, returnB] = await Promise.all([
      ReturnRequest.findById(returnRequest._id),
      ReturnRequest.findById(returnRequest._id)
    ]);
    const [orderA, orderB] = await Promise.all([
      Order.findById(order._id),
      Order.findById(order._id)
    ]);

    await Promise.all([
      handleReturnRefund(returnA, orderA),
      handleReturnRefund(returnB, orderB)
    ]);

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12); // restored exactly once, not twice

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(40 + 1600); // wallet-used restore + cash refund, once each
    expect(freshUser.referralCoins).toBe(10);

    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'Refund' })).toBe(1);
  });
});

describe('handleReturnRefund — mid-flight failure rolls back and retry completes exactly once', () => {
  test('a failure during referral-coin restore rolls back stock and wallet from the same attempt; retry then completes everything once', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeOrder({ user, product, walletUsed: 40, referralCoinsUsed: 15, status: 'Return Requested' });
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    const coinTxnSpy = jest.spyOn(CoinTransaction, 'create').mockImplementationOnce(() => {
      throw new Error('Simulated ledger failure');
    });

    await expect(handleReturnRefund(returnRequest, order)).rejects.toThrow('Simulated ledger failure');

    const productAfterFailure = await Product.findById(product._id);
    expect(productAfterFailure.stock).toBe(10); // rolled back, not partially restored

    const userAfterFailure = await User.findById(user._id);
    expect(userAfterFailure.walletBalance).toBe(0);
    expect(userAfterFailure.referralCoins).toBe(0);

    const returnAfterFailure = await ReturnRequest.findById(returnRequest._id);
    expect(returnAfterFailure.stockRefundClaimed).toBe(false); // claim released, safe to retry
    expect(returnAfterFailure.cashRefundProcessed).toBe(false); // Phase 2 never ran

    coinTxnSpy.mockRestore();

    // Retry: this is exactly the scenario that used to double-restore stock/cash before the
    // fix — the old code had no claim guarding stock restoration at all.
    const returnForRetry = await ReturnRequest.findById(returnRequest._id);
    const orderForRetry = await Order.findById(order._id);
    await handleReturnRefund(returnForRetry, orderForRetry);
    await returnForRetry.save();

    const productAfterRetry = await Product.findById(product._id);
    expect(productAfterRetry.stock).toBe(12); // restored exactly once across both attempts

    const userAfterRetry = await User.findById(user._id);
    expect(userAfterRetry.walletBalance).toBe(40 + 1600);
    expect(userAfterRetry.referralCoins).toBe(15);

    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND' })).toBe(1);
    expect(await CoinTransaction.countDocuments({ userId: user._id, type: 'earned' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'Refund' })).toBe(1);
  });

  test('Phase 1 succeeding but the process crashing before Phase 2 (cash refund) does not lose or duplicate the cash refund on retry', async () => {
    const user = await makeUser({ walletBalance: 0, referralCoins: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeOrder({ user, product, status: 'Return Requested' });
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    // Simulate: Phase 1 (stock/wallet) already committed in a prior attempt, but the process
    // died before Phase 2 (cash refund) ran — cashRefundProcessed is still false.
    await ReturnRequest.updateOne({ _id: returnRequest._id }, { $set: { stockRefundClaimed: true, walletRefundProcessed: true } });
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: 2, sales: -2 } }); // reflects the already-applied Phase 1

    const returnForRetry = await ReturnRequest.findById(returnRequest._id);
    const orderForRetry = await Order.findById(order._id);
    await handleReturnRefund(returnForRetry, orderForRetry);
    await returnForRetry.save();

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12); // NOT restored a second time

    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(1600); // cash refund applied exactly once

    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'Refund' })).toBe(1);
  });
});

describe('handleReturnRefund — Razorpay online refund idempotency', () => {
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

  test('does not credit wallet store-credit when Razorpay refund succeeds', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({
      user, product,
      paymentMethod: 'Online',
      paymentStatus: 'Paid',
      status: 'Return Requested',
      paymentId: `pay_test_${Date.now()}`
    });
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Bank' });

    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_1' } });

    await handleReturnRefund(returnRequest, order);

    expect(postSpy).toHaveBeenCalledTimes(1);
    const freshUser = await User.findById(user._id);
    expect(freshUser.walletBalance).toBe(0); // no wallet store-credit, Razorpay handled it
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'Refund' })).toBe(0);

    getSpy.mockRestore();
    postSpy.mockRestore();
  });

  test('skips creating a duplicate Razorpay refund if one already exists for the payment', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({
      user, product,
      paymentMethod: 'Online',
      paymentStatus: 'Paid',
      status: 'Return Requested',
      paymentId: `pay_test_${Date.now()}`
    });
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Bank' });
    await ReturnRequest.updateOne({ _id: returnRequest._id }, { $set: { stockRefundClaimed: true, walletRefundProcessed: true } });

    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [{ id: 'rfnd_existing' }] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_should_not_happen' } });

    const returnForRetry = await ReturnRequest.findById(returnRequest._id);
    await handleReturnRefund(returnForRetry, order);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).not.toHaveBeenCalled();

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
      status: 'Return Requested',
      paymentId: `pay_test_${Date.now()}`
    });
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Bank' });

    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_1' } });

    await handleReturnRefund(returnRequest, order);
    expect(postSpy).toHaveBeenCalledTimes(1);

    const returnAgain = await ReturnRequest.findById(returnRequest._id);
    const orderAgain = await Order.findById(order._id);
    await handleReturnRefund(returnAgain, orderAgain);

    expect(postSpy).toHaveBeenCalledTimes(1); // still just once

    getSpy.mockRestore();
    postSpy.mockRestore();
  });
});

describe('Coin reward clawback on return refund (returnController wiring)', () => {
  test('deductOrderReward claws back a previously credited reward exactly once, and a second return-refund attempt cannot deduct twice', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOrder({ user, product, status: 'Delivered' });

    const credit = await creditOrderReward(order._id);
    expect(credit.success).toBe(true);

    const userAfterCredit = await User.findById(user._id);
    expect(userAfterCredit.walletBalance).toBe(100);

    const first = await deductOrderReward(order._id);
    expect(first.success).toBe(true);

    const second = await deductOrderReward(order._id);
    expect(second.success).toBe(false);

    const finalUser = await User.findById(user._id);
    expect(finalUser.walletBalance).toBe(0); // credited then clawed back exactly once each

    expect(await WalletTransaction.countDocuments({ orderId: order._id, type: 'ORDER_REWARD_REDUCE' })).toBe(1);
  });
});
