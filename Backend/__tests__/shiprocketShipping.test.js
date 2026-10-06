// Shipping fixes: COD amount sent to Shiprocket, address name/phone, per-product HSN, strict
// delivery pricing at checkout, cheapest-courier selection, RTO handling and return AWB errors.
jest.mock('../Router/firebaseAdmin', () => ({
  sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
  sendNotificationToAdmins: jest.fn()
}));
jest.mock('../Router/shiprocketService', () => ({
  ...jest.requireActual('../Router/shiprocketService'),
  checkServiceability: jest.fn(),
  createShiprocketOrder: jest.fn(),
  createShiprocketReturnOrder: jest.fn(),
  assignAWB: jest.fn(),
  requestPickup: jest.fn(),
  generateLabel: jest.fn()
}));

const mongoose = require('mongoose');
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');
const shiprocketService = require('../Router/shiprocketService');
const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const SystemConfig = require('../Models/SystemConfig');
const { createOrder } = require('../Controllers/orderController');
const { processOrder, webhookReceiver, estimateShipping } = require('../Controllers/shiprocketController');

jest.setTimeout(120000);

const COURIERS = [
  { courier_company_id: 10, courier_name: 'Pricey', freight_charge: 90, cod_charges: 40, etd: '2 days' },
  { courier_company_id: 20, courier_name: 'Cheap', freight_charge: 50, cod_charges: 30, etd: '4 days' }
];
const ADDRESS = { name: 'Arshia Makhija', type: 'Home', address: '103 Trilok Niwas, Agra, UP', pincode: '282002', phone: '7049380550' };

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ phone: `94${String(counter).padStart(8, '0')}`, name: 'Raunak', isVerified: true, walletBalance: 0, refundWalletBalance: 0, ...overrides });
};
const makeProduct = (overrides = {}) => {
  counter += 1;
  return Product.create({
    name: `Shoe ${counter}`, category: 'Shoes', sellingPrice: 1000, mrp: 1200, stock: 10, sales: 0,
    article: `ART-S-${counter}-${Date.now()}`, sku: `SKU-S-${counter}-${Date.now()}`, shippingSpecs: { weight: 0.8 },
    hsnCode: '6403', status: 'Approved', ...overrides
  });
};
const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};
const checkout = async (user, product, { paymentMethod = 'COD', redeemRefundWallet = false, redeemWallet = false } = {}) => {
  const res = mockRes();
  await createOrder({
    user: { _id: user._id },
    body: {
      items: [{ productId: product._id.toString(), name: product.name, quantity: 1 }],
      total: 1, deliveryAddress: ADDRESS, paymentMethod, redeemRefundWallet, redeemWallet,
      deliveryCharge: 0 // a client-sent charge must be ignored
    }
  }, res);
  return res;
};
const sentToShiprocket = () => shiprocketService.createShiprocketOrder.mock.calls[0][0];

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  jest.clearAllMocks();
  await SystemConfig.create({ returnWindowDays: 2, commission: 0, codChargeEnabled: false, prepaidDiscountEnabled: false });
  shiprocketService.checkServiceability.mockResolvedValue({ data: { available_courier_companies: COURIERS } });
  shiprocketService.createShiprocketOrder.mockResolvedValue({ order_id: 111, shipment_id: 222 });
});

describe('Order sent to Shiprocket at checkout', () => {
  test('COD amount is what the customer still owes after coins', async () => {
    const user = await makeUser({ walletBalance: 1000 });
    const product = await makeProduct();

    const res = await checkout(user, product, { redeemWallet: true });

    expect(res.statusCode).toBe(201);
    const order = await Order.findById(res.body.order._id);
    // ₹1,000 product + ₹50 delivery − ₹250 coins (25% of the ₹1,000 product value)
    expect(order.walletUsed).toBe(250);
    expect(order.total).toBe(800);
    const payload = sentToShiprocket();
    expect(payload.payment_method).toBe('COD');
    expect(payload.sub_total).toBe(800); // the courier collects ₹800, not ₹1,050
  });

  test('coins and Refund Wallet together: courier collects only the remainder', async () => {
    const user = await makeUser({ walletBalance: 1000, refundWalletBalance: 300 });
    const product = await makeProduct();

    const res = await checkout(user, product, { redeemWallet: true, redeemRefundWallet: true });

    expect(res.statusCode).toBe(201);
    const order = await Order.findById(res.body.order._id);
    expect(order.walletUsed).toBe(250);
    expect(order.refundWalletUsed).toBe(300);
    expect(order.total).toBe(500);
    expect(sentToShiprocket().sub_total).toBe(500);
  });

  test('COD amount is what the customer still owes after Refund Wallet money', async () => {
    const user = await makeUser({ refundWalletBalance: 300 });
    const product = await makeProduct();

    const res = await checkout(user, product, { redeemRefundWallet: true });

    expect(res.statusCode).toBe(201);
    const order = await Order.findById(res.body.order._id);
    // ₹1,000 product + ₹50 cheapest delivery (Shiprocket's ₹30 cod_charges not passed on) − ₹300 Refund Wallet
    expect(order.deliveryCharge).toBe(50);
    expect(order.total).toBe(750);
    const payload = sentToShiprocket();
    expect(payload.payment_method).toBe('COD');
    expect(payload.sub_total).toBe(750);
  });

  test('COD bill = Shiprocket delivery + Admin COD charge only; Prepaid = delivery − Admin prepaid discount', async () => {
    await SystemConfig.updateOne({}, { codChargeEnabled: true, codChargeAmount: 150, prepaidDiscountEnabled: true, prepaidDiscountAmount: 100 });
    const product = await makeProduct({ stock: 10 });

    const cod = await checkout(await makeUser(), product, { paymentMethod: 'COD' });
    expect(cod.statusCode).toBe(201);
    const codOrder = await Order.findById(cod.body.order._id);
    expect(codOrder.deliveryCharge).toBe(50); // freight only — no Shiprocket cod_charges
    expect(codOrder.codCharge).toBe(150);
    expect(codOrder.prepaidDiscount).toBe(0);
    expect(codOrder.total).toBe(1000 + 50 + 150);

    const prepaid = await checkout(await makeUser(), product, { paymentMethod: 'Online' });
    expect(prepaid.statusCode).toBe(201);
    const prepaidOrder = await Order.findById(prepaid.body.order._id);
    expect(prepaidOrder.deliveryCharge).toBe(50);
    expect(prepaidOrder.codCharge).toBe(0);
    expect(prepaidOrder.prepaidDiscount).toBe(100);
    expect(prepaidOrder.total).toBe(1000 + 50 - 100);
  });

  test('the estimate API quotes freight only, without Shiprocket cod_charges', async () => {
    const res = mockRes();
    await estimateShipping({ body: { deliveryPincode: '282002', weight: 0.8, cod: 1 } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.deliveryCharge).toBe(50);
  });

  test('a COD order fully covered by the Refund Wallet is sent as Prepaid (nothing to collect)', async () => {
    const user = await makeUser({ refundWalletBalance: 5000 });
    const product = await makeProduct();

    const res = await checkout(user, product, { redeemRefundWallet: true });

    expect(res.statusCode).toBe(201);
    expect(res.body.order.total).toBe(0);
    const payload = sentToShiprocket();
    expect(payload.payment_method).toBe('Prepaid');
    expect(payload.sub_total).toBe(1050); // full order value declared (₹1,000 + ₹50 delivery)
  });

  test('uses the selected address name/phone and the product HSN code', async () => {
    const user = await makeUser();
    const product = await makeProduct();

    await checkout(user, product);

    const payload = sentToShiprocket();
    expect(payload.billing_customer_name).toBe('Arshia Makhija');
    expect(payload.billing_phone).toBe('7049380550');
    expect(payload.order_items[0].hsn).toBe('6403');
    expect(payload.weight).toBe(0.8);
  });

  test('a customer without an email gets the store inbox, never a placeholder on another domain', async () => {
    const savedEnv = { ...process.env };
    try {
      delete process.env.SHIPROCKET_FALLBACK_EMAIL;
      process.env.RETURN_SHIPPING_EMAIL = 'store@example.com';
      const product = await makeProduct();

      await checkout(await makeUser(), product);
      expect(sentToShiprocket().billing_email).toBe('store@example.com');

      shiprocketService.createShiprocketOrder.mockClear();
      await checkout(await makeUser({ email: 'arshia@example.com' }), await makeProduct());
      expect(sentToShiprocket().billing_email).toBe('arshia@example.com');

      shiprocketService.createShiprocketOrder.mockClear();
      delete process.env.RETURN_SHIPPING_EMAIL;
      await checkout(await makeUser(), await makeProduct());
      expect(sentToShiprocket().billing_email).toBe('aramishshoes@gmail.com');
    } finally {
      process.env = savedEnv;
    }
  });

  test('a product without an HSN code is sent without one (no made-up code)', async () => {
    const user = await makeUser();
    const product = await makeProduct({ hsnCode: '' });

    await checkout(user, product);

    expect(sentToShiprocket().order_items[0]).not.toHaveProperty('hsn');
  });
});

describe('Delivery charge at checkout comes only from Shiprocket', () => {
  test('a failed Shiprocket quote blocks the order instead of giving free delivery', async () => {
    const user = await makeUser();
    const product = await makeProduct();
    shiprocketService.checkServiceability.mockRejectedValue(new Error('Shiprocket down'));

    const res = await checkout(user, product);

    expect(res.statusCode).toBe(503);
    expect(await Order.countDocuments()).toBe(0);
    expect((await Product.findById(product._id)).stock).toBe(10); // stock rolled back
  });

  test('a pincode with no courier is rejected', async () => {
    const user = await makeUser();
    const product = await makeProduct();
    shiprocketService.checkServiceability.mockResolvedValue({ data: { available_courier_companies: [] } });

    const res = await checkout(user, product);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/not available to pincode 282002/);
    expect(await Order.countDocuments()).toBe(0);
  });

  test('the estimate API reports "not deliverable" instead of ₹0', async () => {
    shiprocketService.checkServiceability.mockResolvedValue({ data: { available_courier_companies: [] } });
    const res = mockRes();
    await estimateShipping({ body: { deliveryPincode: '282002', weight: 0.8, cod: 1 } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Process Order courier choice', () => {
  test('books the cheapest courier, checked at the order\'s real weight', async () => {
    const product = await makeProduct();
    const order = await Order.create({
      userId: new mongoose.Types.ObjectId(),
      items: [{ productId: product._id, name: 'Shoe', price: 1000, quantity: 2 }],
      total: 2080, deliveryAddress: ADDRESS, paymentMethod: 'COD', status: 'Processing', shipmentId: '222'
    });
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_code: 'AWB1', courier_name: 'Cheap' } } });
    shiprocketService.requestPickup.mockResolvedValue({ pickup_status: 1 });
    shiprocketService.generateLabel.mockResolvedValue({ label_created: 1, label_url: 'https://label.pdf' });

    await processOrder({ body: { orderId: order._id } }, mockRes());

    expect(shiprocketService.checkServiceability).toHaveBeenCalledWith(expect.any(String), '282002', 1.6, 1);
    expect(shiprocketService.assignAWB).toHaveBeenCalledWith('222', 20);
  });
});

describe('RTO (parcel returned to the warehouse)', () => {
  const env = { ...process.env };
  beforeEach(() => { process.env.SHIPROCKET_WEBHOOK_SECRET = 'test-secret'; });
  afterEach(() => { process.env = { ...env }; });

  const webhook = (order, status) => webhookReceiver({
    headers: { 'x-api-key': 'test-secret' },
    body: { order_id: `ORD_${order._id}`, current_status: status, awb: 'AWB1' }
  }, mockRes());

  test('"RTO Initiated" keeps the order and stock as they are; "RTO Delivered" cancels and restocks', async () => {
    const product = await makeProduct({ stock: 9 });
    const order = await Order.create({
      userId: (await makeUser())._id,
      items: [{ productId: product._id, name: 'Shoe', price: 1000, quantity: 1 }],
      total: 1080, deliveryAddress: ADDRESS, paymentMethod: 'COD', status: 'Out for Delivery', awbCode: 'AWB1'
    });

    await webhook(order, 'RTO INITIATED');
    let fresh = await Order.findById(order._id);
    expect(fresh.status).toBe('Out for Delivery');
    expect(fresh.shipmentStatus).toBe('RTO INITIATED');
    expect((await Product.findById(product._id)).stock).toBe(9);

    await webhook(order, 'RTO DELIVERED');
    fresh = await Order.findById(order._id);
    expect(fresh.status).toBe('Cancelled');
    expect((await Product.findById(product._id)).stock).toBe(10);
  });
});

describe('Return pickup AWB failure', () => {
  const env = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, {
      RETURN_SHIPPING_ADDRESS: 'Khoja Haveli, Agra', RETURN_SHIPPING_CITY: 'Agra', RETURN_SHIPPING_STATE: 'Uttar Pradesh',
      RETURN_SHIPPING_PHONE: '8650209559', SHIPROCKET_PICKUP_PINCODE: '282010'
    });
  });
  afterEach(() => { process.env = { ...env }; });

  test('is recorded on the return so admin can see why', async () => {
    const { updateReturnStatus } = require('../Controllers/returnController');
    const user = await makeUser();
    const product = await makeProduct();
    const order = await Order.create({
      userId: user._id, items: [{ productId: product._id, name: 'Shoe', price: 1000, quantity: 1 }],
      total: 1080, deliveryAddress: ADDRESS, paymentMethod: 'COD', status: 'Return Requested'
    });
    const rr = await ReturnRequest.create({
      orderId: order._id, userId: user._id, reason: 'Size/Fit Issue', refundAmount: 1000, refundMethod: 'Bank', status: 'Requested',
      items: [{ productId: product._id, name: 'Shoe', price: 1000, quantity: 1 }]
    });
    shiprocketService.createShiprocketReturnOrder.mockResolvedValue({ order_id: 333, shipment_id: 444 });
    shiprocketService.assignAWB.mockResolvedValue({ response: { data: { awb_assign_error: 'Please recharge your ShipRocket wallet' } } });

    await updateReturnStatus({ params: { id: rr._id }, body: { status: 'Approved' }, admin: { _id: new mongoose.Types.ObjectId() } }, mockRes());

    const fresh = await ReturnRequest.findById(rr._id);
    expect(fresh.shiprocketReturnOrderId).toBe('333');
    expect(fresh.awbCode).toBeFalsy();
    expect(fresh.shipmentErrors.map(e => e.error).join(' ')).toMatch(/recharge your ShipRocket wallet/);
    const payload = shiprocketService.createShiprocketReturnOrder.mock.calls[0][0];
    expect(payload.pickup_phone).toBe('7049380550');
    expect(payload.order_items[0].hsn).toBe('6403');
  });
});
