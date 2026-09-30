const axios = require('axios');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');

const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const WalletTransaction = require('../Models/WalletTransaction');
const SystemConfig = require('../Models/SystemConfig');

const { handleReturnRefund } = require('../utils/orderHelper');
const { creditOrderReward } = require('../utils/walletService');

jest.setTimeout(60000);

let userCounter = 0;
let articleCounter = 0;

const makeUser = async (overrides = {}) => {
  userCounter += 1;
  return User.create({
    phone: `91000${String(userCounter).padStart(5, '0')}`,
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
    ...overrides
  });
};

const makeReturn = async ({ user, order, product, ...overrides }) => ReturnRequest.create({
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

// A delivered order with its (locked) reward credited, then moved into 'Return Requested'.
const makeRewardedReturnOrder = async (user, product, overrides = {}) => {
  const order = await makeOrder({ user, product, status: 'Delivered', ...overrides });
  await creditOrderReward(order._id); // 1600 x 10% = 160 coins
  await Order.updateOne({ _id: order._id }, { $set: { status: 'Return Requested' } });
  return Order.findById(order._id);
};

beforeAll(async () => {
  await startTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create({ welcomeBonusCoins: 1000, orderRewardPercentage: 10, orderRewardMaxCap: 400, returnWindowDays: 2 });
});

describe('handleReturnRefund — full successful bundle (Wallet refund method)', () => {
  test('restores stock, withdraws the locked reward, credits the cash refund once, and never restores redeemed coins', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeRewardedReturnOrder(user, product, { walletUsed: 50 });
    expect((await User.findById(user._id)).walletBalance).toBe(160);

    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });
    await handleReturnRefund(returnRequest, order);
    await returnRequest.save();

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.stock).toBe(12);
    expect(freshProduct.sales).toBe(18);

    // 160 reward withdrawn, 1600 cash refund credited, the 50 redeemed coins NOT restored
    expect((await User.findById(user._id)).refundWalletBalance).toBe(1600);
    expect((await User.findById(user._id)).walletBalance).toBe(0); // reward withdrawn; refund money kept separate

    const freshReturn = await ReturnRequest.findById(returnRequest._id);
    expect(freshReturn.stockRefundClaimed).toBe(true);
    expect(freshReturn.walletRefundProcessed).toBe(true);
    expect(freshReturn.cashRefundProcessed).toBe(true);

    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'ORDER_REWARD_REDUCE' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_CREDIT' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND' })).toBe(0);
  });
});

describe('handleReturnRefund — duplicate/retried calls', () => {
  test('calling it twice on the same return does not double-restore stock, double-withdraw or double-credit', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeRewardedReturnOrder(user, product);
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    await handleReturnRefund(returnRequest, order);
    await returnRequest.save();
    const afterFirst = {
      stock: (await Product.findById(product._id)).stock,
      walletBalance: (await User.findById(user._id)).walletBalance
    };

    const returnAgain = await ReturnRequest.findById(returnRequest._id);
    await handleReturnRefund(returnAgain, await Order.findById(order._id));
    await returnAgain.save();
    const afterSecond = {
      stock: (await Product.findById(product._id)).stock,
      walletBalance: (await User.findById(user._id)).walletBalance
    };

    expect(afterSecond).toEqual(afterFirst);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'ORDER_REWARD_REDUCE' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_CREDIT' })).toBe(1);
  });

  test('concurrent duplicate calls only let one succeed', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeRewardedReturnOrder(user, product);
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    const [returnA, returnB] = await Promise.all([ReturnRequest.findById(returnRequest._id), ReturnRequest.findById(returnRequest._id)]);
    const [orderA, orderB] = await Promise.all([Order.findById(order._id), Order.findById(order._id)]);
    await Promise.all([handleReturnRefund(returnA, orderA), handleReturnRefund(returnB, orderB)]);

    expect((await Product.findById(product._id)).stock).toBe(12);
    expect((await User.findById(user._id)).refundWalletBalance).toBe(1600);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_CREDIT' })).toBe(1);
  });
});

describe('handleReturnRefund — mid-flight failure rolls back and retry completes exactly once', () => {
  test('a failure during the reward withdrawal rolls back the stock restore; retry completes everything once', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeRewardedReturnOrder(user, product);
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    const ledgerSpy = jest.spyOn(WalletTransaction, 'create').mockImplementationOnce(() => {
      throw new Error('Simulated ledger failure');
    });
    await expect(handleReturnRefund(returnRequest, order)).rejects.toThrow('Simulated ledger failure');
    ledgerSpy.mockRestore();

    expect((await Product.findById(product._id)).stock).toBe(10);
    expect((await User.findById(user._id)).walletBalance).toBe(160);
    const returnAfterFailure = await ReturnRequest.findById(returnRequest._id);
    expect(returnAfterFailure.stockRefundClaimed).toBe(false);
    expect(returnAfterFailure.cashRefundProcessed).toBe(false);
    expect((await Order.findById(order._id)).rewardDeducted).toBe(false);

    const returnForRetry = await ReturnRequest.findById(returnRequest._id);
    await handleReturnRefund(returnForRetry, await Order.findById(order._id));
    await returnForRetry.save();

    expect((await Product.findById(product._id)).stock).toBe(12);
    expect((await User.findById(user._id)).refundWalletBalance).toBe(1600);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'ORDER_REWARD_REDUCE' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_CREDIT' })).toBe(1);
  });

  test('Phase 1 succeeding but the process crashing before Phase 2 does not lose or duplicate the cash refund on retry', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct({ stock: 10, sales: 20 });
    const order = await makeOrder({ user, product, status: 'Return Requested' });
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Wallet' });

    await ReturnRequest.updateOne({ _id: returnRequest._id }, { $set: { stockRefundClaimed: true, walletRefundProcessed: true } });
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: 2, sales: -2 } });

    const returnForRetry = await ReturnRequest.findById(returnRequest._id);
    await handleReturnRefund(returnForRetry, await Order.findById(order._id));
    await returnForRetry.save();

    expect((await Product.findById(product._id)).stock).toBe(12);
    expect((await User.findById(user._id)).refundWalletBalance).toBe(1600);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_CREDIT' })).toBe(1);
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

  const makeOnlineReturnOrder = (user, product) => makeOrder({
    user, product,
    paymentMethod: 'Online',
    paymentStatus: 'Paid',
    status: 'Return Requested',
    paymentId: `pay_test_${Date.now()}_${Math.random()}`
  });

  test('does not credit wallet store-credit when Razorpay refund succeeds', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOnlineReturnOrder(user, product);
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Bank' });

    jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_1' } });

    await handleReturnRefund(returnRequest, order);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect((await User.findById(user._id)).walletBalance).toBe(0);
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'REFUND_WALLET_CREDIT' })).toBe(0);
  });

  test('skips creating a duplicate Razorpay refund if one already exists for the payment', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOnlineReturnOrder(user, product);
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Bank' });
    await ReturnRequest.updateOne({ _id: returnRequest._id }, { $set: { stockRefundClaimed: true, walletRefundProcessed: true } });

    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [{ id: 'rfnd_existing' }] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_should_not_happen' } });

    await handleReturnRefund(await ReturnRequest.findById(returnRequest._id), order);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('a second call after Phase 2 already succeeded does not call Razorpay again', async () => {
    const user = await makeUser({ walletBalance: 0 });
    const product = await makeProduct();
    const order = await makeOnlineReturnOrder(user, product);
    const returnRequest = await makeReturn({ user, order, product, refundAmount: 1600, refundMethod: 'Bank' });

    jest.spyOn(axios, 'get').mockResolvedValue({ data: { items: [] } });
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'rfnd_1' } });

    await handleReturnRefund(returnRequest, order);
    await handleReturnRefund(await ReturnRequest.findById(returnRequest._id), await Order.findById(order._id));

    expect(postSpy).toHaveBeenCalledTimes(1);
  });
});
