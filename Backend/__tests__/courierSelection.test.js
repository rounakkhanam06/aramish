// Manual courier selection: the admin picks the courier for every Shiprocket booking (orders,
// returns, exchange legs). Nothing is booked without a selection, blocked couriers are never
// offered, a courier that's no longer serviceable is refused (never swapped), the chosen courier's
// id is what Shiprocket receives, duplicate requests book once, and panel AWBs sync via webhook.

process.env.JWT_SECRET = 'test_user_secret';
process.env.JWT_ADMIN_SECRET = 'test_admin_secret';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.SHIPROCKET_WEBHOOK_SECRET = 'sr_test_secret';
process.env.SMS_INDIA_HUB_API_KEY = '';
process.env.SMS_API_KEY = '';
process.env.ENV = 'test';
Object.assign(process.env, {
  RETURN_SHIPPING_NAME: 'Aramish Shoes', RETURN_SHIPPING_ADDRESS: 'Khoja Haveli, MG Rd', RETURN_SHIPPING_CITY: 'Agra',
  RETURN_SHIPPING_STATE: 'Uttar Pradesh', RETURN_SHIPPING_PHONE: '8650209559', SHIPROCKET_PICKUP_PINCODE: '282010'
});

jest.mock('axios');
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToAdmins: jest.fn(),
  sendNotificationToUser: jest.fn(() => Promise.resolve())
}));
jest.mock('../Router/shiprocketService', () => {
  const actual = jest.requireActual('../Router/shiprocketService');
  return {
    ...actual,
    getShiprocketToken: jest.fn(async () => null),
    checkServiceability: jest.fn(),
    getOrderDetails: jest.fn(),
    trackAWB: jest.fn(),
    createShiprocketOrder: jest.fn(),
    createShiprocketReturnOrder: jest.fn(),
    createExchangeForwardOrder: jest.fn(),
    assignAWB: jest.fn(),
    requestPickup: jest.fn(),
    generateLabel: jest.fn(),
    cancelShiprocketOrder: jest.fn(async () => ({ ok: true }))
  };
});

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const app = require('../app');
const shiprocketService = require('../Router/shiprocketService');
const Order = require('../Models/Order');
const Admin = require('../Models/Admin');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const ExchangeRequest = require('../Models/ExchangeRequest');
const SystemConfig = require('../Models/SystemConfig');

jest.setTimeout(120000);

// Live list for every shipment: Shadowfax is cheapest, Delhivery best rated, NoCod can't collect cash.
const COURIERS = [
  { courier_company_id: 1, courier_name: 'Delhivery', freight_charge: 90, cod_charges: 30, rating: 4.6, delivery_performance: 95, pickup_performance: 97, rto_performance: 92, etd: 'Oct 18, 2026', estimated_delivery_days: '3', is_surface: true, cod: 1 },
  { courier_company_id: 2, courier_name: 'Shadowfax', freight_charge: 60, cod_charges: 25, rating: 3.2, delivery_performance: 70, etd: 'Oct 20, 2026', estimated_delivery_days: '5', is_surface: true, cod: 1 },
  { courier_company_id: 3, courier_name: 'Ekart', freight_charge: 75, cod_charges: 20, rating: 4.0, delivery_performance: 88, cod: 1 },
  { courier_company_id: 4, courier_name: 'NoCod Air', freight_charge: 40, cod_charges: 0, rating: 4.9, cod: 0, is_surface: false }
];

let server;
let baseUrl;
let adminToken;
let n = 0;

const api = async (method, path, { body, headers = {} } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}`, ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  return { status: res.status, data };
};

const ADDRESS = { name: 'Asha', type: 'Home', address: '5 MG Road, Indore', pincode: '452001', phone: '9999999999', state: 'Madhya Pradesh' };

const makeProduct = () => Product.create({
  name: `Boot ${++n}`, category: 'Shoes', sellingPrice: 1500, mrp: 2000, stock: 10, sku: `CS-${n}`, article: `CSA-${n}`, status: 'Approved',
  shippingSpecs: { weight: 0.8 },
  variations: [{ color: 'Black', size: '8', stock: 5, sku: `CS-${n}-B8` }, { color: 'Black', size: '9', stock: 5, sku: `CS-${n}-B9` }]
});

const makeOrder = async (overrides = {}) => {
  const p = await makeProduct();
  return Order.create({
    userId: new mongoose.Types.ObjectId(),
    items: [{ productId: p._id, name: p.name, price: 1500, quantity: 1, variationSku: p.variations[0].sku }],
    subtotal: 1500, total: 1560, deliveryAddress: ADDRESS, paymentMethod: 'COD', paymentStatus: 'Pending',
    status: 'Processing', shiprocketOrderId: `SRO${++n}`, shipmentId: `SHP${n}`,
    ...overrides
  });
};

const awbReply = (awb, courierId, name) => ({ awb_assign_status: 1, response: { data: { awb_code: awb, courier_company_id: courierId, courier_name: name } } });

beforeAll(async () => {
  await startTestDb();
  for (const m of [Admin, ExchangeRequest, require('../Models/Notification')]) await m.createCollection();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise(r => server.close(r));
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  await ExchangeRequest.deleteMany({});
  jest.clearAllMocks();
  await SystemConfig.create({ freeShippingEnabled: true });
  const admin = await Admin.create({ email: `courier${++n}@test.com`, password: 'Password123!' });
  adminToken = jwt.sign({ id: admin._id, aud: 'admin' }, process.env.JWT_ADMIN_SECRET);
  shiprocketService.checkServiceability.mockResolvedValue({ data: { available_courier_companies: COURIERS, recommended_courier_company_id: 3 } });
  shiprocketService.requestPickup.mockResolvedValue({ pickup_status: 1, response: { pickup_scheduled_date: '2026-10-16' } });
  shiprocketService.generateLabel.mockResolvedValue({ label_created: 1, label_url: 'https://label.pdf' });
  shiprocketService.getOrderDetails.mockResolvedValue({ status: 'NEW', shipments: {} });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('courier list', () => {
  test('COD order: live couriers for the exact shipment, COD-capable only, cheapest and best rated flagged', async () => {
    const order = await makeOrder();
    const r = await api('GET', `/admin/shiprocket/couriers?type=order&id=${order._id}`);
    expect(r.status).toBe(200);
    expect(shiprocketService.checkServiceability).toHaveBeenCalledWith('282010', '452001', 0.8, 1,
      expect.objectContaining({ length: 10, breadth: 10, height: 10, declaredValue: 1560 }));
    expect(r.data.couriers.map(c => c.courierId)).toEqual([2, 3, 1]); // by our cost incl. COD fee; NoCod excluded
    expect(r.data.cheapestCourierId).toBe(2);
    expect(r.data.bestRatedCourierId).toBe(1);
    expect(r.data.shiprocketRecommendedId).toBe(3);
    expect(r.data.couriers.find(c => c.courierId === 1)).toMatchObject({
      name: 'Delhivery', freight: 90, codCharges: 30, totalCost: 120, rating: 4.6, deliveryPerformance: 95,
      pickupPerformance: 97, rtoPerformance: 92, estimatedDays: 3, etd: 'Oct 18, 2026', isSurface: true
    });
    expect(r.data.shipment).toMatchObject({ cod: true, isReturn: false });
  });

  test('prepaid order: cod=0, declared value includes wallet; blocked couriers are hidden', async () => {
    const order = await makeOrder({ paymentMethod: 'Online', paymentStatus: 'Paid', total: 1200, walletUsed: 360 });
    await SystemConfig.updateOne({}, { $set: { blockedCouriers: [{ courierId: 4, name: 'NoCod Air', reason: 'Lost parcels' }] } });
    const r = await api('GET', `/admin/shiprocket/couriers?type=order&id=${order._id}`);
    expect(shiprocketService.checkServiceability).toHaveBeenCalledWith('282010', '452001', 0.8, 0, expect.objectContaining({ declaredValue: 1560 }));
    expect(r.data.couriers.map(c => c.courierId)).toEqual([2, 3, 1]);
    expect(r.data.blocked).toEqual([{ courierId: 4, name: 'NoCod Air' }]);
  });

  test('Shiprocket errors are reported, not hidden', async () => {
    const order = await makeOrder();
    shiprocketService.checkServiceability.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { message: 'Token expired' } } }));
    const r = await api('GET', `/admin/shiprocket/couriers?type=order&id=${order._id}`);
    expect(r.status).toBe(502);
    expect(r.data.code).toBe('COURIERS_UNAVAILABLE');
    expect(r.data.message).toContain('Token expired');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('order booking', () => {
  test('prepaid: Assign AWB needs a courier; the chosen courier id is sent; pickup then works', async () => {
    const order = await makeOrder({ paymentMethod: 'Online', paymentStatus: 'Paid' });
    let r = await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id } });
    expect(r.status).toBe(400);
    expect(r.data.code).toBe('COURIER_REQUIRED');
    expect(shiprocketService.assignAWB).not.toHaveBeenCalled();

    shiprocketService.assignAWB.mockResolvedValue(awbReply('AWB-P1', 3, 'Ekart'));
    r = await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 3 } });
    expect(r.status).toBe(200);
    expect(shiprocketService.assignAWB).toHaveBeenCalledWith(order.shipmentId, 3, { isReturn: false });

    let fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ awbCode: 'AWB-P1', courierName: 'Ekart', courierId: 3, shipmentStatus: 'AWB Assigned', shippingCost: 75, shiprocketCodFee: 0, total: 1560 });
    expect(fresh.courierSelection).toMatchObject({ courierId: 3, courierName: 'Ekart', freight: 75, source: 'admin', mismatch: false });
    expect(fresh.courierSelection.selectedBy).toBeTruthy();

    r = await api('POST', '/admin/shiprocket/request-pickup', { body: { orderId: order._id } });
    expect(r.status).toBe(200);
    fresh = await Order.findById(order._id);
    expect(fresh.pickupScheduled).toBe(true);
  });

  test('COD: Process Order books the chosen courier, then pickup and label; COD fee recorded for finance only', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockResolvedValue(awbReply('AWB-C1', 1, 'Delhivery'));
    const r = await api('POST', '/admin/shiprocket/process-order', { body: { orderId: order._id, courierId: 1 } });
    expect(r.status).toBe(200);
    expect(shiprocketService.assignAWB).toHaveBeenCalledWith(order.shipmentId, 1, { isReturn: false });
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith(order.shipmentId);
    const fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ awbCode: 'AWB-C1', courierId: 1, pickupScheduled: true, shippingCost: 90, shiprocketCodFee: 30, total: 1560 });
    expect(fresh.trackingHistory.map(t => t.status)).toEqual(['AWB Assigned', 'Pickup Scheduled', 'Label Generated']);
  });

  test('blocked, non-COD (for a COD order) and no-longer-serviceable couriers are refused; nothing else is booked', async () => {
    const order = await makeOrder();
    await SystemConfig.updateOne({}, { $set: { blockedCouriers: [{ courierId: 2, name: 'Shadowfax' }] } });
    let r = await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 2 } });
    expect(r.status).toBe(400);
    expect(r.data.code).toBe('COURIER_BLOCKED');

    r = await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 4 } });
    expect(r.status).toBe(409);
    expect(r.data.code).toBe('COURIER_UNAVAILABLE');

    shiprocketService.checkServiceability.mockResolvedValue({ data: { available_courier_companies: COURIERS.filter(c => c.courier_company_id !== 1) } });
    r = await api('POST', '/admin/shiprocket/process-order', { body: { orderId: order._id, courierId: 1 } });
    expect(r.status).toBe(409);
    expect(r.data.code).toBe('COURIER_UNAVAILABLE');
    expect(shiprocketService.assignAWB).not.toHaveBeenCalled();
    expect((await Order.findById(order._id)).awbCode).toBeNull();
  });

  test('a different courier booked by Shiprocket is recorded and flagged, never silent', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockResolvedValue(awbReply('AWB-M1', 2, 'Shadowfax'));
    const r = await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 1 } });
    expect(r.status).toBe(200);
    expect(r.data.warning).toMatch(/Shadowfax instead of the selected Delhivery/);
    const fresh = await Order.findById(order._id);
    expect(fresh.courierSelection).toMatchObject({ courierId: 1, assignedCourierId: 2, mismatch: true });
    expect(fresh.courierId).toBe(2);
  });

  test('duplicate Assign AWB clicks book exactly once', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 150));
      return awbReply('AWB-D1', 1, 'Delhivery');
    });
    const results = await Promise.all([1, 2, 3].map(() => api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 1 } })));
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(results.filter(r => r.status === 409)).toHaveLength(2);
    expect(shiprocketService.assignAWB).toHaveBeenCalledTimes(1);
    const again = await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 1 } });
    expect(again.status).toBe(409);
    expect(again.data.code).toBe('AWB_EXISTS');
    expect((await Order.findById(order._id)).bookingLockAt).toBeNull();
  });

  test('an AWB assigned in the Shiprocket panel syncs through the webhook', async () => {
    const order = await makeOrder();
    const r = await api('POST', '/shiprocket/webhook', {
      headers: { 'x-api-key': process.env.SHIPROCKET_WEBHOOK_SECRET },
      body: { channel_order_id: `ORD_${order._id}`, current_status: 'AWB ASSIGNED', awb: 'PANEL-1', courier_name: 'Bluedart', courier_company_id: 9 }
    });
    expect(r.status).toBe(200);
    const fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ awbCode: 'PANEL-1', courierName: 'Bluedart', courierId: 9 });
    expect(fresh.courierSelection).toMatchObject({ source: 'shiprocket_panel', courierName: 'Bluedart', courierId: 9 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('returns', () => {
  const makeReturn = async () => {
    const order = await makeOrder({ status: 'Return Requested', paymentStatus: 'Paid' });
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 1500, refundMethod: 'Bank', status: 'Requested',
      items: [{ productId: order.items[0].productId, variationSku: order.items[0].variationSku, name: 'Boot', price: 1500, quantity: 1 }]
    });
    shiprocketService.createShiprocketReturnOrder.mockResolvedValue({ order_id: 7001, shipment_id: 7002 });
    return { order, rr };
  };

  test('approve creates the return order only; reverse couriers listed; chosen courier booked with is_return + pickup', async () => {
    const { rr } = await makeReturn();
    let r = await api('PUT', `/returns/admin/${rr._id}/status`, { body: { status: 'Approved' } });
    expect(r.status).toBe(200);
    expect(shiprocketService.createShiprocketReturnOrder).toHaveBeenCalledTimes(1);
    expect(shiprocketService.assignAWB).not.toHaveBeenCalled();
    expect(await ReturnRequest.findById(rr._id)).toMatchObject({ status: 'Approved', awbCode: null, shiprocketReturnShipmentId: '7002' });

    r = await api('GET', `/admin/shiprocket/couriers?type=return&id=${rr._id}`);
    expect(r.status).toBe(200);
    expect(shiprocketService.checkServiceability).toHaveBeenLastCalledWith('452001', '282010', expect.any(Number), 0,
      expect.objectContaining({ isReturn: true, declaredValue: 1500 }));
    expect(r.data.couriers.map(c => c.courierId)).toContain(4); // prepaid reverse pickup: COD capability irrelevant

    shiprocketService.assignAWB.mockResolvedValue(awbReply('RAWB-1', 3, 'Ekart'));
    r = await api('POST', `/returns/admin/${rr._id}/retry-shipment`, { body: { courierId: 3 } });
    expect(r.status).toBe(200);
    expect(shiprocketService.assignAWB).toHaveBeenCalledWith('7002', 3, { isReturn: true });
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith('7002');
    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh).toMatchObject({ status: 'Pick-up Scheduled', awbCode: 'RAWB-1', courierId: 3, pickupScheduled: true });
    expect(fresh.courierSelection).toMatchObject({ courierName: 'Ekart', source: 'admin' });
  });

  test('parallel return bookings book once', async () => {
    const { rr } = await makeReturn();
    await api('PUT', `/returns/admin/${rr._id}/status`, { body: { status: 'Approved' } });
    shiprocketService.assignAWB.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 150));
      return awbReply('RAWB-2', 1, 'Delhivery');
    });
    const results = await Promise.all([1, 2].map(() => api('POST', `/returns/admin/${rr._id}/retry-shipment`, { body: { courierId: 1 } })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(shiprocketService.assignAWB).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('exchanges', () => {
  const makeExchange = async (extra = {}) => {
    const order = await makeOrder({ status: 'Exchange Requested', paymentStatus: 'Paid' });
    const p = await Product.findById(order.items[0].productId);
    return ExchangeRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size Issue', status: 'Requested',
      originalItem: { productId: p._id, variationSku: p.variations[0].sku, name: p.name, price: 1500, color: 'Black', size: '8' },
      requestedVariant: { productId: p._id, name: p.name, color: 'Black', size: '9', sku: p.variations[1].sku, price: 1500 },
      additionalAmount: 0, paymentStatus: 'Not Required', ...extra
    });
  };

  test('approve creates both shipments with no courier; each leg booked with its own chosen courier', async () => {
    const exchange = await makeExchange();
    shiprocketService.createShiprocketReturnOrder.mockResolvedValue({ order_id: 8001, shipment_id: 8002 });
    shiprocketService.createExchangeForwardOrder.mockResolvedValue({ order_id: 8003, shipment_id: 8004 });

    let r = await api('PUT', `/exchanges/admin/${exchange._id}/status`, { body: { status: 'Approved' } });
    expect(r.status).toBe(200);
    expect(shiprocketService.assignAWB).not.toHaveBeenCalled();
    let fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse).toMatchObject({ shipmentId: '8002', awb: null, status: 'Created' });
    expect(fresh.forward).toMatchObject({ shipmentId: '8004', awb: null, status: 'Created' });

    // Reverse leg: customer -> warehouse, return couriers
    r = await api('GET', `/admin/shiprocket/couriers?type=exchange&id=${exchange._id}&leg=reverse`);
    expect(shiprocketService.checkServiceability).toHaveBeenLastCalledWith('452001', '282010', 0.5, 0, expect.objectContaining({ isReturn: true }));
    shiprocketService.assignAWB.mockResolvedValueOnce(awbReply('XREV-1', 1, 'Delhivery'));
    r = await api('POST', `/exchanges/admin/${exchange._id}/retry-shipment`, { body: { leg: 'reverse', courierId: 1 } });
    expect(r.status).toBe(200);
    expect(shiprocketService.assignAWB).toHaveBeenLastCalledWith('8002', 1, { isReturn: true });
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith('8002');

    // Forward leg: warehouse -> customer; courier booked now, pickup once packed
    r = await api('GET', `/admin/shiprocket/couriers?type=exchange&id=${exchange._id}&leg=forward`);
    expect(shiprocketService.checkServiceability).toHaveBeenLastCalledWith('282010', '452001', 0.5, 0, expect.not.objectContaining({ isReturn: true }));
    shiprocketService.assignAWB.mockResolvedValueOnce(awbReply('XFWD-1', 3, 'Ekart'));
    r = await api('POST', `/exchanges/admin/${exchange._id}/retry-shipment`, { body: { leg: 'forward', courierId: 3, schedulePickup: false } });
    expect(r.status).toBe(200);
    expect(shiprocketService.assignAWB).toHaveBeenLastCalledWith('8004', 3, { isReturn: false });
    fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse).toMatchObject({ awb: 'XREV-1', courierId: 1, courierName: 'Delhivery', pickupScheduled: true });
    expect(fresh.forward).toMatchObject({ awb: 'XFWD-1', courierId: 3, courierName: 'Ekart', pickupScheduled: false });
    expect(shiprocketService.requestPickup).not.toHaveBeenCalledWith('8004');

    // "Schedule Pickup" once packed: no courier needed again, no new AWB
    r = await api('POST', `/exchanges/admin/${exchange._id}/retry-shipment`, { body: { leg: 'forward' } });
    expect(r.status).toBe(200);
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith('8004');
    expect(shiprocketService.assignAWB).toHaveBeenCalledTimes(2);
  });

  test('COD price difference: replacement couriers are listed for COD', async () => {
    const exchange = await makeExchange({ additionalAmount: 200, paymentMethod: 'COD', paymentStatus: 'Pending' });
    await ExchangeRequest.updateOne({ _id: exchange._id }, { $set: { forward: { orderId: '1', shipmentId: '2', status: 'Created' } } });
    const r = await api('GET', `/admin/shiprocket/couriers?type=exchange&id=${exchange._id}&leg=forward`);
    expect(r.status).toBe(200);
    expect(shiprocketService.checkServiceability).toHaveBeenLastCalledWith('282010', '452001', 0.5, 1, expect.objectContaining({ declaredValue: 200 }));
    expect(r.data.couriers.map(c => c.courierId)).not.toContain(4);
  });
});

describe('blocked couriers', () => {
  const block = (courierId, name) => api('POST', '/admin/settings/blocked-couriers', { body: { courierId, name, reason: 'Missed pickups' } });

  test('a Settings page opened earlier cannot overwrite a courier blocked from the picker', async () => {
    // Admin opens Settings (list is empty at that moment)...
    const pageLoad = await api('GET', '/admin/settings');
    expect(pageLoad.data.settings.blockedCouriers).toEqual([]);
    // ...meanwhile Shadowfax is blocked from a shipment's courier list...
    expect((await block(2, 'Shadowfax')).status).toBe(200);
    // ...then the stale page is saved, even by an old admin build that still sends the whole list.
    const save = await api('PUT', '/admin/settings', { body: { codChargeAmount: 120, helpline: '+91 99999', blockedCouriers: [] } });
    expect(save.status).toBe(200);
    expect(save.data.settings.codChargeAmount).toBe(120);
    const after = await SystemConfig.findOne({}).lean();
    expect(after.blockedCouriers.map(b => b.courierId)).toEqual([2]);
  });

  test('block/unblock are atomic and idempotent, including parallel requests', async () => {
    const results = await Promise.all([[1, 'Delhivery'], [2, 'Shadowfax'], [3, 'Ekart'], [2, 'Shadowfax']].map(([id, name]) => block(id, name)));
    expect(results.every(r => r.status === 200)).toBe(true);
    let list = (await SystemConfig.findOne({}).lean()).blockedCouriers;
    expect(list.map(b => b.courierId).sort()).toEqual([1, 2, 3]);
    expect(list.find(b => b.courierId === 2)).toMatchObject({ name: 'Shadowfax', reason: 'Missed pickups' });

    const un = await api('DELETE', '/admin/settings/blocked-couriers/2');
    expect(un.status).toBe(200);
    expect(un.data.blockedCouriers.map(b => b.courierId).sort()).toEqual([1, 3]);
    expect((await api('DELETE', '/admin/settings/blocked-couriers/2')).status).toBe(200); // already gone: no-op
    expect((await block('abc')).status).toBe(400);
    list = (await SystemConfig.findOne({}).lean()).blockedCouriers;
    expect(list.map(b => b.courierId).sort()).toEqual([1, 3]);
  });

  test('a courier blocked from the picker disappears from the next list', async () => {
    const order = await makeOrder();
    await block(2, 'Shadowfax');
    const r = await api('GET', `/admin/shiprocket/couriers?type=order&id=${order._id}`);
    expect(r.data.couriers.map(c => c.courierId)).not.toContain(2);
    expect(r.data.blocked).toEqual([{ courierId: 2, name: 'Shadowfax' }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('customer billing never changes', () => {
  const BILL_FIELDS = ['total', 'subtotal', 'discountAmount', 'deliveryCharge', 'codCharge', 'prepaidDiscount', 'platformCommission', 'walletUsed', 'refundWalletUsed', 'paymentStatus', 'paymentMethod'];
  const bill = (o) => ({ ...Object.fromEntries(BILL_FIELDS.map(f => [f, o[f]])), items: o.items.map(i => ({ price: i.price, quantity: i.quantity })) });

  test.each([
    ['COD', { paymentMethod: 'COD', codCharge: 50, platformCommission: 10, total: 1560 }, 1],
    ['prepaid with coupon + wallet', { paymentMethod: 'Online', paymentStatus: 'Paid', discountAmount: 200, prepaidDiscount: 100, walletUsed: 150, total: 1050 }, 3],
    ['courier switched by Shiprocket (mismatch)', { paymentMethod: 'COD', total: 1560 }, 1]
  ])('%s: only our internal shipping cost changes', async (label, extra, courierId) => {
    const order = await makeOrder(extra);
    const before = bill((await Order.findById(order._id)).toObject());
    shiprocketService.assignAWB.mockResolvedValue(awbReply('AWB-B1', label.includes('mismatch') ? 2 : courierId, 'X'));
    const r = await api('POST', '/admin/shiprocket/process-order', { body: { orderId: order._id, courierId } });
    expect(r.status).toBe(200);
    const fresh = (await Order.findById(order._id)).toObject();
    expect(bill(fresh)).toEqual(before);
    const chosen = COURIERS.find(c => c.courier_company_id === courierId);
    expect(fresh.shippingCost).toBe(chosen.freight_charge);
    expect(fresh.shiprocketCodFee).toBe(extra.paymentMethod === 'COD' ? chosen.cod_charges : 0);
  });

  test('the customer\'s own order view shows the same total after booking, without our costs', async () => {
    const User = require('../Models/User');
    const user = await User.create({ phone: `96${String(++n).padStart(8, '0')}`, name: 'Buyer', isVerified: true });
    const token = jwt.sign({ id: user._id, aud: 'user', tokenVersion: user.tokenVersion }, process.env.JWT_SECRET);
    const order = await makeOrder({ userId: user._id });
    shiprocketService.assignAWB.mockResolvedValue(awbReply('AWB-B2', 1, 'Delhivery'));
    await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 1 } });
    const mine = await api('GET', `/orders/${order._id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(mine.status).toBe(200);
    expect(mine.data.order.total).toBe(1560);
    expect(mine.data.order.shippingCost).toBeUndefined();
    expect(mine.data.order.shiprocketCodFee).toBeUndefined();
  });

  test('return refund and exchange price difference are untouched by booking', async () => {
    const order = await makeOrder({ status: 'Return Requested', paymentStatus: 'Paid' });
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 1500, refundMethod: 'Bank', status: 'Approved',
      shiprocketReturnOrderId: '1', shiprocketReturnShipmentId: '2', items: [{ productId: order.items[0].productId, name: 'Boot', price: 1500, quantity: 1 }]
    });
    shiprocketService.assignAWB.mockResolvedValue(awbReply('RAWB-B', 1, 'Delhivery'));
    expect((await api('POST', `/returns/admin/${rr._id}/retry-shipment`, { body: { courierId: 1 } })).status).toBe(200);
    expect((await ReturnRequest.findById(rr._id)).refundAmount).toBe(1500);
    expect((await Order.findById(order._id)).total).toBe(1560);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Shiprocket panel AWB sync (webhooks)', () => {
  const hook = (path, body) => api('POST', path, { headers: { 'x-api-key': process.env.SHIPROCKET_WEBHOOK_SECRET }, body });

  test('order: the webhook repeating our own AWB keeps the admin selection', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockResolvedValue(awbReply('AWB-OWN', 1, 'Delhivery'));
    await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 1 } });
    await hook('/shiprocket/webhook', { channel_order_id: `ORD_${order._id}`, current_status: 'PICKUP SCHEDULED', awb: 'AWB-OWN', courier_name: 'Delhivery' });
    const fresh = await Order.findById(order._id);
    expect(fresh.awbCode).toBe('AWB-OWN');
    expect(fresh.courierSelection).toMatchObject({ source: 'admin', courierId: 1 });
  });

  test('order: a courier reassigned in the panel replaces ours and is labelled as a panel booking', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockResolvedValue(awbReply('AWB-OLD', 1, 'Delhivery'));
    await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 1 } });
    // Shiprocket webhooks normally carry the courier name but no courier id
    await hook('/shiprocket/webhook', { channel_order_id: `ORD_${order._id}`, current_status: 'AWB ASSIGNED', awb: 'AWB-NEW', courier_name: 'Xpressbees' });
    const fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ awbCode: 'AWB-NEW', courierName: 'Xpressbees' });
    expect(fresh.courierSelection).toMatchObject({ source: 'shiprocket_panel', courierName: 'Xpressbees', courierId: null });
    expect(fresh.courierId).toBeNull(); // the webhook gave no id: the old courier's id must not linger
  });

  test('return: a panel AWB (is_return webhook) syncs and moves the return to Pick-up Scheduled', async () => {
    const order = await makeOrder({ status: 'Return Requested', paymentStatus: 'Paid' });
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 1500, refundMethod: 'Bank', status: 'Approved',
      shiprocketReturnOrderId: '11', shiprocketReturnShipmentId: '12', items: [{ productId: order.items[0].productId, name: 'Boot', price: 1500, quantity: 1 }]
    });
    await hook('/shiprocket/webhook', { order_id: `RET_${rr._id}`, is_return: 1, current_status: 'PICKUP SCHEDULED', awb: 'RPANEL-1', courier_name: 'Ekart' });
    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh).toMatchObject({ awbCode: 'RPANEL-1', courierName: 'Ekart', status: 'Pick-up Scheduled', pickupScheduled: true });
    expect(fresh.courierSelection).toMatchObject({ source: 'shiprocket_panel', courierName: 'Ekart' });
    // Our booking flow then refuses to book a second courier for it
    const again = await api('POST', `/returns/admin/${rr._id}/retry-shipment`, { body: { courierId: 1 } });
    expect(again.status).toBe(400);
    expect(shiprocketService.assignAWB).not.toHaveBeenCalled();
  });

  test('exchange: panel AWBs on both legs sync through the shared webhook URL', async () => {
    const order = await makeOrder({ status: 'Exchange Approved', paymentStatus: 'Paid' });
    const p = await Product.findById(order.items[0].productId);
    const exchange = await ExchangeRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size Issue', status: 'Approved',
      originalItem: { productId: p._id, name: p.name, price: 1500 },
      requestedVariant: { productId: p._id, color: 'Black', size: '9', sku: p.variations[1].sku, price: 1500 },
      reverse: { orderId: '21', shipmentId: '22', status: 'Created' }, forward: { orderId: '23', shipmentId: '24', status: 'Created' }
    });
    await hook('/shiprocket/webhook', { channel_order_id: `EXC_REV_${exchange._id}`, current_status: 'PICKUP SCHEDULED', awb: 'XR-PANEL', courier_name: 'Delhivery' });
    await hook('/shiprocket/webhook', { channel_order_id: `EXC_FWD_${exchange._id}`, current_status: 'AWB ASSIGNED', awb: 'XF-PANEL', courier_name: 'Ekart' });
    const fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse).toMatchObject({ awb: 'XR-PANEL', courierName: 'Delhivery', pickupScheduled: true });
    expect(fresh.forward).toMatchObject({ awb: 'XF-PANEL', courierName: 'Ekart' });
    expect(fresh.reverse.courierSelection.source).toBe('shiprocket_panel');
    expect(fresh.forward.courierSelection.source).toBe('shiprocket_panel');
    // Booking a leg that already has a panel AWB never assigns a second courier
    const r = await api('POST', `/exchanges/admin/${exchange._id}/retry-shipment`, { body: { leg: 'forward', courierId: 1 } });
    expect(shiprocketService.assignAWB).not.toHaveBeenCalled();
    expect(r.status).toBe(200); // only the (missing) warehouse pickup is requested
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith('24');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('courier reassigned in the Shiprocket panel', () => {
  const hook = (path, body) => api('POST', path, { headers: { 'x-api-key': process.env.SHIPROCKET_WEBHOOK_SECRET }, body });
  const orderHook = (order, body) => hook('/shiprocket/webhook', { channel_order_id: `ORD_${order._id}`, ...body });
  const details = (orderStatus, shipment) => ({ status: orderStatus, shipments: shipment });
  const bookOrder = async (extra = {}) => {
    const order = await makeOrder(extra);
    shiprocketService.assignAWB.mockResolvedValueOnce(awbReply('AWB-1', 1, 'Delhivery'));
    expect((await api('POST', '/admin/shiprocket/assign-awb', { body: { orderId: order._id, courierId: 1 } })).status).toBe(200);
    return order;
  };
  const variantStock = async (order) => {
    const p = await Product.findById(order.items[0].productId).lean();
    return p.variations.find(v => v.sku === order.items[0].variationSku).stock;
  };

  test('order: new courier + new AWB from the webhook replaces ours, old AWB kept in history', async () => {
    const order = await bookOrder();
    await orderHook(order, { current_status: 'AWB ASSIGNED', awb: 'AWB-2', courier_name: 'Xpressbees' });
    const fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ awbCode: 'AWB-2', courierName: 'Xpressbees', courierId: null, shipmentStatus: 'AWB ASSIGNED' });
    expect(fresh.awbHistory).toEqual(['AWB-1']);
    expect(fresh.courierSelection).toMatchObject({ source: 'shiprocket_panel', courierName: 'Xpressbees', reassignedFrom: 'Delhivery' });
    expect(fresh.trackingHistory.map(t => t.status)).toContain('Courier Reassigned');
  });

  test('order: same AWB with a different courier is synced as a reassignment', async () => {
    const order = await bookOrder();
    await orderHook(order, { current_status: 'PICKUP SCHEDULED', awb: 'AWB-1', courier_name: 'Shadowfax' });
    const fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ awbCode: 'AWB-1', courierName: 'Shadowfax', shipmentStatus: 'PICKUP SCHEDULED' });
    expect(fresh.awbHistory).toEqual([]);
    expect(fresh.courierSelection).toMatchObject({ source: 'shiprocket_panel', reassignedFrom: 'Delhivery' });
  });

  test('order: a late event for the replaced AWB is ignored (no switch back, no cancellation, no refund)', async () => {
    const order = await bookOrder({ paymentMethod: 'Online', paymentStatus: 'Paid' });
    const stockBefore = await variantStock(order);
    await orderHook(order, { current_status: 'AWB ASSIGNED', awb: 'AWB-2', courier_name: 'Xpressbees' });
    const r = await orderHook(order, { current_status: 'CANCELED', awb: 'AWB-1', courier_name: 'Delhivery' });
    expect(r.status).toBe(200);
    const fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ status: 'Processing', paymentStatus: 'Paid', awbCode: 'AWB-2', courierName: 'Xpressbees' });
    expect(await variantStock(order)).toBe(stockBefore);
    expect(shiprocketService.getOrderDetails).not.toHaveBeenCalled();
    expect(fresh.shiprocketResponses.map(x => x.type)).toContain('WEBHOOK_STALE_AWB');
  });

  test('order: CANCELED for the current AWB during a reassignment syncs the new courier instead of cancelling', async () => {
    const order = await bookOrder({ paymentMethod: 'Online', paymentStatus: 'Paid' });
    const stockBefore = await variantStock(order);
    shiprocketService.getOrderDetails.mockResolvedValue(details('READY TO SHIP', { awb: 'AWB-3', courier: 'Ekart', courier_id: '3', status: 'AWB ASSIGNED' }));
    await orderHook(order, { current_status: 'CANCELED', awb: 'AWB-1', courier_name: 'Delhivery' });
    expect(shiprocketService.getOrderDetails).toHaveBeenCalledWith(order.shiprocketOrderId);
    const fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ status: 'Processing', paymentStatus: 'Paid', awbCode: 'AWB-3', courierName: 'Ekart', courierId: 3, shipmentStatus: 'AWB ASSIGNED' });
    expect(fresh.awbHistory).toEqual(['AWB-1']);
    expect(await variantStock(order)).toBe(stockBefore);
    expect(fresh.trackingHistory.map(t => t.status)).not.toContain('CANCELED');
  });

  test('order: a real cancellation (Shiprocket order cancelled) still cancels and restocks', async () => {
    const order = await bookOrder();
    const stockBefore = await variantStock(order);
    shiprocketService.getOrderDetails.mockResolvedValue(details('CANCELED', { awb: 'AWB-1', courier: 'Delhivery', status: 'CANCELED' }));
    await orderHook(order, { current_status: 'CANCELED', awb: 'AWB-1' });
    expect((await Order.findById(order._id)).status).toBe('Cancelled');
    expect(await variantStock(order)).toBe(stockBefore + 1);
  });

  test('order: if Shiprocket cannot confirm, nothing is cancelled and the webhook is retried', async () => {
    const order = await bookOrder();
    shiprocketService.getOrderDetails.mockRejectedValue(new Error('Shiprocket down'));
    const r = await orderHook(order, { current_status: 'CANCELED', awb: 'AWB-1' });
    expect(r.status).toBe(500); // Shiprocket retries the webhook
    expect((await Order.findById(order._id)).status).toBe('Processing');
  });

  test('order: Sync Status picks up a reassignment whose webhook was missed, then tracks the new AWB', async () => {
    const order = await bookOrder();
    shiprocketService.getOrderDetails.mockResolvedValue(details('PICKUP SCHEDULED', { awb: 'AWB-4', courier: 'Bluedart', courier_id: 7, status: 'PICKUP SCHEDULED' }));
    shiprocketService.trackAWB.mockResolvedValue({ tracking_data: { shipment_track: [{ current_status: 'PICKED UP' }], shipment_track_activities: [] } });
    const r = await api('POST', '/admin/shiprocket/sync-status', { body: { orderId: order._id } });
    expect(r.status).toBe(200);
    expect(shiprocketService.trackAWB).toHaveBeenCalledWith('AWB-4');
    const fresh = await Order.findById(order._id);
    expect(fresh).toMatchObject({ awbCode: 'AWB-4', courierName: 'Bluedart', courierId: 7, shipmentStatus: 'PICKED UP' });
    expect(fresh.awbHistory).toEqual(['AWB-1']);
  });

  test('order: Sync Status never cancels on a cancelled AWB it cannot confirm with Shiprocket', async () => {
    const order = await bookOrder();
    shiprocketService.getOrderDetails.mockRejectedValue(new Error('timeout'));
    shiprocketService.trackAWB.mockResolvedValue({ tracking_data: { shipment_track: [{ current_status: 'CANCELED' }], shipment_track_activities: [] } });
    await api('POST', '/admin/shiprocket/sync-status', { body: { orderId: order._id } });
    expect((await Order.findById(order._id)).status).toBe('Processing');
  });

  test('return: reassignment syncs (courier, AWB, status); late old-AWB events ignored; Sync button works', async () => {
    const order = await makeOrder({ status: 'Return Requested', paymentStatus: 'Paid' });
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 1500, refundMethod: 'Bank', status: 'Approved',
      shiprocketReturnOrderId: '31', shiprocketReturnShipmentId: '32', items: [{ productId: order.items[0].productId, name: 'Boot', price: 1500, quantity: 1 }]
    });
    shiprocketService.assignAWB.mockResolvedValueOnce(awbReply('RAWB-1', 1, 'Delhivery'));
    await api('POST', `/returns/admin/${rr._id}/retry-shipment`, { body: { courierId: 1 } });

    await hook('/shiprocket/webhook', { order_id: `RET_${rr._id}`, is_return: 1, current_status: 'PICKUP SCHEDULED', awb: 'RAWB-2', courier_name: 'Ekart' });
    let fresh = await ReturnRequest.findById(rr._id);
    expect(fresh).toMatchObject({ awbCode: 'RAWB-2', courierName: 'Ekart', shiprocketStatus: 'PICKUP SCHEDULED' });
    expect(fresh.awbHistory).toEqual(['RAWB-1']);
    expect(fresh.courierSelection).toMatchObject({ source: 'shiprocket_panel', reassignedFrom: 'Delhivery' });

    await hook('/shiprocket/webhook', { order_id: `RET_${rr._id}`, is_return: 1, current_status: 'CANCELED', awb: 'RAWB-1' });
    fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.awbCode).toBe('RAWB-2');
    expect(fresh.shipmentErrors).toHaveLength(0);

    // CANCELED for the current AWB while Shiprocket moves it to another courier: synced, no error
    shiprocketService.getOrderDetails.mockResolvedValue(details('PICKUP SCHEDULED', { awb: 'RAWB-3', courier: 'Shadowfax', courier_id: 2, status: 'PICKUP SCHEDULED' }));
    await hook('/shiprocket/webhook', { order_id: `RET_${rr._id}`, is_return: 1, current_status: 'CANCELED', awb: 'RAWB-2' });
    fresh = await ReturnRequest.findById(rr._id);
    expect(fresh).toMatchObject({ awbCode: 'RAWB-3', courierName: 'Shadowfax', courierId: 2 });
    expect(fresh.shipmentErrors).toHaveLength(0);

    // Missed webhook: Sync from Shiprocket
    shiprocketService.getOrderDetails.mockResolvedValue(details('IN TRANSIT', { awb: 'RAWB-4', courier: 'Bluedart', courier_id: 7, status: 'IN TRANSIT' }));
    const r = await api('POST', `/returns/admin/${rr._id}/sync-shipment`);
    expect(r.status).toBe(200);
    fresh = await ReturnRequest.findById(rr._id);
    expect(fresh).toMatchObject({ awbCode: 'RAWB-4', courierName: 'Bluedart', shiprocketStatus: 'IN TRANSIT', status: 'Pick-up Scheduled' });
    expect(fresh.awbHistory).toEqual(['RAWB-1', 'RAWB-2', 'RAWB-3']);
  });

  test('exchange: leg reassignment syncs from webhook and Sync button; late old-AWB events ignored', async () => {
    const order = await makeOrder({ status: 'Exchange Approved', paymentStatus: 'Paid' });
    const p = await Product.findById(order.items[0].productId);
    const exchange = await ExchangeRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size Issue', status: 'Approved',
      originalItem: { productId: p._id, name: p.name, price: 1500 },
      requestedVariant: { productId: p._id, color: 'Black', size: '9', sku: p.variations[1].sku, price: 1500 },
      reverse: { orderId: '41', shipmentId: '42', status: 'Created' }, forward: { orderId: '43', shipmentId: '44', status: 'Created' }
    });
    shiprocketService.assignAWB.mockResolvedValueOnce(awbReply('XR-1', 1, 'Delhivery'));
    await api('POST', `/exchanges/admin/${exchange._id}/retry-shipment`, { body: { leg: 'reverse', courierId: 1 } });

    await hook('/shiprocket/webhook', { channel_order_id: `EXC_REV_${exchange._id}`, current_status: 'PICKUP SCHEDULED', awb: 'XR-2', courier_name: 'Ekart' });
    let fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse).toMatchObject({ awb: 'XR-2', courierName: 'Ekart', status: 'PICKUP SCHEDULED' });
    expect(fresh.reverse.awbHistory).toEqual(['XR-1']);
    expect(fresh.reverse.courierSelection).toMatchObject({ source: 'shiprocket_panel', reassignedFrom: 'Delhivery' });
    expect(fresh.courierName).toBe('Ekart');

    await hook('/shiprocket/webhook', { channel_order_id: `EXC_REV_${exchange._id}`, current_status: 'CANCELED', awb: 'XR-1' });
    fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse).toMatchObject({ awb: 'XR-2', status: 'PICKUP SCHEDULED' });

    // Missed webhooks: sync both legs from Shiprocket
    shiprocketService.getOrderDetails.mockImplementation(async (id) => (String(id) === '41'
      ? details('PICKED UP', { awb: 'XR-3', courier: 'Bluedart', courier_id: 7, status: 'PICKED UP' })
      : details('NEW', { awb: 'XF-1', courier: 'Shadowfax', courier_id: 2, status: 'AWB ASSIGNED' })));
    const r = await api('POST', `/exchanges/admin/${exchange._id}/sync-shipment`);
    expect(r.status).toBe(200);
    fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse).toMatchObject({ awb: 'XR-3', courierName: 'Bluedart', status: 'PICKED UP' });
    expect(fresh.reverse.awbHistory).toEqual(['XR-1', 'XR-2']);
    expect(fresh.forward).toMatchObject({ awb: 'XF-1', courierName: 'Shadowfax', courierId: 2 });
  });
});
