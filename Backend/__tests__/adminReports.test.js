// Coins & Rewards reports (overview, per purchase, per customer, ledger) and the paginated,
// server-filtered admin orders list.
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
  sendNotificationToAdmins: jest.fn()
}));

const mongoose = require('mongoose');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const Order = require('../Models/Order');
const User = require('../Models/User');
const SystemConfig = require('../Models/SystemConfig');
const WalletTransaction = require('../Models/WalletTransaction');
const { getCoinsOverview, getPurchaseRewards, getCustomerCoins, getCoinLedger } = require('../utils/coinsService');
const { getAllOrders } = require('../Controllers/orderController');

jest.setTimeout(120000);

const ADDRESS = { name: 'Buyer', type: 'Home', address: '1 Street, Agra, UP', pincode: '282002', phone: '7049380550' };
const DAY = 24 * 60 * 60 * 1000;
let counter = 0;

const makeUser = (fields = {}) => {
  counter += 1;
  return User.create({ phone: `95${String(counter).padStart(8, '0')}`, name: `Customer ${counter}`, isVerified: true, walletBalance: 0, ...fields });
};
const makeOrder = (userId, fields = {}) => Order.create({
  userId, items: [{ productId: new mongoose.Types.ObjectId(), name: 'Shoe', price: 1000, quantity: 1 }],
  subtotal: 1000, total: 1000, deliveryAddress: ADDRESS, paymentMethod: 'COD', status: 'Delivered', ...fields
});
const ledger = (userId, type, amount, fields = {}) => WalletTransaction.create({ userId, type, amount, ...fields });
const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create({ returnWindowDays: 2 });
});

describe('Coins & Rewards', () => {
  let buyer; let referrer;

  beforeEach(async () => {
    referrer = await makeUser({ walletBalance: 200 });
    buyer = await makeUser({ walletBalance: 530 });
    const now = Date.now();

    await ledger(buyer._id, 'Welcome Bonus', 500, { source: 'WELCOME_BONUS' });
    // Locked: credited just now
    const locked = await makeOrder(buyer._id, { rewardCredited: true, rewardCreditedAt: new Date(now), rewardCoinsAmount: 100, rewardCoinsExpected: 100 });
    await ledger(buyer._id, 'ORDER_REWARD', 100, { orderId: locked._id });
    // Released: credited 10 days ago (return window is 2 days)
    const released = await makeOrder(buyer._id, { rewardCredited: true, rewardCreditedAt: new Date(now - 10 * DAY), rewardCoinsAmount: 50, rewardCoinsExpected: 50 });
    await ledger(buyer._id, 'ORDER_REWARD', 50, { orderId: released._id });
    // Clawed back after a return
    const returned = await makeOrder(buyer._id, { status: 'Refunded', rewardCredited: true, rewardDeducted: true, rewardCreditedAt: new Date(now - 5 * DAY), rewardCoinsAmount: 30, rewardCoinsExpected: 30 });
    await ledger(buyer._id, 'ORDER_REWARD', 30, { orderId: returned._id });
    await ledger(buyer._id, 'ORDER_REWARD_REDUCE', -30, { orderId: returned._id });
    // Not delivered yet: reward pending
    await makeOrder(buyer._id, { status: 'Processing', rewardCoinsExpected: 70 });
    // Referred order: the referrer's reward is locked
    const referred = await makeOrder(buyer._id, { rewardCoinsExpected: 0, referrerId: referrer._id, referralRewardCredited: true, referralRewardCreditedAt: new Date(now), referralRewardAmount: 200 });
    await ledger(referrer._id, 'REFERRAL_REWARD', 200, { orderId: referred._id });
    // Paid partly with 120 coins
    const usedCoins = await makeOrder(buyer._id, { rewardCoinsExpected: 0, walletUsed: 120, total: 880 });
    await ledger(buyer._id, 'ORDER_REDEMPTION', -120, { orderId: usedCoins._id });
  });

  test('overview splits coins by source, status and liability, and reconciles', async () => {
    const o = await getCoinsOverview();
    expect(o.movement).toMatchObject({
      welcome: 500, purchaseReward: 180, purchaseRewardClawback: 30, referralReward: 200, redeemed: 120, issued: 880, removed: 150, netChange: 730
    });
    expect(o.welcome).toMatchObject({ recipients: 1, coinsGiven: 500, recipientsWhoUsedCoins: 1, coinsUsedByRecipients: 120, recipientsCurrentBalance: 530 });
    expect(o.purchase).toMatchObject({ pendingDelivery: 70, locked: 100, released: 50, clawedBack: 30, ordersUsingCoins: 1, coinsUsedOnOrders: 120 });
    expect(o.referral).toMatchObject({ locked: 200, released: 0 });
    expect(o.balance).toMatchObject({ outstanding: 730, lockedNow: 300, spendableNow: 430, customersWithCoins: 2 });
    o.checks.forEach(c => expect({ key: c.key, ok: c.ok }).toEqual({ key: c.key, ok: true }));
  });

  test('per-purchase rewards are paginated and filterable', async () => {
    const all = await getPurchaseRewards({ page: 1, pageSize: 4 });
    expect(all.pagination).toMatchObject({ total: 6, pages: 2, page: 1 });
    expect(all.rows).toHaveLength(4);

    const credited = await getPurchaseRewards({ filter: 'credited' });
    expect(credited.rows.map(r => r.reward.status).sort()).toEqual(['Locked', 'Released']);
    const lockedRow = credited.rows.find(r => r.reward.status === 'Locked');
    expect(lockedRow.reward.unlocksAt).toBeTruthy();

    const used = await getPurchaseRewards({ filter: 'usedCoins' });
    expect(used.rows).toHaveLength(1);
    expect(used.rows[0].coinsUsed).toBe(120);

    const referred = await getPurchaseRewards({ filter: 'referral' });
    expect(referred.rows[0].referral).toMatchObject({ status: 'Locked', coins: 200 });
    expect(referred.rows[0].referral.referrer.name).toBe(referrer.name);
  });

  test('per-customer breakdown: received by source, used, locked and spendable', async () => {
    const page1 = await getCustomerCoins({ page: 1, pageSize: 1 });
    expect(page1.pagination).toMatchObject({ total: 2, pages: 2 });
    expect(page1.rows[0]).toMatchObject({
      name: buyer.name, welcome: 500, purchaseRewards: 180, referralRewards: 0, clawedBack: 30, usedOnOrders: 120,
      balance: 530, locked: 100, spendable: 430, matchesLedger: true
    });
    const searched = await getCustomerCoins({ search: referrer.phone });
    expect(searched.rows).toHaveLength(1);
    expect(searched.rows[0]).toMatchObject({ referralRewards: 200, balance: 200, locked: 200, spendable: 0 });
  });

  test('ledger lists every coin entry, filterable by source', async () => {
    const all = await getCoinLedger({ page: 1, pageSize: 5 });
    expect(all.pagination).toMatchObject({ total: 7, pages: 2 });
    const welcome = await getCoinLedger({ source: 'welcome' });
    expect(welcome.rows).toHaveLength(1);
    expect(welcome.rows[0]).toMatchObject({ label: 'Welcome Bonus', amount: 500 });
    const used = await getCoinLedger({ source: 'redeemed' });
    expect(used.rows[0].amount).toBe(-120);
    const clawbacks = await getCoinLedger({ source: 'purchaseRewardClawback' });
    expect(clawbacks.rows[0].amount).toBe(-30);
  });
});

test('legacy positive "Redemption" entries count as credits, like the wallet itself treats them', async () => {
  const user = await makeUser({ walletBalance: 8 });
  await ledger(user._id, 'Redemption', 8);
  const o = await getCoinsOverview();
  expect(o.movement).toMatchObject({ redeemed: 0, otherCredit: 8 });
  const row = (await getCustomerCoins({})).rows[0];
  expect(row).toMatchObject({ otherCredits: 8, usedOnOrders: 0, balance: 8, matchesLedger: true });
  o.checks.forEach(c => expect({ key: c.key, ok: c.ok }).toEqual({ key: c.key, ok: true }));
});

describe('Admin orders list', () => {
  test('paginates on the server, filters by status/search across all orders, and returns all-order stats', async () => {
    const asha = await makeUser({ name: 'Asha Verma' });
    const ravi = await makeUser({ name: 'Ravi Kumar' });
    for (let i = 0; i < 25; i++) await makeOrder(asha._id, { status: 'Pending', total: 100 });
    await makeOrder(ravi._id, { status: 'Shipped', total: 500 });
    const cancelled = await makeOrder(ravi._id, { status: 'Cancelled', total: 999 });

    const call = async (query) => { const res = mockRes(); await getAllOrders({ query }, res); return res.body; };

    const p2 = await call({ page: '2', limit: '20' });
    expect(p2).toMatchObject({ total: 27, pages: 2, page: 2, count: 7 });
    expect(p2.stats).toMatchObject({ totalSales: 2500 + 500, pending: 25, inTransit: 1, cancelled: 1 });
    expect(p2.stats.statusCounts).toMatchObject({ All: 27, Pending: 25, Shipped: 1, Cancelled: 1 });

    const shipped = await call({ status: 'Shipped' });
    expect(shipped.total).toBe(1);

    const byName = await call({ search: 'ravi' });
    expect(byName.total).toBe(2);
    // stats still describe all orders, not the search result
    expect(byName.stats.statusCounts.All).toBe(27);

    const byId = await call({ search: String(cancelled._id).slice(-6) });
    expect(byId.total).toBe(1);
    expect(String(byId.orders[0]._id)).toBe(String(cancelled._id));

    const weird = await call({ search: 'a.(b' }); // regex characters are treated literally
    expect(weird.total).toBe(0);
  });
});
