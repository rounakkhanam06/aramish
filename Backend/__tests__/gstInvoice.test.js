// GST tax invoices: GST-inclusive calculation, rates by date/slab, CGST+SGST vs IGST, numbering
// (unique, sequential, assigned once), issuance at dispatch, and download permissions.

process.env.JWT_SECRET = 'test_user_secret';
process.env.JWT_ADMIN_SECRET = 'test_admin_secret';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.SHIPROCKET_WEBHOOK_SECRET = 'sr_test_secret';
process.env.SMS_INDIA_HUB_API_KEY = '';
process.env.SMS_API_KEY = '';
process.env.ENV = 'test';

jest.mock('axios');
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToAdmins: jest.fn(),
  sendNotificationToUser: jest.fn(() => Promise.resolve())
}));
jest.mock('../Router/shiprocketService', () => {
  const actual = jest.requireActual('../Router/shiprocketService');
  let n = 0;
  return {
    ...actual,
    getShiprocketToken: jest.fn(async () => null),
    checkServiceability: jest.fn(async () => ({
      data: { available_courier_companies: [{ freight_charge: 50, cod_charges: 0, etd: '3 days' }] }
    })),
    createShiprocketOrder: jest.fn(async () => ({ order_id: `SR${++n}`, shipment_id: `SH${n}` })),
    cancelShiprocketOrder: jest.fn(async () => ({ ok: true }))
  };
});

const jwt = require('jsonwebtoken');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const app = require('../app');
const Order = require('../Models/Order');
const User = require('../Models/User');
const Admin = require('../Models/Admin');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const Counter = require('../Models/Counter');
const SystemConfig = require('../Models/SystemConfig');
const {
  computeInvoiceData, issueInvoice, financialYear, amountInWords, footwearRate, rateRuleFor, DEFAULT_GST_RATE_RULES
} = require('../utils/invoiceService');
const { gstinError } = require('../utils/gstData');

jest.setTimeout(120000);

const SELLER_GSTIN = '23ABCDE1234F1Z8'; // Madhya Pradesh
const BUYER_GSTIN = '27AAPFU0939F1ZV'; // Maharashtra
const SELLER = {
  businessLegalName: 'Aramish Footwear Private Limited',
  businessTradeName: 'Aramish Shoes',
  businessAddress: '12 Industrial Area, Indore',
  businessState: 'Madhya Pradesh',
  businessStateCode: '23',
  businessPan: 'ABCDE1234F',
  gstNo: SELLER_GSTIN,
  invoicePrefix: 'ARM',
  defaultHsnCode: '6404'
};
const FY = financialYear(new Date());

let server;
let baseUrl;
let counter = 0;

const api = async (method, path, { token, body, headers = {}, raw = false } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (raw) return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  return { status: res.status, data };
};

const makeUser = async () => {
  counter += 1;
  const user = await User.create({ phone: `97${String(counter).padStart(8, '0')}`, name: `User ${counter}`, isVerified: true });
  const token = jwt.sign({ id: user._id, aud: 'user', tokenVersion: user.tokenVersion }, process.env.JWT_SECRET);
  return { user, token };
};

const makeAdmin = async () => {
  counter += 1;
  const admin = await Admin.create({ email: `gstadmin${counter}@test.com`, password: 'Password123!' });
  return jwt.sign({ id: admin._id, aud: 'admin' }, process.env.JWT_ADMIN_SECRET);
};

const makeProduct = async (overrides = {}) => {
  counter += 1;
  return Product.create({
    name: `Runner ${counter}`, category: 'Shoes', sellingPrice: 1000, mrp: 1500, stock: 50,
    sku: `G-${counter}`, article: `GA-${counter}`, hsnCode: '6403', shippingSpecs: { weight: 0.5 },
    status: 'Approved', ...overrides
  });
};

const MP_ADDRESS = { name: 'Asha', type: 'Home', address: '5 MG Road, Indore', pincode: '452001', phone: '9999999999', state: 'Madhya Pradesh' };
const MH_ADDRESS_NO_STATE = { name: 'Ravi', type: 'Work', address: '1 Marine Drive, Mumbai', pincode: '400001', phone: '9888888888' };

const placeOrder = (token, items, extra = {}) => api('POST', '/orders', {
  token,
  body: {
    items: items.map(i => ({ productId: i.product._id.toString(), quantity: i.qty, name: i.product.name })),
    total: 1,
    deliveryAddress: MP_ADDRESS,
    paymentMethod: 'COD',
    ...extra
  }
});

const setStatus = (adminToken, id, status) => api('PUT', `/orders/admin/${id}/status`, { token: adminToken, body: { status } });
const advance = async (adminToken, id, statuses) => {
  for (const s of statuses) {
    const r = await setStatus(adminToken, id, s);
    if (r.status !== 200) throw new Error(`${s} failed: ${r.data && r.data.message}`);
  }
};
const DELIVER = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];

beforeAll(async () => {
  await startTestDb();
  for (const m of [Admin, Counter, require('../Models/Cart'), require('../Models/Notification'), require('../Models/Address')]) {
    await m.createCollection();
  }
  await Order.syncIndexes();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  await SystemConfig.create({ freeShippingEnabled: false, codChargeAmount: 150, prepaidDiscountAmount: 100, commission: 10, ...SELLER });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GSTIN and rate rules', () => {
  test('GSTIN validation: format, state code, check digit, placeholders', () => {
    expect(gstinError(SELLER_GSTIN)).toBeNull();
    expect(gstinError(BUYER_GSTIN)).toBeNull();
    expect(gstinError('27AAPFU0939F1ZA')).toMatch(/check digit/);
    expect(gstinError('99AAPFU0939F1ZV')).toMatch(/state code/);
    expect(gstinError('27AAPFU0939F')).toMatch(/format/);
    expect(gstinError('07AAAAA0000A1Z5')).not.toBeNull(); // old placeholder default
  });

  test('footwear rates by date and per-pair sale value (GST-inclusive price)', () => {
    const before = rateRuleFor(new Date('2025-09-21T12:00:00+05:30'), DEFAULT_GST_RATE_RULES);
    const after = rateRuleFor(new Date('2025-09-22T00:00:00+05:30'), DEFAULT_GST_RATE_RULES);
    expect(footwearRate(80000, before)).toBe(12); // Rs 800 pair before 22-09-2025
    expect(footwearRate(300000, before)).toBe(12);
    // Taxable value at 5% <= Rs 2,500  <=>  inclusive price <= Rs 2,625
    expect(footwearRate(262500, after)).toBe(5);
    expect(footwearRate(262501, after)).toBe(18);
    expect(footwearRate(100000, after)).toBe(5);
    expect(rateRuleFor(new Date('2021-06-01'), DEFAULT_GST_RATE_RULES)).toBeNull();
  });

  test('amount in words uses the Indian numbering system', () => {
    expect(amountInWords(123456789)).toBe('Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Paise Only');
    expect(amountInWords(201000)).toBe('Rupees Two Thousand Ten Only');
  });
});

describe('invoice calculation (GST-inclusive, never added on top)', () => {
  const baseOrder = (over = {}) => ({
    _id: '64b000000000000000000001',
    createdAt: new Date(),
    paymentMethod: 'COD',
    items: [{ name: 'Runner', price: 1000, quantity: 2, hsnCode: '6403', gstRateOverride: null, attributes: { Size: '8' } }],
    discountAmount: 0, prepaidDiscount: 0, platformCommission: 0, deliveryCharge: 0, codCharge: 0,
    walletUsed: 0, refundWalletUsed: 0,
    deliveryAddress: { ...MP_ADDRESS, stateCode: '23', stateSource: 'customer' },
    ...over
  });
  const cents = (n) => Math.round(n * 100);
  const lineTotal = (l) => cents(l.taxable) + cents(l.cgst) + cents(l.sgst) + cents(l.igst);

  test('intra-state COD with coupon, platform fee, delivery and COD charge -> CGST + SGST at 5%', () => {
    const order = baseOrder({ discountAmount: 200, platformCommission: 10, deliveryCharge: 50, codCharge: 150, total: 2010 });
    const d = computeInvoiceData(order, SELLER, new Date());
    expect(d.interState).toBe(false);
    expect(d.totals.grandTotal).toBe(2010); // exactly what was billed, no GST on top
    expect(d.totals.igst).toBe(0);
    expect(Math.abs(d.totals.cgst - d.totals.sgst)).toBeLessThanOrEqual(0.01);
    d.lines.forEach(l => {
      expect(l.rate).toBe(5); // Rs 900 net per pair after coupon
      expect(lineTotal(l)).toBe(cents(l.net));
    });
    const goods = d.lines.find(l => l.kind === 'goods');
    expect(goods.discount).toBe(200);
    expect(goods.net).toBe(1800);
    expect(goods.taxable).toBe(1714.29); // 1800 x 100 / 105
    expect(d.lines.filter(l => l.kind === 'charge').map(l => l.description)).toEqual(['Platform fee', 'Delivery charges', 'COD charges']);
    expect(d.totals.taxable + d.totals.totalTax).toBeCloseTo(2010, 2);
    expect(d.buyer.gstin).toBeNull();
    expect(d.seller.gstin).toBe(SELLER_GSTIN);
  });

  test('inter-state prepaid, mixed 5%/18% goods, wallet is payment (not a discount) -> IGST', () => {
    const order = baseOrder({
      paymentMethod: 'Online',
      items: [
        { name: 'Runner', price: 1000, quantity: 1, hsnCode: '6403' },
        { name: 'Boot', price: 3000, quantity: 1, hsnCode: '6403' }
      ],
      prepaidDiscount: 100, platformCommission: 10, deliveryCharge: 50, walletUsed: 300, total: 3660,
      deliveryAddress: { ...MH_ADDRESS_NO_STATE, state: 'Maharashtra', stateCode: '27', stateSource: 'customer' },
      buyerGstin: BUYER_GSTIN, buyerBusinessName: 'Ravi Traders'
    });
    const d = computeInvoiceData(order, SELLER, new Date());
    expect(d.interState).toBe(true);
    expect(d.totals.cgst + d.totals.sgst).toBe(0);
    expect(d.totals.grandTotal).toBe(3960); // 3660 paid + 300 coins
    const goods = d.lines.filter(l => l.kind === 'goods');
    expect(goods.map(l => l.rate)).toEqual([5, 18]);
    expect(goods[0].discount + goods[1].discount).toBe(100); // prepaid discount spread by value
    // Charges split across the two rate groups
    expect(d.lines.filter(l => l.kind === 'charge').map(l => l.rate).sort()).toEqual([18, 18, 5, 5].sort());
    d.lines.forEach(l => expect(lineTotal(l)).toBe(cents(l.net)));
    expect(d.payment).toEqual({ walletCoins: 300, refundWallet: 0, balance: 3660, balanceMode: 'Paid online' });
    expect(d.buyer).toMatchObject({ gstin: BUYER_GSTIN, businessName: 'Ravi Traders', stateCode: '27' });
    expect(d.hsnSummary.map(h => h.rate).sort()).toEqual([18, 5].sort());
  });

  test('per-product GST override wins over the slab rule', () => {
    const order = baseOrder({ items: [{ name: 'Insole', price: 500, quantity: 1, hsnCode: '6406', gstRateOverride: 18 }], total: 500 });
    const d = computeInvoiceData(order, SELLER, new Date());
    expect(d.lines[0].rate).toBe(18);
  });

  test('invoice date picks the rate in force (12% before 22-09-2025)', () => {
    const order = baseOrder({ total: 2000 });
    const d = computeInvoiceData(order, SELLER, new Date('2025-09-01T10:00:00+05:30'));
    expect(d.lines[0].rate).toBe(12);
  });

  test('refuses when the computed total does not match the bill, or place of supply is unknown', () => {
    expect(() => computeInvoiceData(baseOrder({ total: 1999 }), SELLER, new Date())).toThrow(/does not match/);
    expect(() => computeInvoiceData(baseOrder({ total: 2000, deliveryAddress: { name: 'x', address: 'y', pincode: '' } }), SELLER, new Date()))
      .toThrow(/place of supply/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('checkout captures tax data', () => {
  test('COD order with valid buyer GSTIN stores HSN snapshot, state and GSTIN', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, qty: 2 }], { buyerGstin: ` ${BUYER_GSTIN.toLowerCase()} `, buyerBusinessName: 'Ravi Traders' });
    expect(r.status).toBe(201);
    const o = await Order.findById(r.data.order._id).lean();
    expect(o.taxDataCapturedAt).toBeTruthy();
    expect(o.items[0]).toMatchObject({ hsnCode: '6403', gstRateOverride: null });
    expect(o.deliveryAddress).toMatchObject({ state: 'Madhya Pradesh', stateCode: '23', stateSource: 'customer' });
    expect(o.buyerGstin).toBe(BUYER_GSTIN);
    expect(o.total).toBe(2000 + 10 + 50 + 150); // GST-inclusive: nothing added on top
    expect(r.data.order.invoice).toBeNull();
    expect(r.data.order.invoiceAvailable).toBe(false);
  });

  test('invalid buyer GSTIN is rejected before any stock is taken', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, qty: 1 }], { buyerGstin: '27AAPFU0939F1ZA' });
    expect(r.status).toBe(400);
    expect(r.data.message).toMatch(/GSTIN/);
    expect(await Order.countDocuments()).toBe(0);
    expect((await Product.findById(p._id)).stock).toBe(50);
  });

  test('address without a state falls back to the pincode state (flagged), product without HSN uses the default', async () => {
    const { token } = await makeUser();
    const p = await makeProduct({ hsnCode: '' });
    const r = await placeOrder(token, [{ product: p, qty: 1 }], { deliveryAddress: MH_ADDRESS_NO_STATE, paymentMethod: 'Online' });
    expect(r.status).toBe(201);
    const o = await Order.findById(r.data.order._id).lean();
    expect(o.deliveryAddress).toMatchObject({ state: 'Maharashtra', stateCode: '27', stateSource: 'pincode' });
    expect(o.items[0].hsnCode).toBe('6404');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('issuance at dispatch and download permissions', () => {
  test('COD: issued once at Shipped, downloadable by the customer only after delivery', async () => {
    const admin = await makeAdmin();
    const { token } = await makeUser();
    const other = await makeUser();
    const p = await makeProduct();
    const coupon = await Coupon.create({ code: 'FLAT200', type: 'Fixed Amount', value: 200, status: 'Active', expiry: new Date(Date.now() + 864e5), usageLimit: 10 });
    const r = await placeOrder(token, [{ product: p, qty: 2 }], { couponCode: coupon.code });
    expect(r.status).toBe(201);
    const id = r.data.order._id;

    let dl = await api('GET', `/orders/${id}/invoice`, { token });
    expect(dl.status).toBe(403);
    expect(dl.data.code).toBe('NOT_DELIVERED');

    await advance(admin, id, ['Processing']);
    expect((await Order.findById(id)).invoice.number).toBeUndefined();

    const shipped = await setStatus(admin, id, 'Shipped');
    expect(shipped.status).toBe(200);
    const o = await Order.findById(id).lean();
    expect(o.invoice.number).toBe(`ARM/${FY}/000001`);
    expect(o.invoice.data.totals.grandTotal).toBe(2000 - 200 + 10 + 50 + 150);
    expect(o.invoice.data.interState).toBe(false);

    // Shipped but not delivered: still not downloadable by the customer; admin can.
    dl = await api('GET', `/orders/${id}/invoice`, { token });
    expect(dl.status).toBe(403);
    const adminDl = await api('GET', `/orders/admin/${id}/invoice`, { token: admin, raw: true });
    expect(adminDl.status).toBe(200);
    expect(adminDl.headers.get('content-type')).toMatch(/application\/pdf/);

    await advance(admin, id, ['Out for Delivery', 'Delivered']);
    const after = await Order.findById(id).lean();
    expect(after.invoice.number).toBe(`ARM/${FY}/000001`); // not re-issued on delivery
    expect(after.invoice.date).toEqual(o.invoice.date);

    const pdf = await api('GET', `/orders/${id}/invoice`, { token, raw: true });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toMatch(/application\/pdf/);
    expect(pdf.headers.get('content-disposition')).toContain(`Invoice_ARM-${FY}-000001.pdf`);
    expect(pdf.buffer.slice(0, 5).toString()).toBe('%PDF-');

    const stranger = await api('GET', `/orders/${id}/invoice`, { token: other.token });
    expect(stranger.status).toBe(403);
    const anon = await api('GET', `/orders/${id}/invoice`);
    expect(anon.status).toBe(401);
    const userOnAdminRoute = await api('GET', `/orders/admin/${id}/invoice`, { token });
    expect(userOnAdminRoute.status).toBe(401);

    const again = await api('POST', `/orders/admin/${id}/invoice`, { token: admin });
    expect(again.status).toBe(200);
    expect(again.data.invoice.number).toBe(`ARM/${FY}/000001`);
    expect((await Counter.findById(`invoice:ARM:${FY}`)).seq).toBe(1);

    const list = await api('GET', '/orders', { token });
    expect(list.data.orders[0].invoice.number).toBe(`ARM/${FY}/000001`);
    expect(list.data.orders[0].invoiceAvailable).toBe(true);
    expect(list.data.orders[0].invoice.data).toBeUndefined();
  });

  test('prepaid inter-state order gets the next number with IGST; Shiprocket pickup issues it', async () => {
    const admin = await makeAdmin();
    const { token } = await makeUser();
    const p = await makeProduct({ sellingPrice: 3000, mrp: 3500 });
    const first = await placeOrder(token, [{ product: p, qty: 1 }]);
    await advance(admin, first.data.order._id, ['Processing', 'Shipped']);

    const r = await placeOrder(token, [{ product: p, qty: 1 }], { paymentMethod: 'Online', deliveryAddress: { ...MH_ADDRESS_NO_STATE, state: 'Maharashtra' } });
    expect(r.status).toBe(201);
    const id = r.data.order._id;
    await advance(admin, id, ['Processing']);

    const hook = await api('POST', '/shiprocket/webhook', {
      headers: { 'x-api-key': process.env.SHIPROCKET_WEBHOOK_SECRET },
      body: { channel_order_id: `ORD_${id}`, current_status: 'PICKED UP' }
    });
    expect(hook.status).toBe(200);
    const o = await Order.findById(id).lean();
    expect(o.status).toBe('Processing');
    expect(o.invoice.number).toBe(`ARM/${FY}/000002`);
    const d = o.invoice.data;
    expect(d.interState).toBe(true);
    expect(d.totals.cgst).toBe(0);
    expect(d.lines.find(l => l.kind === 'goods').rate).toBe(18); // Rs 2,900 per pair after prepaid discount
    expect(d.totals.grandTotal).toBe(3000 - 100 + 10 + 50);
    expect(d.payment.balanceMode).toBe('Paid online');
  });

  test('concurrent issuance: one number per order, sequential with no gaps or duplicates', async () => {
    const { token } = await makeUser();
    const p = await makeProduct();
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const r = await placeOrder(token, [{ product: p, qty: 1 }]);
      ids.push(r.data.order._id);
    }
    await Order.updateMany({ _id: { $in: ids } }, { status: 'Shipped' });

    // Same order hammered in parallel: exactly one number.
    const same = await Promise.all(Array.from({ length: 6 }, () => issueInvoice(ids[0])));
    expect(new Set(same.map(s => s.order.invoice.number)).size).toBe(1);
    expect(same.filter(s => s.created).length).toBe(1);

    // Different orders in parallel: distinct consecutive numbers.
    const many = await Promise.all(ids.slice(1).map(id => issueInvoice(id)));
    const seqs = [same[0].order.invoice.sequence, ...many.map(m => m.order.invoice.sequence)].sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2, 3, 4, 5]);
    expect((await Counter.findById(`invoice:ARM:${FY}`)).seq).toBe(5);
    await expect(Order.collection.updateOne({ _id: many[0].order._id }, { $set: { 'invoice.number': same[0].order.invoice.number } }))
      .rejects.toThrow(/duplicate key/);
  });

  test('historical orders (no tax snapshot) are never auto-invoiced', async () => {
    const admin = await makeAdmin();
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, qty: 1 }]);
    const id = r.data.order._id;
    await Order.updateOne({ _id: id }, { $set: { taxDataCapturedAt: null } });
    await advance(admin, id, DELIVER);
    expect((await Order.findById(id)).invoice.number).toBeUndefined();

    const dl = await api('GET', `/orders/${id}/invoice`, { token });
    expect(dl.status).toBe(409);
    expect(dl.data.code).toBe('HISTORICAL_ORDER');
    const issue = await api('POST', `/orders/admin/${id}/invoice`, { token: admin });
    expect(issue.status).toBe(409);
    const st = await api('GET', `/orders/admin/${id}/invoice-status`, { token: admin });
    expect(st.data.state).toBe('historical');
  });

  test('incomplete seller settings block issuance without breaking the status update', async () => {
    await SystemConfig.updateOne({}, { $set: { gstNo: '07AAAAA0000A1Z5' } });
    const admin = await makeAdmin();
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, qty: 1 }]);
    const id = r.data.order._id;
    await advance(admin, id, ['Processing', 'Shipped']);
    expect((await Order.findById(id)).status).toBe('Shipped');
    expect((await Order.findById(id)).invoice.number).toBeUndefined();

    const issue = await api('POST', `/orders/admin/${id}/invoice`, { token: admin });
    expect(issue.status).toBe(409);
    expect(issue.data.code).toBe('SELLER_DETAILS_INCOMPLETE');
    const st = await api('GET', `/orders/admin/${id}/invoice-status`, { token: admin });
    expect(st.data.state).toBe('due');
    expect(st.data.settingsProblems.join(' ')).toMatch(/GSTIN/);

    // Fixed settings -> issued on demand (customer download after delivery also catches up)
    await SystemConfig.updateOne({}, { $set: { gstNo: SELLER_GSTIN } });
    await advance(admin, id, ['Out for Delivery', 'Delivered']);
    const o = await Order.findById(id).lean();
    expect(o.invoice.number).toBe(`ARM/${FY}/000001`);
  });

  test('pending orders cannot be invoiced; cancelled orders are never downloadable by the customer', async () => {
    const admin = await makeAdmin();
    const { token } = await makeUser();
    const p = await makeProduct();
    const r = await placeOrder(token, [{ product: p, qty: 1 }]);
    const id = r.data.order._id;
    const early = await api('POST', `/orders/admin/${id}/invoice`, { token: admin });
    expect(early.status).toBe(409);
    expect(early.data.code).toBe('NOT_DISPATCHED');

    await advance(admin, id, ['Processing', 'Shipped']);
    const cancel = await api('POST', `/orders/${id}/cancel`, { token });
    expect(cancel.status).toBe(200);
    const dl = await api('GET', `/orders/${id}/invoice`, { token });
    expect(dl.status).toBe(403);
    const st = await api('GET', `/orders/admin/${id}/invoice-status`, { token: admin });
    expect(st.data.state).toBe('issued_cancelled');
    const adminPdf = await api('GET', `/orders/admin/${id}/invoice`, { token: admin, raw: true });
    expect(adminPdf.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Business & Tax settings and addresses', () => {
  test('settings validate GSTIN, PAN, state and rate rules', async () => {
    const admin = await makeAdmin();
    const put = (body) => api('PUT', '/admin/settings', { token: admin, body });
    expect((await put({ gstNo: '27AAPFU0939F1ZA' })).status).toBe(400);
    expect((await put({ gstNo: BUYER_GSTIN })).data.message).toMatch(/state code 27/); // seller is in MP (23)
    expect((await put({ businessPan: 'ABCDE1234X' })).data.message).toMatch(/PAN does not match/);
    expect((await put({ businessState: 'Madhya Pradesh', businessStateCode: '27' })).status).toBe(400);
    expect((await put({ gstRateRules: [] })).status).toBe(400);
    expect((await put({ gstRateRules: [{ effectiveFrom: '2025-09-22', threshold: 2500, rateUpToThreshold: 7, rateAboveThreshold: 18 }] })).status).toBe(400);

    const ok = await put({
      businessState: 'maharashtra', gstNo: BUYER_GSTIN.toLowerCase(), businessPan: 'aapfu0939f',
      businessLegalName: 'New Legal Name', invoicePrefix: 'arm',
      gstRateRules: [{ effectiveFrom: '2025-09-22', threshold: 2500, rateUpToThreshold: 5, rateAboveThreshold: 18 }]
    });
    expect(ok.status).toBe(200);
    expect(ok.data.settings).toMatchObject({ businessState: 'Maharashtra', businessStateCode: '27', gstNo: BUYER_GSTIN, businessPan: 'AAPFU0939F', invoicePrefix: 'ARM' });
    expect(ok.data.settings.gstRateRules).toHaveLength(1);
  });

  test('an unchanged stored placeholder GSTIN does not block saving other settings (but blocks invoicing)', async () => {
    await SystemConfig.updateOne({}, { $set: { gstNo: '07AAAAA0000A1Z5', businessPan: '' } });
    const admin = await makeAdmin();
    const r = await api('PUT', '/admin/settings', { token: admin, body: { gstNo: '07AAAAA0000A1Z5', businessPan: '', codChargeAmount: 99 } });
    expect(r.status).toBe(200);
    expect(r.data.settings.codChargeAmount).toBe(99);
    const changed = await api('PUT', '/admin/settings', { token: admin, body: { gstNo: '07AAAAA0000A1Z6' } });
    expect(changed.status).toBe(400);
  });

  test('address API stores a canonical state and rejects unknown states', async () => {
    const { token } = await makeUser();
    const bad = await api('POST', '/addresses', { token, body: { ...MP_ADDRESS, state: 'Atlantis' } });
    expect(bad.status).toBe(400);
    const good = await api('POST', '/addresses', { token, body: { ...MP_ADDRESS, state: 'madhya pradesh' } });
    expect(good.status).toBe(201);
    expect(good.data.data.state).toBe('Madhya Pradesh');
    const upd = await api('PUT', `/addresses/${good.data.data._id}`, { token, body: { state: 'Orissa' } });
    expect(upd.data.data.state).toBe('Odisha');
  });
});
