/**
 * Finance service — the ONE place admin earnings are calculated.
 *
 * Everything is computed per order first and then summed, so every total on the admin
 * Earnings page traces back to the same order rows (no separately-queried figures that can
 * drift apart). Rules:
 *
 *  - Customer bill = product sales − coupon + GST (legacy orders only) + platform fee
 *    + delivery charge + Admin COD charge − Admin prepaid discount.
 *  - The bill is paid by cash (online / COD), wallet coins and Refund Wallet money.
 *    Coins are platform-funded, so coins redeemed are an expense. Refund Wallet money is the
 *    customer's own (previously refunded) money, so it counts like cash.
 *  - Shiprocket charges us its freight and, on COD shipments with cash to collect, its own
 *    COD fee. Both are expenses; neither is part of the customer's bill.
 *  - Legacy GST collected is a tax liability, not earnings.
 *  - Cancelled orders earn nothing; a cancelled order that was already shipped (has an AWB)
 *    still cost us its forward freight (RTO).
 *  - Refunds: processed returns (ReturnRequest 'Refunded'), or the whole money paid for an
 *    order marked 'Refunded' without a return record, plus exchange refunds. Exchange price
 *    differences collected from customers are extra income.
 *  - Product cost uses the cost price snapshotted on the order (current product cost price for
 *    older orders); returned/refunded units are taken back out of product cost.
 *  - Older orders saved without a fee breakdown (no subtotal) count what the customer actually
 *    paid; the part their items don't explain is shown as "unitemized charges".
 *  - Legacy records with a non-ObjectId id that exactly duplicate another order (same customer,
 *    total and timestamp) are skipped so the sale is not counted twice.
 */
const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const User = require('../Models/User');
const ReturnRequest = require('../Models/ReturnRequest');
const ExchangeRequest = require('../Models/ExchangeRequest');
const WalletTransaction = require('../Models/WalletTransaction');
const { roundMoney, getTransactionDirection } = require('./walletService');

const EPSILON = 0.01;
const COD_COLLECTED_STATUSES = ['Paid', 'Refunded', 'Partially Refunded'];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sumBy = (list, fn) => list.reduce((acc, x) => acc + fn(x), 0);
const signedAmount = (txn) => (getTransactionDirection(txn) === 'debit' ? -Math.abs(num(txn.amount)) : Math.abs(num(txn.amount)));
const isRefundWalletEntry = (txn) => txn.wallet === 'REFUND' || String(txn.type).startsWith('REFUND_WALLET');

/** Start date for the admin range filter ('today' | 'week' | 'month' | 'all'). */
const rangeStart = (range, now = new Date()) => {
  if (!range || range === 'all') return null;
  const start = new Date(now);
  if (range === 'week') start.setDate(start.getDate() - 7);
  else if (range === 'month') start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return start;
};

/**
 * Shiprocket costs for orders placed before they were recorded on the order: re-derived from
 * the checkout serviceability quote stored on the order (the old pricing rule picked the
 * cheapest freight + COD fee on COD), else estimated as the delivery charge billed.
 */
const deriveLegacyShippingCosts = async (orders) => {
  const legacy = orders.filter(o => o.shippingCost === null || o.shippingCost === undefined);
  const result = new Map();
  if (legacy.length === 0) return result;

  const quotes = await Order.aggregate([
    { $match: { _id: { $in: legacy.map(o => o._id) } } }, // raw ids: aggregate does not cast
    {
      $project: {
        quote: {
          $arrayElemAt: [{ $filter: { input: { $ifNull: ['$shiprocketResponses', []] }, cond: { $eq: ['$$this.type', 'SERVICEABILITY'] } } }, 0]
        }
      }
    }
  ]);
  const quoteById = new Map(quotes.map(q => [String(q._id), q.quote]));

  for (const o of legacy) {
    const isCodShipment = o.paymentMethod === 'COD' && num(o.total) > 0;
    const couriers = quoteById.get(String(o._id))?.data?.data?.available_courier_companies;
    let best = null;
    for (const c of Array.isArray(couriers) ? couriers : []) {
      const charge = num(c.freight_charge) + (o.paymentMethod === 'COD' ? num(c.cod_charges) : 0);
      if (!best || charge < best.charge) best = { courier: c, charge };
    }
    if (best) {
      result.set(String(o._id), {
        shippingCost: num(best.courier.freight_charge),
        shiprocketCodFee: isCodShipment ? num(best.courier.cod_charges) : 0,
        costSource: 'derived'
      });
    } else {
      result.set(String(o._id), { shippingCost: num(o.deliveryCharge), shiprocketCodFee: 0, costSource: 'estimated' });
    }
  }
  return result;
};

/** Cost price per order line: the checkout snapshot, else the product's current cost price. */
const loadCurrentCostPrices = async (orders) => {
  const missing = new Set();
  orders.forEach(o => (o.items || []).forEach(i => {
    if ((i.costPrice === null || i.costPrice === undefined) && i.productId) missing.add(String(i.productId));
  }));
  if (missing.size === 0) return new Map();
  const products = await Product.find({ _id: { $in: [...missing] } }).select('costPrice').lean();
  return new Map(products.filter(p => p.costPrice !== null && p.costPrice !== undefined).map(p => [String(p._id), num(p.costPrice)]));
};

const lineCost = (item, currentCosts) => {
  if (item.costPrice !== null && item.costPrice !== undefined) return num(item.costPrice);
  const current = currentCosts.get(String(item.productId));
  return current === undefined ? null : current;
};

const summarizeRefundWalletLedger = (entries) => {
  let credited = 0; let restored = 0; let usedOnOrders = 0; let other = 0;
  for (const e of entries) {
    const amt = Math.abs(num(e.amount));
    if (e.type === 'REFUND_WALLET_CREDIT' || e.type === 'REFUND_WALLET_PARTIAL_REFUND') credited += amt;
    else if (e.type === 'REFUND_WALLET_RESTORE') restored += amt;
    else if (e.type === 'REFUND_WALLET_DEBIT') usedOnOrders += amt;
    else other += signedAmount(e);
  }
  return {
    refundsCredited: roundMoney(credited),
    restoredFromCancelledOrders: roundMoney(restored),
    usedOnOrders: roundMoney(usedOnOrders),
    netChange: roundMoney(credited + restored + other - usedOnOrders)
  };
};

/**
 * Builds the complete admin finance breakdown for orders placed from `from` (null = all time).
 * @returns {Promise<Object>} income, payments, adjustments, expenses, results, cod, prepaid,
 *   shipping, refundWallet, checks, dataQuality, daily and a page of per-order rows.
 */
const getFinanceBreakdown = async ({ from = null, orderPage = 1, orderPageSize = 25 } = {}) => {
  const createdAt = from ? { $gte: from } : null;
  const orderMatch = createdAt ? { createdAt } : {};

  const allOrders = await Order.find(orderMatch)
    .select('userId items subtotal discountAmount gstAmount platformCommission total paymentMethod paymentStatus walletUsed referralCoinsUsed refundWalletUsed status deliveryCharge codCharge prepaidDiscount shippingCost shiprocketCodFee awbCode createdAt couponCode')
    .sort({ createdAt: -1 })
    .lean();
  const isObjectIdOrder = (o) => mongoose.isValidObjectId(o._id) && String(o._id).length === 24;
  const twinKey = (o) => `${o.userId}|${num(o.total)}|${new Date(o.createdAt).getTime()}`;
  const realOrderKeys = new Set(allOrders.filter(isObjectIdOrder).map(twinKey));
  const orders = allOrders.filter(o => isObjectIdOrder(o) || !realOrderKeys.has(twinKey(o)));
  const duplicateRecordsSkipped = allOrders.length - orders.length;
  // Some legacy orders carry non-ObjectId ids; only real ObjectIds can be referenced elsewhere.
  const orderIds = orders.map(o => o._id).filter(id => mongoose.isValidObjectId(id) && String(id).length === 24);

  const [legacyCosts, currentCosts, returns, exchanges, ledgerInRange, orderLedger, userBalances, ledgerAllTime] = await Promise.all([
    deriveLegacyShippingCosts(orders),
    loadCurrentCostPrices(orders),
    ReturnRequest.find({ orderId: { $in: orderIds }, status: 'Refunded' }).select('orderId refundAmount items').lean(),
    ExchangeRequest.find({ orderId: { $in: orderIds }, paymentStatus: { $in: ['Collected', 'Refunded'] } }).select('orderId paymentStatus additionalAmount refundAmount').lean(),
    WalletTransaction.find(createdAt ? { createdAt } : {}).select('type wallet amount').lean(),
    WalletTransaction.find({ orderId: { $in: orderIds }, type: { $in: ['ORDER_REDEMPTION', 'REFUND_WALLET_DEBIT'] } }).select('type amount').lean(),
    User.aggregate([{ $group: { _id: null, refundWallet: { $sum: { $ifNull: ['$refundWalletBalance', 0] } } } }]),
    WalletTransaction.find({ $or: [{ wallet: 'REFUND' }, { type: /^REFUND_WALLET/ }] }).select('type wallet amount').lean()
  ]);

  const returnsByOrder = new Map();
  returns.forEach(r => {
    const key = String(r.orderId);
    if (!returnsByOrder.has(key)) returnsByOrder.set(key, []);
    returnsByOrder.get(key).push(r);
  });
  const exchangesByOrder = new Map();
  exchanges.forEach(x => {
    const key = String(x.orderId);
    if (!exchangesByOrder.has(key)) exchangesByOrder.set(key, []);
    exchangesByOrder.get(key).push(x);
  });

  const rows = orders.map(o => {
    const id = String(o._id);
    const cancelled = o.status === 'Cancelled';
    const items = o.items || [];
    const productSales = sumBy(items, i => num(i.price) * num(i.quantity));
    const coupon = num(o.discountAmount);
    const gst = num(o.gstAmount);
    const platformFee = num(o.platformCommission);
    const delivery = num(o.deliveryCharge);
    const codCharge = num(o.codCharge);
    const prepaidDiscount = num(o.prepaidDiscount);
    const itemizedBill = Math.max(0, productSales - coupon + gst + platformFee + delivery + codCharge - prepaidDiscount);

    const cash = num(o.total);
    // Coins: the single wallet, plus the separate referral-coin wallet some older orders used
    const coins = num(o.walletUsed) + num(o.referralCoinsUsed);
    const refundWallet = num(o.refundWalletUsed);
    const paid = cash + coins + refundWallet;
    // Orders saved before the fee breakdown existed: the bill is what was actually charged
    const hasBreakdown = num(o.subtotal) > 0;
    const unitemized = hasBreakdown ? 0 : paid - itemizedBill;
    const bill = itemizedBill + unitemized;
    const paymentGap = bill - paid;
    const codCollected = o.paymentMethod === 'COD' && COD_COLLECTED_STATUSES.includes(o.paymentStatus);

    const costs = (o.shippingCost === null || o.shippingCost === undefined)
      ? legacyCosts.get(id)
      : { shippingCost: num(o.shippingCost), shiprocketCodFee: num(o.shiprocketCodFee), costSource: 'recorded' };

    // Product cost (net of units returned/refunded)
    let cogs = 0; let linesWithoutCost = 0;
    const costByProduct = new Map();
    items.forEach(i => {
      const unit = lineCost(i, currentCosts);
      if (unit === null) { linesWithoutCost += 1; return; }
      cogs += unit * num(i.quantity);
      costByProduct.set(String(i.productId), unit);
    });

    const orderReturns = returnsByOrder.get(id) || [];
    const orderExchanges = exchangesByOrder.get(id) || [];
    let returnRefunds = sumBy(orderReturns, r => num(r.refundAmount));
    let fullOrderRefund = 0;
    let cogsReturned = sumBy(orderReturns, r => sumBy(r.items || [], ri => (costByProduct.get(String(ri.productId)) || 0) * num(ri.quantity)));
    if (!cancelled && o.status === 'Refunded' && orderReturns.length === 0) {
      // Whole order refunded without a return record: the money paid goes back
      fullOrderRefund = (o.paymentMethod === 'Online' || codCollected ? cash : 0) + refundWallet;
      cogsReturned = cogs;
    }
    const exchangeExtra = sumBy(orderExchanges.filter(x => x.paymentStatus === 'Collected'), x => num(x.additionalAmount));
    const exchangeRefunds = sumBy(orderExchanges.filter(x => x.paymentStatus === 'Refunded'), x => num(x.refundAmount));

    const row = {
      id,
      orderNo: id.length === 24 ? `OD${id.substring(18).toUpperCase()}` : id,
      createdAt: o.createdAt,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      cancelled,
      productSales, coupon, gst, platformFee, delivery, codCharge, prepaidDiscount, unitemized, hasBreakdown, bill,
      walletCoinsOnly: num(o.walletUsed),
      cash, coins, refundWallet, paymentGap,
      cashCollected: o.paymentMethod === 'Online' ? cash : (codCollected ? cash : 0),
      cashPending: o.paymentMethod === 'COD' && !codCollected && !cancelled ? cash : 0,
      shiprocketFreight: 0, shiprocketCodFee: 0, rtoFreight: 0,
      costSource: costs.costSource,
      returnRefunds: 0, fullOrderRefund: 0, exchangeExtra: 0, exchangeRefunds: 0,
      coinsExpense: 0, productCost: 0, linesWithoutCost,
      netSales: 0, earningsBeforeProductCost: 0, netProfit: 0
    };

    if (cancelled) {
      // No sale. If it had already shipped, the forward freight was still spent (RTO).
      row.rtoFreight = o.awbCode ? costs.shippingCost : 0;
      row.earningsBeforeProductCost = -row.rtoFreight;
      row.netProfit = row.earningsBeforeProductCost;
      return row;
    }

    row.shiprocketFreight = costs.shippingCost;
    row.shiprocketCodFee = costs.shiprocketCodFee;
    row.returnRefunds = returnRefunds;
    row.fullOrderRefund = fullOrderRefund;
    row.exchangeExtra = exchangeExtra;
    row.exchangeRefunds = exchangeRefunds;
    row.coinsExpense = coins;
    row.productCost = Math.max(0, cogs - cogsReturned);
    row.netSales = bill - gst - returnRefunds - fullOrderRefund - exchangeRefunds + exchangeExtra;
    row.earningsBeforeProductCost = row.netSales - coins - row.shiprocketFreight - row.shiprocketCodFee;
    row.netProfit = row.earningsBeforeProductCost - row.productCost;
    return row;
  });

  const active = rows.filter(r => !r.cancelled);
  const cancelledRows = rows.filter(r => r.cancelled);
  const S = (list, key) => roundMoney(sumBy(list, r => r[key]));

  const income = {
    productSales: S(active, 'productSales'),
    couponDiscount: S(active, 'coupon'),
    prepaidDiscount: S(active, 'prepaidDiscount'),
    platformFee: S(active, 'platformFee'),
    deliveryCharges: S(active, 'delivery'),
    codCharges: S(active, 'codCharge'),
    gstCollected: S(active, 'gst'),
    unitemizedCharges: S(active, 'unitemized'),
    billTotal: S(active, 'bill')
  };

  const payments = {
    onlinePayments: roundMoney(sumBy(active.filter(r => r.paymentMethod === 'Online'), r => r.cash)),
    codCollected: roundMoney(sumBy(active.filter(r => r.paymentMethod === 'COD'), r => r.cashCollected)),
    codPending: S(active, 'cashPending'),
    walletCoins: S(active, 'coins'),
    refundWallet: S(active, 'refundWallet'),
    total: roundMoney(sumBy(active, r => r.cash + r.coins + r.refundWallet))
  };

  const adjustments = {
    returnRefunds: S(active, 'returnRefunds'),
    fullOrderRefunds: S(active, 'fullOrderRefund'),
    exchangeRefunds: S(active, 'exchangeRefunds'),
    exchangeExtraCollected: S(active, 'exchangeExtra')
  };

  const expenses = {
    shiprocketFreight: S(active, 'shiprocketFreight'),
    shiprocketCodFees: S(active, 'shiprocketCodFee'),
    rtoFreight: S(cancelledRows, 'rtoFreight'),
    coinsRedeemed: S(active, 'coinsExpense'),
    productCost: S(active, 'productCost')
  };
  expenses.totalBeforeProductCost = roundMoney(expenses.shiprocketFreight + expenses.shiprocketCodFees + expenses.rtoFreight + expenses.coinsRedeemed);

  const results = {
    netSales: S(active, 'netSales'),
    earningsBeforeProductCost: S(rows, 'earningsBeforeProductCost'),
    netProfit: S(rows, 'netProfit')
  };

  const codRows = active.filter(r => r.paymentMethod === 'COD');
  const cod = {
    orders: codRows.length,
    codChargesBilled: S(codRows, 'codCharge'),
    shiprocketCodFees: S(codRows, 'shiprocketCodFee'),
    margin: roundMoney(sumBy(codRows, r => r.codCharge - r.shiprocketCodFee)),
    cashCollected: S(codRows, 'cashCollected'),
    cashPending: S(codRows, 'cashPending')
  };
  const prepaidRows = active.filter(r => r.paymentMethod === 'Online');
  const prepaid = {
    orders: prepaidRows.length,
    prepaidDiscountGiven: S(prepaidRows, 'prepaidDiscount'),
    collected: S(prepaidRows, 'cash')
  };
  const shipping = {
    deliveryCharged: income.deliveryCharges,
    shiprocketFreight: expenses.shiprocketFreight,
    rtoFreight: expenses.rtoFreight,
    margin: roundMoney(income.deliveryCharges - expenses.shiprocketFreight - expenses.rtoFreight)
  };

  // Wallet ledgers
  // Coin issuance/usage is reported on the Coins & Rewards page (utils/coinsService.js);
  // here coins only appear as the redemption expense and the Refund Wallet money we hold.
  const refundEntriesInRange = ledgerInRange.filter(isRefundWalletEntry);
  const balances = userBalances[0] || { refundWallet: 0 };
  const refundWallet = {
    ...summarizeRefundWalletLedger(refundEntriesInRange),
    outstandingBalance: roundMoney(balances.refundWallet)
  };

  // Reconciliation checks — any mismatch is shown to the admin
  const refundLedgerBalance = roundMoney(sumBy(ledgerAllTime.filter(isRefundWalletEntry), signedAmount));
  const ordersWithGap = rows.filter(r => Math.abs(r.paymentGap) > EPSILON);
  const coinsOnOrders = roundMoney(sumBy(rows, r => r.walletCoinsOnly));
  const coinsInLedger = roundMoney(sumBy(orderLedger.filter(e => e.type === 'ORDER_REDEMPTION'), e => Math.abs(num(e.amount))));
  const refundWalletOnOrders = roundMoney(sumBy(rows, r => r.refundWallet));
  const refundWalletInLedger = roundMoney(sumBy(orderLedger.filter(e => e.type === 'REFUND_WALLET_DEBIT'), e => Math.abs(num(e.amount))));
  const check = (key, label, expected, actual, detail) => ({
    key, label, expected, actual, difference: roundMoney(actual - expected), ok: Math.abs(actual - expected) <= EPSILON, detail
  });
  const checks = [
    check('billPaid', 'Every order bill is fully paid by cash + coins + Refund Wallet', 0, roundMoney(sumBy(ordersWithGap, r => r.paymentGap)),
      ordersWithGap.length ? `${ordersWithGap.length} order(s) differ: ${ordersWithGap.slice(0, 5).map(r => r.orderNo).join(', ')}` : 'All orders reconcile'),
    check('coinsOnOrders', 'Coins used on orders match the coin ledger', coinsOnOrders, coinsInLedger, 'Order.walletUsed vs ORDER_REDEMPTION entries'),
    check('refundWalletOnOrders', 'Refund Wallet used on orders matches its ledger', refundWalletOnOrders, refundWalletInLedger, 'Order.refundWalletUsed vs REFUND_WALLET_DEBIT entries'),
    check('refundWalletBalances', 'Customer Refund Wallet balances match its ledger (all time)', refundLedgerBalance, roundMoney(balances.refundWallet), 'Sum of balances vs sum of ledger entries'),
    check('paymentsTotal', 'Bill total equals payments received', income.billTotal, payments.total, 'Customer bills vs cash + coins + Refund Wallet'),
    check('earnings', 'Earnings = net sales − expenses', roundMoney(results.netSales - expenses.totalBeforeProductCost), results.earningsBeforeProductCost, 'Summary vs order-by-order total')
  ];

  const dataQuality = {
    ordersWithRecordedShippingCost: rows.filter(r => r.costSource === 'recorded').length,
    ordersWithDerivedShippingCost: rows.filter(r => r.costSource === 'derived').length,
    ordersWithEstimatedShippingCost: rows.filter(r => r.costSource === 'estimated').length,
    itemLinesWithoutCostPrice: sumBy(active, r => r.linesWithoutCost),
    ordersWithoutFeeBreakdown: active.filter(r => !r.hasBreakdown).length,
    duplicateRecordsSkipped
  };

  // Daily totals for the trend chart
  const dailyMap = new Map();
  rows.forEach(r => {
    const day = new Date(r.createdAt).toISOString().split('T')[0];
    const d = dailyMap.get(day) || { date: day, bill: 0, earnings: 0, orders: 0 };
    if (!r.cancelled) { d.bill += r.bill; d.orders += 1; }
    d.earnings += r.earningsBeforeProductCost;
    dailyMap.set(day, d);
  });
  const daily = [...dailyMap.values()]
    .map(d => ({ ...d, bill: roundMoney(d.bill), earnings: roundMoney(d.earnings) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pageSize = Math.min(100, Math.max(1, parseInt(orderPageSize, 10) || 25));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, parseInt(orderPage, 10) || 1));
  const orderRows = rows.slice((page - 1) * pageSize, page * pageSize).map(r => {
    const out = { ...r };
    ['productSales', 'coupon', 'gst', 'platformFee', 'delivery', 'codCharge', 'prepaidDiscount', 'unitemized', 'bill', 'cash', 'coins', 'walletCoinsOnly', 'refundWallet',
      'paymentGap', 'cashCollected', 'cashPending', 'shiprocketFreight', 'shiprocketCodFee', 'rtoFreight', 'returnRefunds', 'fullOrderRefund',
      'exchangeExtra', 'exchangeRefunds', 'coinsExpense', 'productCost', 'netSales', 'earningsBeforeProductCost', 'netProfit']
      .forEach(k => { out[k] = roundMoney(out[k]); });
    return out;
  });

  return {
    from,
    counts: { orders: rows.length, activeOrders: active.length, cancelledOrders: cancelledRows.length, codOrders: cod.orders, prepaidOrders: prepaid.orders },
    income, payments, adjustments, expenses, results, cod, prepaid, shipping, refundWallet,
    checks, dataQuality, daily, orders: orderRows,
    orderPagination: { page, pageSize, total: rows.length, pages }
  };
};

module.exports = { getFinanceBreakdown, rangeStart };
