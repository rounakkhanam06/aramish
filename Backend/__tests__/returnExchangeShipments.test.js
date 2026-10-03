// Return / exchange pickups must never get stuck: a missing courier (AWB) can be assigned from
// admin without creating a duplicate Shiprocket order, a missing warehouse address fails clearly
// instead of sending the parcel to a made-up address, and an empty Shiprocket reply is a failure.
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
  sendNotificationToAdmins: jest.fn()
}));
jest.mock('../Router/shiprocketService', () => ({
  ...jest.requireActual('../Router/shiprocketService'),
  createShiprocketReturnOrder: jest.fn(),
  createExchangeForwardOrder: jest.fn(),
  assignAWB: jest.fn(),
  requestPickup: jest.fn()
}));

const mongoose = require('mongoose');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const shiprocketService = require('../Router/shiprocketService');
const Order = require('../Models/Order');
const ReturnRequest = require('../Models/ReturnRequest');
const ExchangeRequest = require('../Models/ExchangeRequest');
const { updateReturnStatus, retryReturnShipment } = require('../Controllers/returnController');
const { webhookReceiver } = require('../Controllers/shiprocketController');
const { retryExchangeShipment, updateExchangeAddress, handleExchangeWebhook } = require('../Controllers/exchangeController');

jest.setTimeout(120000);

const WAREHOUSE_ENV = {
  RETURN_SHIPPING_NAME: 'Aramish Shoes',
  RETURN_SHIPPING_ADDRESS: 'Khoja Haveli, 1/85, MG Rd',
  RETURN_SHIPPING_CITY: 'Agra',
  RETURN_SHIPPING_STATE: 'Uttar Pradesh',
  RETURN_SHIPPING_PHONE: '8650209559',
  SHIPROCKET_PICKUP_PINCODE: '282010'
};
const WALLET_ERROR = 'Please recharge your ShipRocket wallet. The minimum required balance is Rs 100';
const ADDRESS = { name: 'Arshia Makhija', type: 'Home', address: '103 Trilok Niwas, Agra, UP', pincode: '282002', phone: '7049380550' };

const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};
const admin = { _id: new mongoose.Types.ObjectId() };

const env = { ...process.env };
beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  await ExchangeRequest.deleteMany({});
  jest.clearAllMocks();
  process.env = { ...env, ...WAREHOUSE_ENV, SHIPROCKET_WEBHOOK_SECRET: 'test-secret' };
  shiprocketService.requestPickup.mockResolvedValue({ pickup_status: 1, response: { pickup_scheduled_date: '2026-10-04' } });
});
afterEach(() => { process.env = { ...env }; });

const makeOrder = (status = 'Return Requested') => Order.create({
  userId: new mongoose.Types.ObjectId(),
  items: [{ productId: new mongoose.Types.ObjectId(), name: 'Shoe', price: 1249, quantity: 1 }],
  total: 0, walletUsed: 1249, deliveryAddress: ADDRESS, paymentMethod: 'COD', status
});

describe('Return pickup', () => {
  const makeReturn = async (overrides = {}) => {
    const order = await makeOrder();
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 0, refundMethod: 'Bank',
      status: 'Requested', items: [{ productId: order.items[0].productId, name: 'Shoe', price: 1249, quantity: 1 }], ...overrides
    });
    return { order, rr };
  };
  const approve = (rr) => updateReturnStatus({ params: { id: rr._id }, body: { status: 'Approved' }, admin }, mockRes());

  test('declares the items\' value even when the refund is ₹0, and ships to the configured warehouse', async () => {
    const { rr } = await makeReturn();
    shiprocketService.createShiprocketReturnOrder.mockResolvedValue({ order_id: 333, shipment_id: 444 });
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_code: 'RAWB1', courier_name: 'Delhivery' } } });

    await approve(rr);

    const payload = shiprocketService.createShiprocketReturnOrder.mock.calls[0][0];
    expect(payload.sub_total).toBe(1249);
    expect(payload.shipping_address).toBe('Khoja Haveli, 1/85, MG Rd');
    expect(payload.shipping_pincode).toBe('282010');
    expect((await ReturnRequest.findById(rr._id)).awbCode).toBe('RAWB1');
  });

  test('a missing warehouse address fails clearly instead of using a made-up one', async () => {
    delete process.env.RETURN_SHIPPING_ADDRESS;
    const { rr } = await makeReturn();

    await approve(rr);

    expect(shiprocketService.createShiprocketReturnOrder).not.toHaveBeenCalled();
    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.shipmentStatus).toBe('Failed');
    expect(fresh.shipmentErrors[0].error).toMatch(/missing RETURN_SHIPPING_ADDRESS/);
  });

  test('Retry on a return whose courier failed only assigns the AWB (no second return order)', async () => {
    const { rr } = await makeReturn();
    shiprocketService.createShiprocketReturnOrder.mockResolvedValue({ order_id: 333, shipment_id: 444 });
    shiprocketService.assignAWB.mockResolvedValueOnce({ response: { data: { awb_assign_error: WALLET_ERROR } } });
    await approve(rr);
    expect((await ReturnRequest.findById(rr._id)).shipmentErrors[0].error).toContain(WALLET_ERROR);

    // Still failing (wallet not recharged yet): reported, nothing re-created
    shiprocketService.assignAWB.mockResolvedValueOnce({ response: { data: { awb_assign_error: WALLET_ERROR } } });
    let res = mockRes();
    await retryReturnShipment({ params: { id: rr._id } }, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.message).toContain(WALLET_ERROR);

    // Wallet recharged
    shiprocketService.assignAWB.mockResolvedValueOnce({ response: { data: { awb_code: 'RAWB9', courier_name: 'Xpressbees' } } });
    res = mockRes();
    await retryReturnShipment({ params: { id: rr._id } }, res);
    expect(res.statusCode).toBe(200);
    expect(shiprocketService.createShiprocketReturnOrder).toHaveBeenCalledTimes(1);
    expect(shiprocketService.assignAWB).toHaveBeenLastCalledWith('444', null, { isReturn: true });
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith('444');
    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.awbCode).toBe('RAWB9');
    expect(fresh.shipmentRetryInProgress).toBe(false);
    expect(fresh.shipmentRetryCount).toBe(0);

    // Already booked: nothing more to retry
    res = mockRes();
    await retryReturnShipment({ params: { id: rr._id } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('Retry on a return whose Shiprocket order failed creates it again', async () => {
    const { rr } = await makeReturn();
    shiprocketService.createShiprocketReturnOrder.mockRejectedValueOnce(new Error('Shiprocket down'));
    await approve(rr);
    expect((await ReturnRequest.findById(rr._id)).shipmentStatus).toBe('Failed');

    shiprocketService.createShiprocketReturnOrder.mockResolvedValue({ order_id: 333, shipment_id: 444 });
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_code: 'RAWB2', courier_name: 'Delhivery' } } });
    const res = mockRes();
    await retryReturnShipment({ params: { id: rr._id } }, res);

    expect(res.statusCode).toBe(200);
    expect((await ReturnRequest.findById(rr._id)).awbCode).toBe('RAWB2');
  });
});

describe('Exchange shipments', () => {
  const makeExchange = async (overrides = {}) => {
    const order = await makeOrder('Exchange Approved');
    return ExchangeRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size Issue', status: 'Approved',
      originalItem: { productId: order.items[0].productId, name: 'Shoe', price: 1249 },
      requestedVariant: { productId: order.items[0].productId, color: 'Brown', size: '9', sku: 'SKU-9', price: 1249 },
      ...overrides
    });
  };

  test('a leg with a shipment but no AWB gets the AWB assigned on retry (no duplicate order)', async () => {
    const exchange = await makeExchange({ reverse: { orderId: '55', shipmentId: '66', status: 'Created' } });
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_code: 'XAWB1', courier_name: 'Delhivery' } } });

    const res = mockRes();
    await retryExchangeShipment({ params: { id: exchange._id }, body: { leg: 'reverse' }, admin }, res);

    expect(res.statusCode).toBe(200);
    expect(shiprocketService.createShiprocketReturnOrder).not.toHaveBeenCalled();
    expect(shiprocketService.assignAWB).toHaveBeenCalledWith('66', null, { isReturn: true });
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith('66');
    const fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse.awb).toBe('XAWB1');
    expect(fresh.reverse.pickupScheduled).toBe(true);
    expect(fresh.retryCount).toBe(0);
    expect(fresh.shipmentRetryInProgress).toBe(false);
  });

  test('a failed AWB on retry is reported without marking the shipment failed', async () => {
    const exchange = await makeExchange({ forward: { orderId: '55', shipmentId: '77', status: 'Created' } });
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_assign_error: WALLET_ERROR } } });

    const res = mockRes();
    await retryExchangeShipment({ params: { id: exchange._id }, body: { leg: 'forward' }, admin }, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.message).toContain(WALLET_ERROR);
    const fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.forward.failed).toBe(false);
    expect(fresh.forward.shipmentId).toBe('77');
  });

  test('a Shiprocket reply without an order is a failed leg, not "Created"', async () => {
    const exchange = await makeExchange({ reverse: { status: 'Failed', failed: true } });
    shiprocketService.createShiprocketReturnOrder.mockResolvedValue({ status_code: 1 }); // no order_id

    const res = mockRes();
    await retryExchangeShipment({ params: { id: exchange._id }, body: { leg: 'reverse' }, admin }, res);

    expect(res.statusCode).toBe(502);
    const fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse.status).toBe('Failed');
    expect(fresh.reverse.shipmentId).toBeFalsy();
  });

  test('address cannot be changed once a shipment exists in Shiprocket', async () => {
    const exchange = await makeExchange({ reverse: { orderId: '55', shipmentId: '66', status: 'Created' } });
    const res = mockRes();
    await updateExchangeAddress({
      params: { id: exchange._id }, admin,
      body: { name: 'New', address: 'Somewhere', pincode: '282001', phone: '9999999999', city: 'Agra', state: 'UP' }
    }, res);

    expect(res.statusCode).toBe(400);
    expect((await Order.findById(exchange.orderId)).deliveryAddress.name).toBe('Arshia Makhija');
  });

  test('an AWB assigned in the Shiprocket panel is picked up from the webhook', async () => {
    const exchange = await makeExchange({ reverse: { orderId: '55', shipmentId: '66', status: 'Created' } });
    await handleExchangeWebhook({
      headers: { 'x-api-key': 'test-secret' },
      body: { order_id: `EXC_REV_${exchange._id}`, current_status: 'PICKUP SCHEDULED', awb: 'PANELAWB' }
    }, mockRes());

    const fresh = await ExchangeRequest.findById(exchange._id);
    expect(fresh.reverse.awb).toBe('PANELAWB');
  });
});

describe('Return pickup scheduling (Shiprocket does not schedule it by itself)', () => {
  const makeApprovedReturn = async () => {
    const order = await makeOrder();
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 1249, refundMethod: 'Bank',
      status: 'Requested', items: [{ productId: order.items[0].productId, name: 'Shoe', price: 1249, quantity: 1 }]
    });
    shiprocketService.createShiprocketReturnOrder.mockResolvedValue({ order_id: 333, shipment_id: 444 });
    return { order, rr };
  };
  const approve = (rr) => updateReturnStatus({ params: { id: rr._id }, body: { status: 'Approved' }, admin }, mockRes());

  test('approval assigns the return AWB (is_return) and then requests the pickup', async () => {
    const { rr } = await makeApprovedReturn();
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_code: 'RAWB1', courier_name: 'Delhivery' } } });

    await approve(rr);

    expect(shiprocketService.assignAWB).toHaveBeenCalledWith('444', null, { isReturn: true });
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith('444');
    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.pickupScheduled).toBe(true);
    expect(fresh.status).toBe('Pick-up Scheduled');
  });

  test('"already in pickup queue" from Shiprocket counts as scheduled', async () => {
    const { rr } = await makeApprovedReturn();
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_code: 'RAWB1', courier_name: 'Delhivery' } } });
    shiprocketService.requestPickup.mockRejectedValue(Object.assign(new Error('400'), { response: { status: 400, data: { message: 'Already in Pickup Queue.' } } }));

    await approve(rr);

    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.pickupScheduled).toBe(true);
    expect(fresh.shipmentErrors).toHaveLength(0);
  });

  test('a refused pickup is recorded; Retry then only requests the pickup', async () => {
    const { rr } = await makeApprovedReturn();
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_code: 'RAWB1', courier_name: 'Delhivery' } } });
    shiprocketService.requestPickup.mockResolvedValueOnce({ pickup_status: 0, message: 'Pickup location not active' });

    await approve(rr);
    let fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.awbCode).toBe('RAWB1');
    expect(fresh.pickupScheduled).toBe(false);
    expect(fresh.status).toBe('Approved');
    expect(fresh.shipmentErrors[0].error).toMatch(/pickup not scheduled: Pickup location not active/);

    const res = mockRes();
    await retryReturnShipment({ params: { id: rr._id } }, res);
    expect(res.statusCode).toBe(200);
    expect(shiprocketService.assignAWB).toHaveBeenCalledTimes(1); // AWB not re-assigned
    expect(shiprocketService.createShiprocketReturnOrder).toHaveBeenCalledTimes(1);
    fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.pickupScheduled).toBe(true);
    expect(fresh.status).toBe('Pick-up Scheduled');
  });
});

describe('Return tracking updates (same webhook URL, is_return: 1)', () => {
  const webhook = (body) => webhookReceiver({ headers: { 'x-api-key': 'test-secret' }, body }, mockRes());

  test('moves the return along and never touches the original order', async () => {
    const order = await makeOrder('Return Requested');
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 1249, refundMethod: 'Bank',
      status: 'Approved', shiprocketReturnOrderId: '333', shiprocketReturnShipmentId: '444',
      items: [{ productId: order.items[0].productId, name: 'Shoe', price: 1249, quantity: 1 }]
    });

    await webhook({ order_id: `RET_${rr._id}`, is_return: 1, current_status: 'OUT FOR PICKUP', awb: 'PANELAWB', courier_name: 'Delhivery' });
    let fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.status).toBe('Pick-up Scheduled');
    expect(fresh.awbCode).toBe('PANELAWB');
    expect(fresh.pickupScheduled).toBe(true);

    await webhook({ order_id: `RET_${rr._id}`, is_return: 1, current_status: 'DELIVERED', awb: 'PANELAWB' });
    fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.status).toBe('Received'); // refund stays a manual admin step

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.status).toBe('Return Requested');
  });

  test('a cancelled return pickup is recorded for admin', async () => {
    const order = await makeOrder('Return Requested');
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size/Fit Issue', refundAmount: 1249, refundMethod: 'Bank',
      status: 'Pick-up Scheduled', awbCode: 'RAWB1', items: [{ productId: order.items[0].productId, name: 'Shoe', price: 1249, quantity: 1 }]
    });

    await webhook({ order_id: 'something-else', is_return: 1, current_status: 'CANCELED', awb: 'RAWB1' });

    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.status).toBe('Pick-up Scheduled');
    expect(fresh.shipmentErrors[0].error).toMatch(/CANCELED/);
  });
});

describe('Exchange pickups', () => {
  const makeExchange = async (overrides = {}) => {
    const order = await makeOrder('Exchange Approved');
    return ExchangeRequest.create({
      orderId: order._id, userId: order.userId, reason: 'Size Issue', status: 'Approved',
      originalItem: { productId: order.items[0].productId, name: 'Shoe', price: 1249 },
      requestedVariant: { productId: order.items[0].productId, color: 'Brown', size: '9', sku: 'SKU-9', price: 1249 },
      ...overrides
    });
  };

  test('"Schedule Pickup" for a packed replacement only requests the pickup', async () => {
    const exchange = await makeExchange({ forward: { orderId: '55', shipmentId: '77', awb: 'FAWB', status: 'AWB Assigned' } });

    const res = mockRes();
    await retryExchangeShipment({ params: { id: exchange._id }, body: { leg: 'forward' }, admin }, res);

    expect(res.statusCode).toBe(200);
    expect(shiprocketService.assignAWB).not.toHaveBeenCalled();
    expect(shiprocketService.requestPickup).toHaveBeenCalledWith('77');
    expect((await ExchangeRequest.findById(exchange._id)).forward.pickupScheduled).toBe(true);
  });

  test('a leg that is already moving never gets a new pickup request', async () => {
    const exchange = await makeExchange({ forward: { orderId: '55', shipmentId: '77', awb: 'FAWB', status: 'IN TRANSIT' } });

    const res = mockRes();
    await retryExchangeShipment({ params: { id: exchange._id }, body: { leg: 'forward' }, admin }, res);

    expect(res.statusCode).toBe(400);
    expect(shiprocketService.requestPickup).not.toHaveBeenCalled();
  });
});
