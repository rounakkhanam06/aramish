/**
 * GST tax invoices.
 *
 *  - Selling prices are GST-INCLUSIVE: tax is extracted from what the customer was charged, never
 *    added on top. taxable = net x 100 / (100 + rate), tax = net - taxable (integer paise).
 *  - Rate: an admin per-product override, else the footwear slab rule in force on the invoice
 *    date (SystemConfig.gstRateRules), judged on the per-pair sale value after discounts.
 *  - Coupon and prepaid discounts are given on the invoice, so they reduce the taxable value
 *    (spread over the lines in proportion to value). Wallet coins / Refund Wallet are means of
 *    payment and do not.
 *  - Platform fee, delivery and COD charges are part of the same (composite) supply and are taxed
 *    at the rate of the goods they ship with.
 *  - Place of supply = delivery state. Same state as the seller -> CGST + SGST, else IGST.
 *  - Issued once (at dispatch, when goods are removed — CGST Act s.31(1)(a)), numbered
 *    <prefix>/<YY-YY>/<NNNNNN> from an atomic per-financial-year counter, inside a transaction so
 *    a number is never skipped, duplicated or reassigned. The full snapshot is stored on the order
 *    and every download renders that snapshot.
 */
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Order = require('../Models/Order');
const Counter = require('../Models/Counter');
const SystemConfig = require('../Models/SystemConfig');
const { gstinError, panError, resolveState, resolveAddressState, normalizeGstin } = require('./gstData');
const { isTransientTransactionError, sleep } = require('./transactionRetry');

const DEFAULT_GST_RATE_RULES = SystemConfig.schema.path('gstRateRules').defaultValue();

// Statuses at/after dispatch. 'Processing' is added only for an explicit dispatch event
// (courier pickup, or an admin issuing it while handing the parcel over).
const NEVER_ISSUABLE = ['Pending', 'Cancelled'];
const PRE_DISPATCH = ['Pending', 'Processing'];
// Customers may download only once the order has been delivered (incl. later return/exchange states).
const NOT_YET_DELIVERED = ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Cancelled'];

const isIssuableStatus = (status, { allowProcessing = false } = {}) =>
  !NEVER_ISSUABLE.includes(status) && (allowProcessing || !PRE_DISPATCH.includes(status));
const isDeliveredForInvoice = (status) => !!status && !NOT_YET_DELIVERED.includes(status);

const invoiceError = (code, message, status = 400) => Object.assign(new Error(message), { code, status });

// ---------- money helpers (integer paise) ----------
const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);
const toRupees = (paise) => Math.round(paise) / 100;

/** Split `total` paise over `weights` proportionally (largest remainder); always sums to total. */
const allocate = (total, weights) => {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map(w => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let rest = total - parts.reduce((a, p) => a + p, 0);
  exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => { if (rest > 0) { parts[i] += 1; rest -= 1; } });
  return parts;
};

// ---------- dates (IST) ----------
const IST_OFFSET_MS = 330 * 60 * 1000;
const istParts = (date) => {
  const d = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
/** Indian financial year (April-March) of a date, as YY-YY. */
const financialYear = (date) => {
  const { y, m } = istParts(date);
  const start = m >= 4 ? y : y - 1;
  return `${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
};
const formatDate = (date) => {
  const { y, m, d } = istParts(date);
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
};

// ---------- rates ----------
const rateRuleFor = (date, rules) => {
  const t = new Date(date).getTime();
  return (rules || [])
    .filter(r => r && r.effectiveFrom && new Date(r.effectiveFrom).getTime() <= t)
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0] || null;
};

/** Rate for one pair whose GST-inclusive net price is `unitPaise`, under `rule`. */
const footwearRate = (unitPaise, rule) => {
  const low = Number(rule.rateUpToThreshold);
  const threshold = Number(rule.threshold) || 0;
  if (threshold <= 0) return low;
  // Sale value is the taxable value: at the lower rate it must not exceed the threshold.
  return (unitPaise * 100) / (100 + low) <= threshold * 100 ? low : Number(rule.rateAboveThreshold);
};

const gstRateRules = (config) =>
  (config && Array.isArray(config.gstRateRules) && config.gstRateRules.length) ? config.gstRateRules : DEFAULT_GST_RATE_RULES;

// ---------- seller ----------
// Settings saved before these fields existed have no prefix stored (lean reads skip defaults).
const invoicePrefix = (config) => String((config && config.invoicePrefix) || 'ARM').toUpperCase();

/** Every missing/invalid seller detail; empty when the settings can issue invoices. */
const sellerDetailsProblems = (config = {}) => {
  const problems = [];
  if (!String(config.businessLegalName || '').trim()) problems.push('Legal business name is missing');
  if (!String(config.businessAddress || '').trim()) problems.push('Registered address is missing');
  const state = resolveState(config.businessStateCode) || resolveState(config.businessState);
  if (!state) problems.push('Business state / state code is missing or invalid');
  const gErr = gstinError(config.gstNo);
  if (gErr) problems.push(`Seller ${gErr}`);
  const pErr = panError(config.businessPan);
  if (pErr) problems.push(pErr);
  const gstin = normalizeGstin(config.gstNo);
  if (!gErr && state && gstin.slice(0, 2) !== state.code) problems.push('GSTIN does not belong to the selected business state');
  if (!gErr && !pErr && gstin.slice(2, 12) !== String(config.businessPan).toUpperCase().trim()) problems.push('PAN does not match the GSTIN');
  if (!/^[A-Z0-9]{1,10}$/i.test(invoicePrefix(config))) problems.push('Invoice prefix must be 1-10 letters/digits');
  return problems;
};

const buildSeller = (config) => {
  const state = resolveState(config.businessStateCode) || resolveState(config.businessState);
  return {
    legalName: config.businessLegalName.trim(),
    tradeName: String(config.businessTradeName || '').trim() || null,
    address: config.businessAddress.trim(),
    state: state.name,
    stateCode: state.code,
    gstin: normalizeGstin(config.gstNo),
    pan: String(config.businessPan).toUpperCase().trim(),
    email: config.supportEmail || null,
    phone: config.helpline || null
  };
};

// ---------- calculation ----------
const attributesText = (attributes) => {
  const obj = attributes instanceof Map ? Object.fromEntries(attributes) : (attributes || {});
  const parts = Object.entries(obj).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  return parts.length ? ` (${parts.join(', ')})` : '';
};

const taxSplit = (netPaise, rate, interState) => {
  const taxable = Math.round((netPaise * 100) / (100 + rate));
  const tax = netPaise - taxable;
  if (interState) return { taxable, cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.round(tax / 2);
  return { taxable, cgst, sgst: tax - cgst, igst: 0 };
};

/**
 * Builds the complete invoice snapshot for an order (no DB writes). Throws an invoiceError when
 * the order cannot be invoiced correctly (missing place of supply, rate rule, total mismatch).
 */
const computeInvoiceData = (order, config, issueDate = new Date()) => {
  const seller = buildSeller(config);
  const addr = order.deliveryAddress || {};
  const pos = resolveState(addr.stateCode) || resolveState(addr.state);
  if (!pos) throw invoiceError('PLACE_OF_SUPPLY_MISSING', 'The delivery state (place of supply) is not known for this order.');
  const interState = pos.code !== seller.stateCode;
  const rule = rateRuleFor(issueDate, gstRateRules(config));

  const items = order.items || [];
  const grosses = items.map(i => toPaise(i.price) * Number(i.quantity || 0));
  const goodsTotal = grosses.reduce((a, g) => a + g, 0);
  const charges = [
    ['Platform fee', order.platformCommission],
    ['Delivery charges', order.deliveryCharge],
    ['COD charges', order.codCharge]
  ].map(([label, amt]) => ({ label, gross: toPaise(amt) })).filter(c => c.gross > 0);
  const chargesTotal = charges.reduce((a, c) => a + c.gross, 0);

  const discount = toPaise(order.discountAmount) + toPaise(order.prepaidDiscount);
  const goodsDiscount = Math.min(discount, goodsTotal);
  const chargesDiscount = Math.min(discount - goodsDiscount, chargesTotal);
  const itemDiscounts = allocate(goodsDiscount, grosses);
  const chargeDiscounts = allocate(chargesDiscount, charges.map(c => c.gross));

  const lines = [];
  const groups = new Map(); // rate -> { net, hsn, hsnNet }
  items.forEach((item, idx) => {
    const qty = Number(item.quantity || 0);
    const net = grosses[idx] - itemDiscounts[idx];
    let rate = item.gstRateOverride;
    if (rate === null || rate === undefined) {
      if (!rule) throw invoiceError('GST_RULE_MISSING', 'No GST rate rule is in force for the invoice date.');
      rate = footwearRate(qty ? net / qty : 0, rule);
    }
    rate = Number(rate);
    const hsn = String(item.hsnCode || config.defaultHsnCode || '').trim() || null;
    lines.push({
      kind: 'goods',
      description: `${item.name}${attributesText(item.attributes)}`,
      sku: item.variationSku || item.article || null,
      hsn, quantity: qty, unitPrice: toPaise(item.price),
      gross: grosses[idx], discount: itemDiscounts[idx], net, rate,
      ...taxSplit(net, rate, interState)
    });
    const g = groups.get(rate) || { net: 0, hsn: null, hsnNet: -1 };
    g.net += net;
    if (net > g.hsnNet) { g.hsn = hsn; g.hsnNet = net; }
    groups.set(rate, g);
  });

  const groupList = [...groups.entries()].map(([rate, g]) => ({ rate, ...g }));
  const groupNetTotal = groupList.reduce((a, g) => a + g.net, 0);
  charges.forEach((charge, idx) => {
    const net = charge.gross - chargeDiscounts[idx];
    if (net <= 0 && charge.gross <= 0) return;
    // Same rate as the goods it ships with; with goods at mixed rates, split by goods value.
    const targets = groupNetTotal > 0 ? groupList.filter(g => g.net > 0)
      : [groupList.slice().sort((a, b) => b.rate - a.rate)[0]].filter(Boolean);
    if (!targets.length) throw invoiceError('NO_GOODS', 'The order has no goods lines to invoice.');
    const grossParts = allocate(charge.gross, targets.map(g => g.net || 1));
    const discParts = allocate(chargeDiscounts[idx], targets.map(g => g.net || 1));
    targets.forEach((g, i) => {
      const partNet = grossParts[i] - discParts[i];
      lines.push({
        kind: 'charge',
        description: targets.length > 1 ? `${charge.label} (on ${g.rate}% goods)` : charge.label,
        sku: null, hsn: g.hsn, quantity: 1, unitPrice: grossParts[i],
        gross: grossParts[i], discount: discParts[i], net: partNet, rate: g.rate,
        ...taxSplit(partNet, g.rate, interState)
      });
    });
  });

  const sum = (key) => lines.reduce((a, l) => a + l[key], 0);
  const grandTotal = sum('net');
  // The invoice must equal exactly what the customer was billed (paid in any form).
  const billed = toPaise(order.total) + toPaise(order.walletUsed) + toPaise(order.refundWalletUsed);
  if (grandTotal !== billed) {
    throw invoiceError('INVOICE_TOTAL_MISMATCH', `Invoice total ${toRupees(grandTotal)} does not match the order bill ${toRupees(billed)}.`);
  }

  const hsnSummary = new Map();
  lines.forEach(l => {
    const key = `${l.hsn || '-'}|${l.rate}`;
    const s = hsnSummary.get(key) || { hsn: l.hsn, rate: l.rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    s.taxable += l.taxable; s.cgst += l.cgst; s.sgst += l.sgst; s.igst += l.igst;
    hsnSummary.set(key, s);
  });

  const money = (obj, keys) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, keys.includes(k) ? toRupees(v) : v]));
  const lineMoney = ['unitPrice', 'gross', 'discount', 'net', 'taxable', 'cgst', 'sgst', 'igst'];
  const buyerGstin = order.buyerGstin && !gstinError(order.buyerGstin) ? normalizeGstin(order.buyerGstin) : null;

  return {
    version: 1,
    pricesInclusiveOfTax: true,
    reverseCharge: false,
    seller,
    buyer: {
      name: addr.name,
      businessName: buyerGstin ? (order.buyerBusinessName || null) : null,
      gstin: buyerGstin,
      address: addr.address,
      pincode: addr.pincode,
      phone: addr.phone || null,
      state: pos.name,
      stateCode: pos.code
    },
    placeOfSupply: { state: pos.name, stateCode: pos.code, source: addr.stateSource || null },
    interState,
    order: {
      id: String(order._id),
      shortId: String(order._id).slice(-6).toUpperCase(),
      date: order.createdAt || null,
      paymentMethod: order.paymentMethod,
      couponCode: order.couponCode || null
    },
    rateRule: rule ? { effectiveFrom: rule.effectiveFrom, threshold: rule.threshold, rateUpToThreshold: rule.rateUpToThreshold, rateAboveThreshold: rule.rateAboveThreshold } : null,
    lines: lines.map(l => money(l, lineMoney)),
    hsnSummary: [...hsnSummary.values()].map(s => money(s, ['taxable', 'cgst', 'sgst', 'igst'])),
    totals: {
      gross: toRupees(sum('gross')),
      discount: toRupees(sum('discount')),
      taxable: toRupees(sum('taxable')),
      cgst: toRupees(sum('cgst')),
      sgst: toRupees(sum('sgst')),
      igst: toRupees(sum('igst')),
      totalTax: toRupees(sum('cgst') + sum('sgst') + sum('igst')),
      grandTotal: toRupees(grandTotal),
      amountInWords: amountInWords(grandTotal)
    },
    payment: {
      walletCoins: toRupees(toPaise(order.walletUsed)),
      refundWallet: toRupees(toPaise(order.refundWalletUsed)),
      balance: toRupees(toPaise(order.total)),
      balanceMode: order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'
    }
  };
};

// ---------- amount in words (Indian numbering) ----------
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const threeDigits = (n) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
};
const integerWords = (n) => {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${integerWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
};
function amountInWords(paise) {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${integerWords(rupees)}${p ? ` and ${twoDigits(p)} Paise` : ''} Only`;
}

// ---------- issuance ----------
let counterCollectionReady = null;
const ensureCounterCollection = () => {
  // A collection's first write inside a transaction can conflict on some server versions.
  counterCollectionReady = counterCollectionReady || Counter.createCollection().catch(() => {});
  return counterCollectionReady;
};

/**
 * Issues the order's tax invoice exactly once. Idempotent: an order that already has an invoice
 * returns it unchanged. Returns { order, created }.
 */
const issueInvoice = async (orderId, { allowProcessing = false, now = new Date() } = {}) => {
  const config = await SystemConfig.findOne({}).lean();
  const problems = sellerDetailsProblems(config || {});
  if (problems.length) {
    throw invoiceError('SELLER_DETAILS_INCOMPLETE', `Business & Tax settings are incomplete: ${problems.join('; ')}.`, 409);
  }
  await ensureCounterCollection();

  for (let attempt = 1; ; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const order = await Order.findById(orderId).session(session);
      if (!order) throw invoiceError('ORDER_NOT_FOUND', 'Order not found', 404);
      if (order.invoice && order.invoice.number) {
        await session.abortTransaction();
        return { order, created: false };
      }
      if (!order.taxDataCapturedAt) {
        throw invoiceError('HISTORICAL_ORDER', 'This order was placed before GST invoicing and needs a separate historical review.', 409);
      }
      if (!isIssuableStatus(order.status, { allowProcessing })) {
        throw invoiceError('NOT_DISPATCHED', `An invoice is issued at dispatch; this order is '${order.status}'.`, 409);
      }

      const data = computeInvoiceData(order, config, now);
      const fy = financialYear(now);
      const prefix = invoicePrefix(config);
      const counter = await Counter.findOneAndUpdate(
        { _id: `invoice:${prefix}:${fy}` },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, session }
      );
      const number = `${prefix}/${fy}/${String(counter.seq).padStart(6, '0')}`;
      const result = await Order.updateOne(
        { _id: order._id, 'invoice.number': { $exists: false } },
        { $set: { invoice: { number, sequence: counter.seq, financialYear: fy, date: now, data } } },
        { session }
      );
      if (result.modifiedCount !== 1) throw invoiceError('INVOICE_RACE', 'Invoice was issued concurrently', 409);
      await session.commitTransaction();
      return { order: await Order.findById(order._id), created: true };
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction().catch(() => {});
      const retryable = isTransientTransactionError(err) || err.code === 'INVOICE_RACE' || err.code === 112;
      if (retryable && attempt < 8) {
        await sleep(20 * attempt + Math.floor(Math.random() * 30));
        continue;
      }
      throw err;
    } finally {
      session.endSession();
    }
  }
};

/** Status hooks (dispatch / delivery): issue if due, never break the caller's flow. */
const issueInvoiceSafely = async (orderId, opts) => {
  try {
    return await issueInvoice(orderId, opts);
  } catch (err) {
    if (!['HISTORICAL_ORDER', 'NOT_DISPATCHED'].includes(err.code)) {
      console.error(`GST invoice not issued for order ${orderId}: ${err.message}`);
    }
    return null;
  }
};

// ---------- checkout capture ----------
/** Optional B2B details from checkout: { buyerGstin, buyerBusinessName } or { error }. */
const checkoutBillingDetails = ({ buyerGstin, buyerBusinessName } = {}) => {
  const gstin = normalizeGstin(buyerGstin);
  if (!gstin) return { buyerGstin: null, buyerBusinessName: null };
  const err = gstinError(gstin);
  if (err) return { error: `Invalid GSTIN: ${err}.` };
  const name = String(buyerBusinessName || '').trim().slice(0, 150);
  return { buyerGstin: gstin, buyerBusinessName: name || null };
};

/** Snapshots a product's tax classification onto an order line at checkout. */
const applyItemTaxSnapshot = (item, product, config) => {
  const hsn = String((product && product.hsnCode) || (config && config.defaultHsnCode) || '').trim();
  item.hsnCode = hsn || null;
  const override = product && product.gstRate;
  item.gstRateOverride = override === null || override === undefined || override === '' ? null : Number(override);
  return item;
};

/** Delivery address for a new order, with its GST place-of-supply state resolved. */
const orderDeliveryAddress = (addr = {}) => ({
  name: addr.name,
  type: addr.type,
  address: addr.address,
  pincode: addr.pincode,
  phone: addr.phone || '',
  ...resolveAddressState(addr)
});

// ---------- PDF ----------
const rs = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Renders the stored invoice snapshot of an order to a PDF Buffer. */
const renderInvoicePdf = (order) => new Promise((resolve, reject) => {
  const inv = order.invoice;
  const d = inv.data;
  const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: `Tax Invoice ${inv.number}`, Author: d.seller.legalName } });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const L = 36;
  const W = doc.page.width - 72;
  const bottom = doc.page.height - 36;
  const line = (y) => doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor('#94a3b8').stroke();

  // Header
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text('TAX INVOICE', L, 36, { width: W, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Original for Recipient', L, 40, { width: W, align: 'right' });
  if (order.status === 'Cancelled') {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#dc2626').text('ORDER CANCELLED', L, 40, { width: W, align: 'left' });
  }
  line(58);

  // Seller (left) and invoice details (right)
  const s = d.seller;
  let y = 66;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(s.tradeName || s.legalName, L, y, { width: W * 0.55 });
  doc.font('Helvetica').fontSize(8).fillColor('#334155');
  const sellerLines = [
    s.tradeName && s.tradeName !== s.legalName ? `Legal name: ${s.legalName}` : null,
    s.address,
    `State: ${s.state} (Code: ${s.stateCode})`,
    `GSTIN: ${s.gstin}    PAN: ${s.pan}`,
    [s.email, s.phone].filter(Boolean).join('  |  ') || null
  ].filter(Boolean);
  doc.text(sellerLines.join('\n'), L, doc.y + 2, { width: W * 0.55, lineGap: 1 });
  const leftEnd = doc.y;

  const meta = [
    ['Invoice No.', inv.number],
    ['Invoice Date', formatDate(inv.date)],
    ['Order ID', `#${d.order.shortId}`],
    ['Order Date', d.order.date ? formatDate(d.order.date) : '-'],
    ['Place of Supply', `${d.placeOfSupply.state} (${d.placeOfSupply.stateCode})`],
    ['Reverse Charge', d.reverseCharge ? 'Yes' : 'No'],
    ['Payment', d.order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Prepaid']
  ];
  let my = 66;
  const mx = L + W * 0.58;
  meta.forEach(([k, v]) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text(k, mx, my, { width: 70 });
    doc.font('Helvetica').fillColor('#0f172a').text(v, mx + 72, my, { width: W * 0.42 - 72 });
    my = Math.max(doc.y, my + 11);
  });
  y = Math.max(leftEnd, my) + 8;
  line(y);

  // Buyer
  const b = d.buyer;
  y += 6;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('Bill To / Ship To (Buyer Details)', L, y);
  doc.font('Helvetica').fontSize(8).fillColor('#334155');
  const buyerLines = [
    b.businessName ? `${b.businessName} (Attn: ${b.name})` : b.name,
    b.gstin ? `GSTIN: ${b.gstin}` : null,
    `${b.address}${b.pincode ? ` - ${b.pincode}` : ''}`,
    `State: ${b.state} (Code: ${b.stateCode})`,
    b.phone ? `Phone: ${b.phone}` : null
  ].filter(Boolean);
  doc.text(buyerLines.join('\n'), L, doc.y + 2, { width: W, lineGap: 1 });
  y = doc.y + 8;
  line(y);

  // Line items
  const taxCols = d.interState ? [['IGST', 90, 'igst']] : [['CGST', 45, 'cgst'], ['SGST', 45, 'sgst']];
  const cols = [
    ['#', 18, null, 'left'], ['Description', 112, null, 'left'], ['HSN', 44, null, 'left'], ['Qty', 26, null, 'right'],
    ['Gross', 52, 'gross', 'right'], ['Discount', 44, 'discount', 'right'], ['Taxable', 56, 'taxable', 'right'],
    ['GST %', 30, null, 'right'],
    ...taxCols.map(([h, w, k]) => [h, w, k, 'right']),
    ['Total', 51, 'net', 'right']
  ];
  const header = (yy) => {
    doc.rect(L, yy, W, 16).fill('#f1f5f9');
    let x = L;
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
    cols.forEach(([h, w, , align]) => { doc.text(h, x + 2, yy + 5, { width: w - 4, align }); x += w; });
    return yy + 18;
  };
  y = header(y + 4);
  d.lines.forEach((l, i) => {
    const desc = l.sku ? `${l.description}\nSKU: ${l.sku}` : l.description;
    doc.font('Helvetica').fontSize(7);
    const h = Math.max(doc.heightOfString(desc, { width: 108 }), 9) + 5;
    if (y + h > bottom - 40) { doc.addPage(); y = header(36); }
    const values = {
      '#': String(i + 1), Description: desc, HSN: l.hsn || '-', Qty: String(l.quantity), 'GST %': `${l.rate}%`
    };
    let x = L;
    doc.fillColor('#1e293b');
    cols.forEach(([hd, w, key, align]) => {
      const text = key ? rs(l[key]) : values[hd];
      doc.text(text, x + 2, y + 2, { width: w - 4, align });
      x += w;
    });
    y += h;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.3).strokeColor('#e2e8f0').stroke();
  });

  // Totals
  if (y + 150 > bottom) { doc.addPage(); y = 36; }
  y += 8;
  const t = d.totals;
  const totalRows = [
    ['Total value (incl. GST)', t.gross],
    ['Less: Discounts', t.discount],
    ['Taxable value', t.taxable],
    ...(d.interState ? [['IGST', t.igst]] : [['CGST', t.cgst], ['SGST', t.sgst]]),
    ['Total tax', t.totalTax]
  ];
  const tx = L + W - 220;
  totalRows.forEach(([k, v]) => {
    doc.font('Helvetica').fontSize(8).fillColor('#334155').text(k, tx, y, { width: 130 });
    doc.text(`Rs. ${rs(v)}`, tx + 130, y, { width: 90, align: 'right' });
    y += 12;
  });
  doc.rect(tx, y, 220, 18).fill('#0f172a');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text('Invoice Total', tx + 6, y + 5, { width: 120 });
  doc.text(`Rs. ${rs(t.grandTotal)}`, tx + 120, y + 5, { width: 94, align: 'right' });
  y += 24;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(`Amount in words: ${t.amountInWords}`, L, y, { width: W });
  y = doc.y + 10;

  // HSN summary
  if (y + 60 > bottom) { doc.addPage(); y = 36; }
  doc.font('Helvetica-Bold').fontSize(8).text('Tax Summary (HSN-wise)', L, y);
  y = doc.y + 3;
  const hsCols = [['HSN', 80, 'hsn'], ['GST %', 50, 'rate'], ['Taxable', 90, 'taxable'],
    ...(d.interState ? [['IGST', 90, 'igst']] : [['CGST', 90, 'cgst'], ['SGST', 90, 'sgst']])];
  let x = L;
  doc.rect(L, y, hsCols.reduce((a, c) => a + c[1], 0), 14).fill('#f1f5f9');
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
  hsCols.forEach(([h, w]) => { doc.text(h, x + 2, y + 4, { width: w - 4, align: h === 'HSN' ? 'left' : 'right' }); x += w; });
  y += 16;
  doc.font('Helvetica').fontSize(7).fillColor('#1e293b');
  d.hsnSummary.forEach(r => {
    x = L;
    hsCols.forEach(([h, w, k]) => {
      const v = k === 'hsn' ? (r.hsn || '-') : k === 'rate' ? `${r.rate}%` : rs(r[k]);
      doc.text(v, x + 2, y, { width: w - 4, align: h === 'HSN' ? 'left' : 'right' });
      x += w;
    });
    y += 11;
  });
  y += 6;

  // Payment + declarations
  const p = d.payment;
  const payParts = [
    p.walletCoins > 0 ? `Wallet coins: Rs. ${rs(p.walletCoins)}` : null,
    p.refundWallet > 0 ? `Refund wallet: Rs. ${rs(p.refundWallet)}` : null,
    `${p.balanceMode}: Rs. ${rs(p.balance)}`
  ].filter(Boolean);
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155')
    .text(`Payment received: ${payParts.join('  |  ')}`, L, y, { width: W });
  doc.moveDown(0.4);
  doc.text('Prices are inclusive of GST; the tax shown above is included in the invoice total.', { width: W });
  doc.text('Whether tax is payable under reverse charge: No.', { width: W });
  if (d.placeOfSupply.source === 'pincode') doc.text('Place of supply determined from the delivery pincode.', { width: W });
  y = doc.y + 16;
  if (y + 40 > bottom) { doc.addPage(); y = 36; }
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(`For ${s.legalName}`, L + W - 220, y, { width: 220, align: 'right' });
  doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text('Authorised Signatory', L + W - 220, y + 26, { width: 220, align: 'right' });
  doc.fontSize(6.5).fillColor('#94a3b8').text('This is a computer-generated invoice and does not require a physical signature.', L, bottom - 10, { width: W, align: 'center' });

  doc.end();
});

module.exports = {
  DEFAULT_GST_RATE_RULES,
  isIssuableStatus,
  isDeliveredForInvoice,
  sellerDetailsProblems,
  computeInvoiceData,
  issueInvoice,
  issueInvoiceSafely,
  renderInvoicePdf,
  financialYear,
  rateRuleFor,
  footwearRate,
  amountInWords,
  allocate,
  checkoutBillingDetails,
  applyItemTaxSnapshot,
  orderDeliveryAddress
};
