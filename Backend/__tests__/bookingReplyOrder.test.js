// Courier bookings must be saved (and their lock released) BEFORE the reply is sent. The admin
// panel refreshes right after the reply; a reply sent first could show the shipment as unbooked,
// refuse the next click as "in progress", or report success for a save that then fails.
// Every save is slowed down here so a write still in flight would be visible to the reader.
jest.mock('../Router/firebaseAdmin', () => ({ sendNotificationToUser: jest.fn().mockResolvedValue(undefined), sendNotificationToAdmins: jest.fn() }));
jest.mock('../Router/shiprocketService', () => ({
  ...jest.requireActual('../Router/shiprocketService'),
  checkServiceability: jest.fn(async () => ({ data: { available_courier_companies: [{ courier_company_id: 1, courier_name: 'Delhivery', freight_charge: 60, cod: 1 }] } })),
  assignAWB: jest.fn(async () => ({ response: { data: { awb_code: 'AWB-R1', courier_name: 'Delhivery', courier_company_id: 1 } } })),
  requestPickup: jest.fn(async () => ({ pickup_status: 1 })),
  generateLabel: jest.fn(async () => ({ label_created: 1, label_url: 'https://label.pdf' }))
}));

const mongoose = require('mongoose');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const Order = require('../Models/Order');
const ReturnRequest = require('../Models/ReturnRequest');
const { retryReturnShipment } = require('../Controllers/returnController');
const { assignAWB, processOrder } = require('../Controllers/shiprocketController');

jest.setTimeout(120000);

beforeAll(async () => {
  await startTestDb();
  Object.assign(process.env, { RETURN_SHIPPING_ADDRESS: 'Khoja Haveli', RETURN_SHIPPING_CITY: 'Agra', RETURN_SHIPPING_STATE: 'UP', RETURN_SHIPPING_PHONE: '8650209559', SHIPROCKET_PICKUP_PINCODE: '282010' });
});
afterAll(stopTestDb);
beforeEach(clearTestDb);
afterEach(() => jest.restoreAllMocks());

const slowSaves = (Model) => {
  const realSave = Model.prototype.save;
  jest.spyOn(Model.prototype, 'save').mockImplementation(async function (...args) {
    await new Promise(r => setTimeout(r, 250));
    return realSave.apply(this, args);
  });
};
const slowUpdates = (Model) => {
  const realUpdate = Model.updateOne.bind(Model);
  jest.spyOn(Model, 'updateOne').mockImplementation((...args) => new Promise(r => setTimeout(r, 250)).then(() => realUpdate(...args)));
};

// A res whose json() reads the database at the exact moment the reply is sent.
const replyProbe = (read) => {
  const res = { statusCode: 200 };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; res.storedAtReply = read(); return res; };
  return res;
};

const makeOrder = (extra = {}) => Order.create({
  userId: new mongoose.Types.ObjectId(),
  items: [{ productId: new mongoose.Types.ObjectId(), name: 'Shoe', price: 1000, quantity: 1 }],
  total: 1060, deliveryAddress: { name: 'A', type: 'Home', address: 'x', pincode: '452001' }, paymentMethod: 'COD',
  status: 'Processing', shipmentId: '900', ...extra
});

test('return booking is stored before the reply', async () => {
  const order = await makeOrder({ status: 'Return Requested' });
  const rr = await ReturnRequest.create({
    orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 1000, refundMethod: 'Bank', status: 'Approved',
    shiprocketReturnOrderId: '1', shiprocketReturnShipmentId: '2', items: [{ productId: order.items[0].productId, name: 'Shoe', price: 1000, quantity: 1 }]
  });
  slowSaves(ReturnRequest);
  const res = replyProbe(() => ReturnRequest.findById(rr._id).lean().exec());
  await retryReturnShipment({ params: { id: rr._id }, body: { courierId: 1 } }, res);
  expect(res.body.success).toBe(true);
  const atReply = await res.storedAtReply;
  expect(atReply).toMatchObject({ awbCode: 'AWB-R1', pickupScheduled: true, status: 'Pick-up Scheduled', shipmentRetryInProgress: false });
});

test('Assign AWB: booking stored and lock released before the reply', async () => {
  const order = await makeOrder();
  slowSaves(Order);
  slowUpdates(Order);
  const res = replyProbe(() => Order.findById(order._id).lean().exec());
  await assignAWB({ body: { orderId: order._id, courierId: 1 } }, res);
  expect(res.statusCode).toBe(200);
  const atReply = await res.storedAtReply;
  expect(atReply.awbCode).toBe('AWB-R1');
  expect(atReply.bookingLockAt).toBeNull();
});

test('Process Order: lock released before a refusal reply', async () => {
  const order = await makeOrder();
  slowUpdates(Order);
  const res = replyProbe(() => Order.findById(order._id).lean().exec());
  await processOrder({ body: { orderId: order._id, courierId: 99 } }, res); // not serviceable
  expect(res.statusCode).toBe(409);
  expect((await res.storedAtReply).bookingLockAt).toBeNull();
});
