// Shiprocket reports most failures (e.g. low wallet balance) inside an HTTP 200 reply. The admin
// Process Order / Assign AWB / Label actions must not record those replies as success.
jest.mock('../Router/shiprocketService', () => ({
  ...jest.requireActual('../Router/shiprocketService'),
  checkServiceability: jest.fn(),
  assignAWB: jest.fn(),
  requestPickup: jest.fn(),
  generateLabel: jest.fn()
}));

const mongoose = require('mongoose');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const shiprocketService = require('../Router/shiprocketService');
const Order = require('../Models/Order');
const { processOrder, assignAWB } = require('../Controllers/shiprocketController');

const WALLET_ERROR = 'Please recharge your ShipRocket wallet. The minimum required balance is Rs 100';

const makeOrder = () => Order.create({
  userId: new mongoose.Types.ObjectId(),
  items: [{ productId: new mongoose.Types.ObjectId(), name: 'Shoe', price: 1249, quantity: 1 }],
  total: 1505.72,
  deliveryAddress: { name: 'Arshia Makhija', type: 'Home', address: '103 Trilok Niwas, Agra', pincode: '282002', phone: '7049380550' },
  paymentMethod: 'COD',
  status: 'Processing',
  shiprocketOrderId: '1628013738',
  shipmentId: '1624228272'
});

const call = async (handler, body) => {
  const res = { statusCode: 200 };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  await handler({ body }, res);
  return res;
};

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  jest.clearAllMocks();
  shiprocketService.checkServiceability.mockResolvedValue({ data: { recommended_courier_company_id: 252 } });
});

describe('Shiprocket admin shipping actions', () => {
  test('Process Order reports a wallet error and does not mark the order as AWB Assigned', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { courier_id: '252', awb_assign_error: WALLET_ERROR } } });

    const res = await call(processOrder, { orderId: order._id });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(WALLET_ERROR);
    expect(shiprocketService.requestPickup).not.toHaveBeenCalled();
    expect(shiprocketService.generateLabel).not.toHaveBeenCalled();

    const fresh = await Order.findById(order._id);
    expect(fresh.awbCode).toBeNull();
    expect(fresh.shipmentStatus).toBeNull();
    expect(fresh.pickupScheduled).toBe(false);
    expect(fresh.trackingHistory).toHaveLength(0);
    expect(fresh.shiprocketResponses.map(r => r.type)).toEqual(['AWB_ASSIGN_FAILED']);
  });

  test('Process Order records AWB, pickup and label only when Shiprocket confirms each', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockResolvedValue({ awb_assign_status: 1, response: { data: { awb_code: 'AWB123', courier_name: 'Delhivery' } } });
    shiprocketService.requestPickup.mockResolvedValue({ pickup_status: 1, response: { pickup_scheduled_date: '2026-10-04' } });
    shiprocketService.generateLabel.mockResolvedValue({ label_created: 1, label_url: 'https://label.pdf' });

    const res = await call(processOrder, { orderId: order._id });

    expect(res.body.success).toBe(true);
    const fresh = await Order.findById(order._id);
    expect(fresh.awbCode).toBe('AWB123');
    expect(fresh.courierName).toBe('Delhivery');
    expect(fresh.pickupScheduled).toBe(true);
    expect(fresh.shipmentStatus).toBe('Pickup Scheduled');
    expect(fresh.trackingHistory.map(t => t.status)).toEqual(['AWB Assigned', 'Pickup Scheduled', 'Label Generated']);
  });

  test('a failed label is reported without a "label generated" timeline entry', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_code: 'AWB123', courier_name: 'Delhivery' } } });
    shiprocketService.requestPickup.mockResolvedValue({ pickup_status: 1 });
    shiprocketService.generateLabel.mockResolvedValue({ label_created: 0, not_created: { 1624228272: 'Shipment awb not found' } });

    const res = await call(processOrder, { orderId: order._id });

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Shipment awb not found');
    const fresh = await Order.findById(order._id);
    expect(fresh.awbCode).toBe('AWB123'); // the steps that did succeed are kept
    expect(fresh.trackingHistory.map(t => t.status)).toEqual(['AWB Assigned', 'Pickup Scheduled']);
  });

  test('Assign AWB button reports the wallet error instead of success', async () => {
    const order = await makeOrder();
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_assign_error: WALLET_ERROR } } });

    const res = await call(assignAWB, { orderId: order._id });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain(WALLET_ERROR);
    const fresh = await Order.findById(order._id);
    expect(fresh.shipmentStatus).toBeNull();
    expect(fresh.trackingHistory).toHaveLength(0);
  });
});
