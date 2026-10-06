// Final approved wallet / referral / reward rules — end-to-end through the real checkout,
// the manual admin status update and the Shiprocket webhook.
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

const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');

const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const Referral = require('../Models/Referral');
const ReturnRequest = require('../Models/ReturnRequest');
const WalletTransaction = require('../Models/WalletTransaction');
const SystemConfig = require('../Models/SystemConfig');

const walletService = require('../utils/walletService');
const { handleReturnRefund, handleOrderCancellationRefunds } = require('../utils/orderHelper');
const { createOrder, updateOrderStatus, getWalletPreview } = require('../Controllers/orderController');
const { webhookReceiver } = require('../Controllers/shiprocketController');
const { updateSettings } = require('../Controllers/settingsController');

jest.setTimeout(120000);

const DAY = 24 * 60 * 60 * 1000;
let counter = 0;

const makeUser = async (overrides = {}) => {
  counter += 1;
  return User.create({ phone: `92${String(counter).padStart(8, '0')}`, name: `User ${counter}`, isVerified: true, walletBalance: 0, ...overrides });
};

const makeProduct = async (overrides = {}) => {
  counter += 1;
  return Product.create({
    name: `Shoe ${counter}`, category: 'Shoes', sellingPrice: 1000, mrp: 1200, stock: 50, sales: 0,
    article: `ART-W-${counter}-${Date.now()}`, sku: `SKU-W-${counter}-${Date.now()}`, shippingSpecs: { weight: 0.5 }, status: 'Approved', ...overrides
  });
};

const makeOrder = async ({ user, price = 1000, mrp = price, quantity = 1, ...overrides }) => {
  const product = await makeProduct({ sellingPrice: price, mrp });
  return Order.create({
    userId: user._id,
    items: [{ productId: product._id, name: product.name, price, mrp, quantity }],
    total: price * quantity,
    deliveryAddress: { name: 'A', type: 'Home', address: 'Somewhere', pincode: '452001' },
    paymentMethod: 'COD',
    status: 'Out for Delivery',
    ...overrides
  });
};

const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

const checkout = async (user, product, { quantity = 1, redeemWallet = true } = {}) => {
  const res = mockRes();
  await createOrder({
    user: { _id: user._id },
    body: {
      items: [{ productId: product._id.toString(), name: product.name, quantity }],
      total: 1,
      deliveryAddress: { name: 'A', type: 'Home', address: 'Somewhere, Indore', pincode: '452001', phone: '9999999999' },
      paymentMethod: 'COD',
      redeemWallet
    }
  }, res);
  return res;
};

const deliverManually = async (orderId) => {
  const res = mockRes();
  await updateOrderStatus({ params: { id: orderId.toString() }, body: { status: 'Delivered' } }, res);
  expect(res.statusCode).toBe(200);
  return res;
};

const deliverViaShiprocket = async (orderId) => {
  const res = mockRes();
  await webhookReceiver({ body: { channel_order_id: `ORD_${orderId}`, current_status: 'DELIVERED' }, headers: {} }, res);
  expect(res.statusCode).toBe(200);
  return res;
};

const balance = async (userId) => (await User.findById(userId)).walletBalance;
const expireReturnWindow = (orderId) => Order.updateOne(
  { _id: orderId },
  { $set: { rewardCreditedAt: new Date(Date.now() - 3 * DAY), referralRewardCreditedAt: new Date(Date.now() - 3 * DAY) } }
);

beforeAll(async () => {
  await startTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  // No reward/wallet values in the DB: everything below must come from the model defaults
  // (1000 / 200 / 10% / 400 / 25%), proving nothing depends on hardcoded controller values.
  await SystemConfig.create({ returnWindowDays: 2, commission: 10, codChargeEnabled: true, codChargeAmount: 150 });
});

describe('Pure money calculations (integer paise, floor)', () => {
  test('1. ₹999.99 at 10% -> 99 coins (floor, no float drift)', () => {
    expect(walletService.calculateOrderRewardCoins(999.99, { orderRewardPercentage: 10, orderRewardMaxCap: 400 })).toBe(99);
    expect(walletService.toPaise(999.99)).toBe(99999);
  });

  test('3 & 4. ₹4,000 -> 400 coins; ₹5,000 -> 500 calculated but capped at 400', () => {
    const cfg = { orderRewardPercentage: 10, orderRewardMaxCap: 400 };
    expect(walletService.calculateOrderRewardCoins(1000, cfg)).toBe(100);
    expect(walletService.calculateOrderRewardCoins(2000, cfg)).toBe(200);
    expect(walletService.calculateOrderRewardCoins(4000, cfg)).toBe(400);
    expect(walletService.calculateOrderRewardCoins(5000, cfg)).toBe(400);
  });

  test('5-7. redemption = min(available balance, 25% of eligible product value)', () => {
    const r = (availableBalance, eligibleProductValue) =>
      walletService.calculateMaxRedeemable({ availableBalance, eligibleProductValue, walletRedemptionPercentage: 25 });
    expect(r(10000, 10000)).toBe(2500);
    expect(r(10000, 40000)).toBe(10000);
    expect(r(15000, 40000)).toBe(10000);
  });

  test('14. decimal prices never produce floating-point artefacts', () => {
    const eligible = walletService.calculateEligibleProductValue([{ price: 333.33, quantity: 3 }]);
    expect(eligible).toBe(999.99); // plain JS: 333.33 * 3 === 999.9899999999999
    expect(walletService.calculateEligibleProductValue([{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }])).toBe(0.3);
    expect(walletService.calculateMaxRedeemable({ availableBalance: 1000, eligibleProductValue: 999.99, walletRedemptionPercentage: 25 })).toBe(249.99);
    expect(walletService.calculateOrderRewardCoins(0.29 * 1000, { orderRewardPercentage: 10, orderRewardMaxCap: 400 })).toBe(29);
  });
});

describe('Checkout (createOrder) — selling price, 25% redemption, single wallet', () => {
  test('2. reward is calculated on the admin selling price (₹850), not the MRP (₹999)', async () => {
    const user = await makeUser();
    const product = await makeProduct({ sellingPrice: 850, mrp: 999 });
    const res = await checkout(user, product, { redeemWallet: false });
    expect(res.statusCode).toBe(201);
    expect(res.body.order.eligibleProductValue).toBe(850);
    expect(res.body.order.rewardCoinsExpected).toBe(85);
  });

  test('5. ₹10,000 wallet + ₹10,000 order -> ₹2,500 redeemed (delivery/fees excluded from the basis)', async () => {
    const user = await makeUser({ walletBalance: 10000 });
    const product = await makeProduct({ sellingPrice: 10000, mrp: 12000 });
    const res = await checkout(user, product);
    expect(res.statusCode).toBe(201);
    expect(res.body.order.walletUsed).toBe(2500);
    // 10000 + 10 platform fee + 150 COD - 2500 wallet
    expect(res.body.order.total).toBe(7660);
    expect(await balance(user._id)).toBe(7500);
    const ledger = await WalletTransaction.findOne({ userId: user._id, type: 'ORDER_REDEMPTION' });
    expect(ledger.amount).toBe(-2500);
    expect(ledger.source).toBe('ORDER_REDEMPTION');
    expect(ledger.balanceAfter).toBe(7500);
  });

  test('6. ₹10,000 wallet + ₹40,000 order -> full ₹10,000 redeemed', async () => {
    const user = await makeUser({ walletBalance: 10000 });
    const product = await makeProduct({ sellingPrice: 40000, mrp: 45000 });
    const res = await checkout(user, product);
    expect(res.body.order.walletUsed).toBe(10000);
    expect(await balance(user._id)).toBe(0);
  });

  test('7. ₹15,000 wallet + ₹40,000 order -> ₹10,000 redeemed, ₹5,000 stays in the wallet', async () => {
    const user = await makeUser({ walletBalance: 15000 });
    const product = await makeProduct({ sellingPrice: 40000, mrp: 45000 });
    const res = await checkout(user, product);
    expect(res.body.order.walletUsed).toBe(10000);
    expect(await balance(user._id)).toBe(5000);
  });

  test('the checkout preview endpoint returns the same backend-calculated numbers', async () => {
    const user = await makeUser({ walletBalance: 15000 });
    const product = await makeProduct({ sellingPrice: 20000, mrp: 25000 });
    const res = mockRes();
    await getWalletPreview({ user: { _id: user._id }, body: { items: [{ productId: product._id, quantity: 2 }] } }, res);
    expect(res.body).toMatchObject({
      success: true, walletBalance: 15000, availableBalance: 15000, eligibleProductValue: 40000,
      walletRedemptionPercentage: 25, maxRedeemable: 10000, estimatedRewardCoins: 400
    });
  });

  test('14. decimal checkout: ₹333.33 x 3 with ₹1,000 wallet -> ₹249.99 redeemed, ₹750.01 left, 99 coins earned', async () => {
    const user = await makeUser({ walletBalance: 1000 });
    const product = await makeProduct({ sellingPrice: 333.33, mrp: 400 });
    const res = await checkout(user, product, { quantity: 3 });
    expect(res.body.order.eligibleProductValue).toBe(999.99);
    expect(res.body.order.walletUsed).toBe(249.99);
    expect(res.body.order.rewardCoinsExpected).toBe(99);
    expect(await balance(user._id)).toBe(750.01);
  });

  test('locked reward coins cannot be redeemed', async () => {
    const user = await makeUser();
    const earned = await makeOrder({ user, price: 2000 });
    await deliverManually(earned._id); // 200 coins, locked
    expect(await balance(user._id)).toBe(200);

    const product = await makeProduct({ sellingPrice: 4000, mrp: 5000 });
    const res = await checkout(user, product);
    expect(res.body.order.walletUsed).toBe(0);
    expect(await balance(user._id)).toBe(200);
  });

  test('13. two simultaneous checkouts can never overdraw the wallet', async () => {
    const user = await makeUser({ walletBalance: 1000 });
    const product = await makeProduct({ sellingPrice: 4000, mrp: 5000 });
    const results = await Promise.all([checkout(user, product), checkout(user, product), checkout(user, product)]);
    const used = results.filter(r => r.statusCode === 201).reduce((sum, r) => sum + r.body.order.walletUsed, 0);
    const finalBalance = await balance(user._id);
    expect(finalBalance).toBeGreaterThanOrEqual(0);
    expect(walletService.roundMoney(finalBalance + used)).toBe(1000);
    const ledgerSum = (await WalletTransaction.find({ userId: user._id, type: 'ORDER_REDEMPTION' })).reduce((s, t) => s + t.amount, 0);
    expect(walletService.roundMoney(-ledgerSum)).toBe(walletService.roundMoney(used));
  });

  test('admin config changes apply to future orders only', async () => {
    const user = await makeUser();
    const product = await makeProduct({ sellingPrice: 2000, mrp: 2500 });
    const before = await checkout(user, product, { redeemWallet: false });
    expect(before.body.order.rewardCoinsExpected).toBe(200);

    const res = mockRes();
    await updateSettings({ body: { orderRewardPercentage: 5, orderRewardMaxCap: 50 } }, res);
    expect(res.statusCode).toBe(200);

    const after = await checkout(user, product, { redeemWallet: false });
    expect(after.body.order.rewardCoinsExpected).toBe(50);
    expect((await Order.findById(before.body.order._id)).rewardCoinsExpected).toBe(200);
  });

  test('admin settings reject invalid reward values', async () => {
    for (const body of [{ walletRedemptionPercentage: 120 }, { orderRewardPercentage: -1 }, { referralRewardPerOrder: 'abc' }, { orderRewardMaxCap: 10.5 }]) {
      const res = mockRes();
      await updateSettings({ body }, res);
      expect(res.statusCode).toBe(400);
    }
  });
});

describe('Order reward — lock / release / withdraw (unchanged mechanism, new amount)', () => {
  test('9. reward stays locked during the return window', async () => {
    const user = await makeUser();
    const order = await makeOrder({ user, price: 5000 });
    await deliverManually(order._id);

    const summary = await walletService.getWalletSummary(user._id);
    expect(summary).toEqual({ walletBalance: 400, lockedBalance: 400, availableBalance: 0 });
    const txn = await WalletTransaction.findOne({ orderId: order._id, type: 'ORDER_REWARD' });
    expect(txn.source).toBe('ORDER_REWARD');
    expect(txn.unlocksAt.getTime()).toBeGreaterThan(Date.now() + 1.9 * DAY);
  });

  test('10. after the window expires without a return, the coins become available', async () => {
    const user = await makeUser();
    const order = await makeOrder({ user, price: 1000 });
    await deliverManually(order._id);
    await expireReturnWindow(order._id);
    expect(await walletService.getWalletSummary(user._id)).toEqual({ walletBalance: 100, lockedBalance: 0, availableBalance: 100 });
  });

  test('11. returned/refunded order -> locked coins are never released (stay locked while the return is open, then withdrawn)', async () => {
    const user = await makeUser();
    const order = await makeOrder({ user, price: 3000 });
    await deliverManually(order._id);

    await Order.updateOne({ _id: order._id }, { $set: { status: 'Return Requested' } });
    await expireReturnWindow(order._id); // window passes while the return is still open
    expect((await walletService.getWalletSummary(user._id)).availableBalance).toBe(0);

    const fresh = await Order.findById(order._id);
    const returnRequest = await ReturnRequest.create({
      orderId: order._id, userId: user._id, reason: 'Changed Mind', refundAmount: 3000, refundMethod: 'Bank', status: 'Approved',
      items: [{ productId: fresh.items[0].productId, name: 'x', price: 3000, quantity: 1 }]
    });
    await handleReturnRefund(returnRequest, fresh);

    expect(await walletService.getWalletSummary(user._id)).toEqual({ walletBalance: 0, lockedBalance: 0, availableBalance: 0 });
    expect((await Order.findById(order._id)).rewardDeducted).toBe(true);
  });

  test('a rejected return releases the coins normally once the window has passed', async () => {
    const user = await makeUser();
    const order = await makeOrder({ user, price: 1000 });
    await deliverManually(order._id);
    await Order.updateOne({ _id: order._id }, { $set: { status: 'Return Requested' } });
    await expireReturnWindow(order._id);
    expect((await walletService.getWalletSummary(user._id)).availableBalance).toBe(0);

    await Order.updateOne({ _id: order._id }, { $set: { status: 'Delivered' } }); // return rejected
    expect((await walletService.getWalletSummary(user._id)).availableBalance).toBe(100);
  });

  test('13. a clawback never makes the wallet negative', async () => {
    const user = await makeUser();
    const order = await makeOrder({ user, price: 4000 });
    await deliverManually(order._id); // +400
    await expireReturnWindow(order._id);
    await User.updateOne({ _id: user._id }, { $set: { walletBalance: 150 } }); // coins were spent after release

    await handleOrderCancellationRefunds(await Order.findById(order._id), { restoreStock: false });

    expect(await balance(user._id)).toBe(0);
    const reversal = await WalletTransaction.findOne({ orderId: order._id, type: 'ORDER_REWARD_REDUCE' });
    expect(reversal.amount).toBe(-150);
  });
});

describe('Referral reward — fixed amount per successful order of the referred customer', () => {
  const setupReferral = async () => {
    const referrer = await makeUser();
    const referee = await makeUser({ referredBy: referrer._id });
    await Referral.create({ referrer: referrer._id, referee: referee._id, referralCode: 'REFCODE1' });
    return { referrer, referee };
  };

  test('8. three successful orders -> ₹200 each = ₹600, regardless of order value', async () => {
    const { referrer, referee } = await setupReferral();
    for (const price of [500, 5000, 1200]) {
      const order = await makeOrder({ user: referee, price });
      await deliverManually(order._id);
    }
    expect(await balance(referrer._id)).toBe(600);
    const referral = await Referral.findOne({ referrer: referrer._id });
    expect(referral.successfulOrders).toBe(3);
    expect(referral.referrerCoinsAwarded).toBe(600);
    expect(referral.status).toBe('rewarded');
    const ledger = await WalletTransaction.find({ userId: referrer._id, type: 'REFERRAL_REWARD' });
    expect(ledger).toHaveLength(3);
    expect(ledger.every(t => t.source === 'REFERRAL_REWARD' && t.amount === 200 && String(t.referredUserId) === String(referee._id))).toBe(true);
  });

  test('referral reward is credited identically for Shiprocket-delivered and manually-delivered orders', async () => {
    const { referrer, referee } = await setupReferral();
    const viaShiprocket = await makeOrder({ user: referee, price: 2000 });
    const viaManual = await makeOrder({ user: referee, price: 2000 });

    await deliverViaShiprocket(viaShiprocket._id);
    await deliverManually(viaManual._id);

    for (const o of [viaShiprocket, viaManual]) {
      const fresh = await Order.findById(o._id);
      expect(fresh.status).toBe('Delivered');
      expect(fresh.rewardCredited).toBe(true);
      expect(fresh.rewardCoinsAmount).toBe(200);
      expect(fresh.referralRewardCredited).toBe(true);
    }
    expect(await balance(referee._id)).toBe(400); // own rewards
    expect(await balance(referrer._id)).toBe(400); // 2 x 200 referral
  });

  test('referral reward is locked in the return window and withdrawn if the order is refunded', async () => {
    const { referrer, referee } = await setupReferral();
    const order = await makeOrder({ user: referee, price: 1000 });
    await deliverManually(order._id);
    expect(await walletService.getWalletSummary(referrer._id)).toEqual({ walletBalance: 200, lockedBalance: 200, availableBalance: 0 });

    await handleOrderCancellationRefunds(await Order.findById(order._id), { restoreStock: false });
    expect(await balance(referrer._id)).toBe(0);
    expect((await Referral.findOne({ referrer: referrer._id })).successfulOrders).toBe(0);
  });

  test('admin-configured referral amount is used (not hardcoded)', async () => {
    await SystemConfig.updateOne({}, { $set: { referralRewardPerOrder: 350 } });
    const { referrer, referee } = await setupReferral();
    await deliverManually((await makeOrder({ user: referee, price: 100 }))._id);
    expect(await balance(referrer._id)).toBe(350);
  });

  test('a customer who was not referred earns no referral reward for anyone', async () => {
    const customer = await makeUser();
    await deliverManually((await makeOrder({ user: customer, price: 1000 }))._id);
    expect(await WalletTransaction.countDocuments({ type: 'REFERRAL_REWARD' })).toBe(0);
  });
});

describe('12. Duplicate order/payment/delivery events never double-credit', () => {
  test('repeated + concurrent DELIVERED webhooks and a manual update credit each reward exactly once', async () => {
    const referrer = await makeUser();
    const referee = await makeUser({ referredBy: referrer._id });
    await Referral.create({ referrer: referrer._id, referee: referee._id, referralCode: 'DUP' });
    const order = await makeOrder({ user: referee, price: 3000 });

    await Promise.all([deliverViaShiprocket(order._id), deliverViaShiprocket(order._id), walletService.processDeliveredOrderRewards(order._id)]);
    await deliverViaShiprocket(order._id);
    await walletService.processDeliveredOrderRewards(order._id);

    expect(await balance(referee._id)).toBe(300);
    expect(await balance(referrer._id)).toBe(200);
    expect(await WalletTransaction.countDocuments({ orderId: order._id, type: 'ORDER_REWARD' })).toBe(1);
    expect(await WalletTransaction.countDocuments({ orderId: order._id, type: 'REFERRAL_REWARD' })).toBe(1);
  });

  test('a late DELIVERED webhook cannot re-open a cancelled order and earn coins', async () => {
    const user = await makeUser();
    const order = await makeOrder({ user, price: 3000 });
    await Order.updateOne({ _id: order._id }, { $set: { status: 'Cancelled' } });

    await deliverViaShiprocket(order._id);

    const fresh = await Order.findById(order._id);
    expect(fresh.status).toBe('Cancelled');
    expect(fresh.rewardCredited).toBe(false);
    expect(await balance(user._id)).toBe(0);
  });

  test('the database rejects a second ledger entry for the same event', async () => {
    const user = await makeUser();
    await WalletTransaction.create({ userId: user._id, type: 'ORDER_REWARD', amount: 10, idempotencyKey: 'ORDER_REWARD:x' });
    await expect(WalletTransaction.create({ userId: user._id, type: 'ORDER_REWARD', amount: 10, idempotencyKey: 'ORDER_REWARD:x' })).rejects.toThrow(/E11000/);
  });
});

describe('Welcome bonus + single combined wallet', () => {
  test('welcome bonus uses the admin amount, is credited once, and joins the same balance as other coins', async () => {
    await SystemConfig.updateOne({}, { $set: { welcomeBonusCoins: 1500 } });
    const user = await makeUser();

    const results = await Promise.all([walletService.creditWelcomeBonus(user._id), walletService.creditWelcomeBonus(user._id)]);
    expect(results.filter(r => r.success)).toHaveLength(1);
    expect(await balance(user._id)).toBe(1500);

    const order = await makeOrder({ user, price: 1000 });
    await deliverManually(order._id);
    expect(await walletService.getWalletSummary(user._id)).toEqual({ walletBalance: 1600, lockedBalance: 100, availableBalance: 1500 });

    const sources = (await WalletTransaction.find({ userId: user._id })).map(t => t.source).sort();
    expect(sources).toEqual(['ORDER_REWARD', 'WELCOME_BONUS']);
  });

  test('legacy separate referral-coin balances are merged into the wallet once', async () => {
    const user = await makeUser({ walletBalance: 100 });
    await User.collection.updateOne({ _id: user._id }, { $set: { referralCoins: 250, welcomeBonusRemaining: 40 } });

    await walletService.migrateLegacyWalletBalances();
    await walletService.migrateLegacyWalletBalances();

    expect(await balance(user._id)).toBe(350);
    const raw = await User.collection.findOne({ _id: user._id });
    expect(raw.referralCoins).toBeUndefined();
    expect(raw.welcomeBonusRemaining).toBeUndefined();
    expect(await WalletTransaction.countDocuments({ userId: user._id, type: 'LEGACY_BALANCE_MERGE' })).toBe(1);
  });
});
