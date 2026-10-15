// READ-ONLY review of orders placed before GST invoicing (no tax snapshot). Prints aggregate
// counts only (no customer data) to decide how historical invoices can be handled.
//   node scripts/reviewHistoricalInvoices.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const SystemConfig = require('../Models/SystemConfig');
const { stateFromPincode } = require('../utils/gstData');
const { sellerDetailsProblems, isDeliveredForInvoice } = require('../utils/invoiceService');

const RATE_CHANGE = new Date('2025-09-22T00:00:00+05:30');
const money = (n) => Math.round(Number(n || 0) * 100);

(async () => {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGO_URI);
  const historical = await Order.find({ taxDataCapturedAt: null })
    .select('status createdAt items.productId items.price items.quantity subtotal discountAmount gstAmount platformCommission deliveryCharge codCharge prepaidDiscount walletUsed refundWalletUsed total deliveryAddress.pincode deliveryAddress.state invoice.number')
    .lean();

  const productIds = [...new Set(historical.flatMap(o => (o.items || []).map(i => String(i.productId))))];
  const products = await Product.find({ _id: { $in: productIds } }).select('hsnCode gstRate').lean();
  const productById = new Map(products.map(p => [String(p._id), p]));

  const r = {
    totalOrders: await Order.countDocuments(),
    historicalOrders: historical.length,
    alreadyInvoiced: historical.filter(o => o.invoice && o.invoice.number).length,
    byStatus: {},
    deliveredOrLater: 0,
    dateRange: { first: null, last: null },
    placedBeforeRateChange_2025_09_22: 0,
    placedOnOrAfterRateChange: 0,
    gstAddedOnTop_gstAmountGt0: 0,
    deliveryStateStored: 0,
    deliveryStateFromPincodeOnly: 0,
    deliveryStateUnknown: 0,
    lineItems: 0,
    lineItemsProductDeleted: 0,
    lineItemsProductHasHsnToday: 0,
    lineItemsProductHasGstOverrideToday: 0,
    billFormulaMismatch: 0
  };

  for (const o of historical) {
    r.byStatus[o.status] = (r.byStatus[o.status] || 0) + 1;
    if (isDeliveredForInvoice(o.status)) r.deliveredOrLater += 1;
    const t = new Date(o.createdAt);
    if (!r.dateRange.first || t < r.dateRange.first) r.dateRange.first = t;
    if (!r.dateRange.last || t > r.dateRange.last) r.dateRange.last = t;
    if (t < RATE_CHANGE) r.placedBeforeRateChange_2025_09_22 += 1; else r.placedOnOrAfterRateChange += 1;
    if (Number(o.gstAmount) > 0) r.gstAddedOnTop_gstAmountGt0 += 1;
    const addr = o.deliveryAddress || {};
    if (addr.state) r.deliveryStateStored += 1;
    else if (stateFromPincode(addr.pincode)) r.deliveryStateFromPincodeOnly += 1;
    else r.deliveryStateUnknown += 1;

    for (const i of o.items || []) {
      r.lineItems += 1;
      const p = productById.get(String(i.productId));
      if (!p) r.lineItemsProductDeleted += 1;
      else {
        if (p.hsnCode && String(p.hsnCode).trim()) r.lineItemsProductHasHsnToday += 1;
        if (p.gstRate !== null && p.gstRate !== undefined) r.lineItemsProductHasGstOverrideToday += 1;
      }
    }
    const bill = money(o.subtotal) - money(o.discountAmount) + money(o.gstAmount) + money(o.platformCommission)
      + money(o.deliveryCharge) + money(o.codCharge) - money(o.prepaidDiscount);
    const paid = money(o.total) + money(o.walletUsed) + money(o.refundWalletUsed);
    if (Math.max(0, bill) !== paid) r.billFormulaMismatch += 1;
  }

  const config = await SystemConfig.findOne({}).lean();
  r.sellerSettingsProblems = sellerDetailsProblems(config || {});
  r.productsTotal = await Product.countDocuments();
  r.productsWithHsn = await Product.countDocuments({ hsnCode: { $nin: [null, ''] } });

  console.log(JSON.stringify(r, null, 2));
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Review failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
