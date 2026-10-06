// Admin finance breakdown: COD vs Shiprocket COD fees, shipping costs, coins, refunds, product
// cost and the reconciliation checks — orders placed through the real checkout.
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
  sendNotificationToAdmins: jest.fn()
}));
jest.mock('../Router/shiprocketService', () => ({
  ...jest.requireActual('../Router/shiprocketService'),
  checkServiceability: jest.fn(),
  createShiprocketOrder: jest.fn()
}));

const mongoose = require('mongoose');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const shiprocketService = require('../Router/shiprocketService');
const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const SystemConfig = require('../Models/SystemConfig');
const WalletTransaction = require('../Models/WalletTransaction');
const { createOrder } = require('../Controllers/orderController');
const { getFinanceBreakdown } = require('../utils/financeService');
const { getCoinsOverview } = require('../utils/coinsService');

jest.setTimeout(120000);

const COURIERS = [{ courier_company_id: 20, courier_name: 'Cheap', freight_charge: 50, cod_charges: 30, etd: '4 days' }];
const ADDRESS = { name: 'Test Buyer', type: 'Home', address: '1 Street, Agra, UP', pincode: '282002', phone: '7049380550' };

let counter = 0;
const makeUser = async ({ coins = 0 } = {}) => {
  counter += 1;
  const user = await User.create({ phone: `93${String(counter).padStart(8, '0')}`, name: 'Buyer', isVerified: true, walletBalance: coins, refundWalletBalance: 0 });
  if (coins) await WalletTransaction.create({ userId: user._id, type: 'Welcome Bonus', source: 'WELCOME_BONUS', amount: coins });
  return user;
};
const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};
const checkout = async (user, product, { paymentMethod = 'COD', redeemWallet = false } = {}) => {
  const res = mockRes();
  await createOrder({
    user: { _id: user._id },
    body: { items: [{ productId: product._id.toString(), name: product.name, quantity: 1 }], total: 1, deliveryAddress: ADDRESS, paymentMethod, redeemWallet }
  }, res);
  expect(res.statusCode).toBe(201);
  // Our costs are admin-only: never in the customer's response
  expect(res.body.order.shippingCost).toBeUndefined();
  expect(res.body.order.shiprocketCodFee).toBeUndefined();
  expect(res.body.order.items[0].costPrice).toBeUndefined();
  return Order.findById(res.body.order._id);
};

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  jest.clearAllMocks();
  await SystemConfig.create({
    returnWindowDays: 2, commission: 10,
    codChargeEnabled: true, codChargeAmount: 150,
    prepaidDiscountEnabled: true, prepaidDiscountAmount: 100,
    walletRedemptionPercentage: 25
  });
  shiprocketService.checkServiceability.mockResolvedValue({ data: { available_courier_companies: COURIERS } });
  shiprocketService.createShiprocketOrder.mockResolvedValue({ order_id: 111, shipment_id: 222 });
});

test('checkout records Shiprocket costs and product cost on the order, outside the customer bill', async () => {
  const product = await Product.create({ name: 'Shoe', category: 'Shoes', sellingPrice: 1000, mrp: 1200, costPrice: 600, stock: 10, sku: 'FS-1', article: 'FA-1', shippingSpecs: { weight: 0.5 }, status: 'Approved' });
  const order = await checkout(await makeUser(), product);
  expect(order.total).toBe(1000 + 10 + 50 + 150); // product + platform fee + freight + Admin COD charge
  expect(order.shippingCost).toBe(50);
  expect(order.shiprocketCodFee).toBe(30);
  expect(order.items[0].costPrice).toBe(600);
});

test('full breakdown reconciles: COD, prepaid, coins, RTO, legacy order and a refunded return', async () => {
  const product = await Product.create({ name: 'Shoe', category: 'Shoes', sellingPrice: 1000, mrp: 1200, costPrice: 600, stock: 10, sku: 'FS-2', article: 'FA-2', shippingSpecs: { weight: 0.5 }, status: 'Approved' });

  // A: COD, delivered, then one unit returned and refunded ₹1,000
  const userA = await makeUser();
  const a = await checkout(userA, product);
  await Order.updateOne({ _id: a._id }, { status: 'Delivered', paymentStatus: 'Paid' });
  await ReturnRequest.create({
    orderId: a._id, userId: userA._id, items: [{ productId: product._id, name: 'Shoe', price: 1000, quantity: 1 }],
    reason: 'Size/Fit Issue', status: 'Refunded', refundAmount: 1000
  });

  // B: prepaid, 250 coins redeemed (25% of ₹1,000)
  const b = await checkout(await makeUser({ coins: 1000 }), product, { paymentMethod: 'Online', redeemWallet: true });
  expect(b.walletUsed).toBe(250);
  expect(b.total).toBe(1000 + 10 + 50 - 100 - 250);

  // C: COD, shipped (AWB) and then cancelled — RTO freight is still our cost
  const c = await checkout(await makeUser(), product);
  await Order.updateOne({ _id: c._id }, { status: 'Cancelled', awbCode: 'AWB-RTO' });

  // D: legacy COD order (no recorded costs) priced under the old rule: ₹80 = 50 freight + 30 COD fee
  const userD = await makeUser();
  await Order.create({
    userId: userD._id, items: [{ productId: product._id, name: 'Shoe', price: 500, quantity: 1 }],
    subtotal: 500, total: 580, deliveryCharge: 80, deliveryAddress: ADDRESS, paymentMethod: 'COD', status: 'Pending',
    shiprocketResponses: [{ type: 'SERVICEABILITY', data: { data: { available_courier_companies: COURIERS } } }]
  });

  const f = await getFinanceBreakdown();

  expect(f.counts).toMatchObject({ orders: 4, activeOrders: 3, cancelledOrders: 1, codOrders: 2, prepaidOrders: 1 });
  expect(f.income).toMatchObject({
    productSales: 2500, platformFee: 20, deliveryCharges: 180, codCharges: 150, prepaidDiscount: 100, billTotal: 1210 + 960 + 580
  });
  expect(f.payments).toMatchObject({ onlinePayments: 710, codCollected: 1210, codPending: 580, walletCoins: 250, total: 2750 });

  // COD: we billed ₹150 Admin COD charge; Shiprocket charged us ₹30 on A and ₹30 on legacy D
  expect(f.cod).toMatchObject({ codChargesBilled: 150, shiprocketCodFees: 60, margin: 90, cashPending: 580 });
  expect(f.prepaid).toMatchObject({ orders: 1, prepaidDiscountGiven: 100, collected: 710 });
  expect(f.shipping).toMatchObject({ deliveryCharged: 180, shiprocketFreight: 150, rtoFreight: 50, margin: -20 });

  expect(f.adjustments.returnRefunds).toBe(1000);
  expect(f.expenses).toMatchObject({ shiprocketFreight: 150, shiprocketCodFees: 60, rtoFreight: 50, coinsRedeemed: 250 });
  // Product cost: A 600 − 600 returned, B 600, D 600 (current cost price, no snapshot)
  expect(f.expenses.productCost).toBe(1200);

  // A: 1210 − 1000 refund − 50 − 30 = 130 | B: 960 − 250 coins − 50 = 660 | C: −50 RTO | D: 580 − 50 − 30 = 500
  expect(f.results.earningsBeforeProductCost).toBe(130 + 660 - 50 + 500);
  expect(f.results.netProfit).toBe(1240 - 1200);

  expect(f.dataQuality).toMatchObject({ ordersWithRecordedShippingCost: 3, ordersWithDerivedShippingCost: 1, ordersWithEstimatedShippingCost: 0 });
  f.checks.forEach(chk => expect({ key: chk.key, ok: chk.ok }).toEqual({ key: chk.key, ok: true }));

  // Per-order rows add up to the totals — across every page of the order-wise breakdown
  expect(f.orderPagination).toMatchObject({ page: 1, total: 4, pages: 1 });
  const p1 = await getFinanceBreakdown({ orderPage: 1, orderPageSize: 3 });
  const p2 = await getFinanceBreakdown({ orderPage: 2, orderPageSize: 3 });
  expect(p1.orders).toHaveLength(3);
  expect(p2.orders).toHaveLength(1);
  expect(p2.orderPagination).toMatchObject({ page: 2, pageSize: 3, total: 4, pages: 2 });
  const sum = [...p1.orders, ...p2.orders].reduce((s, r) => s + r.earningsBeforeProductCost, 0);
  expect(Math.round(sum * 100) / 100).toBe(f.results.earningsBeforeProductCost);

  // Coins are reported on their own page
  const coinsReport = await getCoinsOverview();
  expect(coinsReport.movement).toMatchObject({ welcome: 1000, redeemed: 250 });
  expect(coinsReport.balance.outstanding).toBe(750);
  expect(coinsReport.welcome).toMatchObject({ recipients: 1, coinsGiven: 1000, recipientsWhoUsedCoins: 1, coinsUsedByRecipients: 250, recipientsCurrentBalance: 750 });
  coinsReport.checks.forEach(chk => expect({ key: chk.key, ok: chk.ok }).toEqual({ key: chk.key, ok: true }));
});

test('mismatches are reported, not hidden', async () => {
  const user = await makeUser();
  await User.updateOne({ _id: user._id }, { walletBalance: 500 }); // balance with no ledger entry
  // Itemized ₹1,000 bill, but only ₹900 recorded as paid
  await Order.create({
    userId: user._id, items: [{ productId: new mongoose.Types.ObjectId(), name: 'X', price: 1000, quantity: 1 }],
    subtotal: 1000, total: 900, shippingCost: 0, shiprocketCodFee: 0, deliveryAddress: ADDRESS, paymentMethod: 'Online', paymentStatus: 'Paid', status: 'Delivered'
  });

  const f = await getFinanceBreakdown();
  const byKey = Object.fromEntries(f.checks.map(c => [c.key, c]));
  const coinChecks = Object.fromEntries((await getCoinsOverview()).checks.map(c => [c.key, c]));
  expect(coinChecks.coinBalances.ok).toBe(false);
  expect(coinChecks.coinBalances.difference).toBe(500);
  expect(byKey.billPaid.ok).toBe(false);
  expect(byKey.billPaid.detail).toMatch(/1 order/);
});

test('legacy data: separate referral coins, orders without a fee breakdown, and duplicate copies', async () => {
  const user = await makeUser();
  const productId = new mongoose.Types.ObjectId();
  const createdAt = new Date('2026-07-01T10:00:00Z');
  const base = { userId: user._id, deliveryAddress: ADDRESS, paymentMethod: 'COD', paymentStatus: 'Paid', status: 'Delivered', shippingCost: 0, shiprocketCodFee: 0 };

  // Itemized order paid partly with the old separate referral-coin wallet
  await Order.create({ ...base, items: [{ productId, name: 'A', price: 800, quantity: 1 }], subtotal: 800, total: 650, referralCoinsUsed: 150 });
  // Old order with no fee breakdown: ₹1,000 of items but ₹1,180 charged
  const legacy = { ...base, items: [{ productId, name: 'B', price: 1000, quantity: 1 }], total: 1180, createdAt };
  await Order.create(legacy);
  // An exact copy of it under a non-ObjectId id (left by an old migration)
  await Order.collection.insertOne({ ...legacy, _id: 'ORD-COPY01' });

  const f = await getFinanceBreakdown();
  expect(f.dataQuality.duplicateRecordsSkipped).toBe(1);
  expect(f.dataQuality.ordersWithoutFeeBreakdown).toBe(1);
  expect(f.counts.orders).toBe(2);
  expect(f.income.unitemizedCharges).toBe(180);
  expect(f.income.billTotal).toBe(800 + 1180);
  expect(f.payments.walletCoins).toBe(150);
  expect(f.expenses.coinsRedeemed).toBe(150);
  f.checks.forEach(chk => expect({ key: chk.key, ok: chk.ok }).toEqual({ key: chk.key, ok: true }));
});
