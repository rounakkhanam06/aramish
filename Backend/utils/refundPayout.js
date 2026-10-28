/**
 * Admin payout of Refund/Cash Wallet money to a customer's bank/UPI.
 *
 * Refunds to customers always land in the Refund/Cash Wallet — the full money paid (on a
 * cancellation also the platform fee, delivery and COD charge). When a customer asks support for
 * that money in their bank/UPI instead, an admin pays it out here. A bank/UPI refund only covers
 * the product money (the same rule a Bank/UPI return refund uses — utils/refundCalc.js), so:
 *
 *   wallet deducted  = what the admin takes out of the wallet for this order
 *   amount to pay    = the bank/UPI-refundable share of it (computed here, never typed by hand)
 *   charges kept     = the difference (platform fee, delivery, COD charge, GST)
 *
 * Per order: every Refund/Cash Wallet credit for the order is grouped by what it refunded (the
 * whole order on a cancellation, a return's items, an exchange price difference) and each group's
 * bank/UPI share is worked out with calculateEligibleRefund. Payouts are recorded on
 * Order.refundPayouts together with a REFUND_WALLET_PAYOUT ledger debit, atomically, and the
 * total deducted can never exceed what was credited for the order.
 */
const Order = require('../Models/Order');
const ReturnRequest = require('../Models/ReturnRequest');
const WalletTransaction = require('../Models/WalletTransaction');
const { runWalletTransaction, getRefundWalletBalance, debitRefundWalletForPayout, toPaise, fromPaise, roundMoney } = require('./walletService');
const { calculateEligibleRefund, orderCharges, splitProportionally } = require('./refundCalc');

const CREDIT_TYPES = ['REFUND_WALLET_CREDIT', 'REFUND_WALLET_RESTORE', 'REFUND_WALLET_PARTIAL_REFUND'];
const RETURN_KEY = /^RETURN_REFUND(?:_WALLET_RESTORE)?:([0-9a-f]{24})$/;
const EPSILON = 0.005;

const orderLabel = (id) => String(id).slice(-6).toUpperCase();
const sumBy = (list, fn) => list.reduce((acc, x) => acc + fn(x), 0);

/** Groups the order's Refund/Cash Wallet credits by what they refunded. */
const groupCredits = (order, credits, returnsById) => {
  const groups = new Map();
  const add = (key, init, amount) => {
    if (!groups.has(key)) groups.set(key, { ...init, credited: 0 });
    groups.get(key).credited += amount;
  };
  for (const c of credits) {
    const amount = Math.abs(Number(c.amount) || 0);
    const key = c.idempotencyKey || '';
    const returnMatch = key.match(RETURN_KEY);
    if (returnMatch && returnsById.has(returnMatch[1])) {
      const ret = returnsById.get(returnMatch[1]);
      add(`return:${returnMatch[1]}`, { kind: 'return', label: `Return #${orderLabel(ret._id)}`, items: ret.items }, amount);
    } else if (key.startsWith('EXCHANGE_DIFFERENCE_REFUND:')) {
      add('exchange', { kind: 'exchange', label: 'Exchange price difference', items: [] }, amount);
    } else {
      add('order', { kind: 'order', label: 'Cancelled / refunded order', items: order.items }, amount);
    }
  }
  return [...groups.values()];
};

/** Bank/UPI-refundable share of one group's wallet credit. */
const bankableFor = (order, group) => {
  const credited = roundMoney(group.credited);
  if (group.kind === 'exchange') return credited; // a price difference has no charges in it
  const walletEligible = calculateEligibleRefund(order, group.items, 'Wallet');
  const bankEligible = calculateEligibleRefund(order, group.items, 'Bank');
  if (walletEligible <= 0) return 0;
  // Full credit -> the full bank amount; a reduced credit (e.g. damaged return) -> its share.
  return roundMoney(Math.min(credited, bankEligible, (credited * bankEligible) / walletEligible));
};

/**
 * Everything the admin needs to pay out this order's Refund/Cash Wallet money: what was credited,
 * the bank/UPI-refundable part (per product), the charges deducted, past payouts and the most
 * that can be taken out of the wallet now. Pass `walletAmount` to also get the payout for it.
 */
const getRefundPayoutSummary = async (orderId, { walletAmount } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) return null;

  const [credits, returns, walletBalance] = await Promise.all([
    WalletTransaction.find({ orderId: order._id, wallet: 'REFUND', type: { $in: CREDIT_TYPES } }).lean(),
    ReturnRequest.find({ orderId: order._id }).lean(),
    getRefundWalletBalance(order.userId)
  ]);
  const returnsById = new Map(returns.map(r => [String(r._id), r]));

  const groups = groupCredits(order, credits, returnsById).map(group => {
    const credited = roundMoney(group.credited);
    const bankable = bankableFor(order, group);
    const shares = group.items.length > 0 ? splitProportionally(bankable, group.items, i => toPaise(i.price) * (i.quantity || 0)) : [];
    return {
      kind: group.kind,
      label: group.label,
      credited,
      bankable,
      deducted: roundMoney(credited - bankable),
      items: group.items.map((item, idx) => ({
        name: item.name,
        quantity: item.quantity,
        value: roundMoney((Number(item.price) || 0) * (item.quantity || 0)),
        bankShare: shares[idx]
      }))
    };
  });

  const creditedTotal = roundMoney(sumBy(groups, g => g.credited));
  const bankableTotal = roundMoney(sumBy(groups, g => g.bankable));
  const payouts = (order.refundPayouts || []).map(p => p.toObject ? p.toObject() : p);
  const paidOutWallet = roundMoney(sumBy(payouts, p => p.walletAmount));
  const paidOutAmount = roundMoney(sumBy(payouts, p => p.amount));
  const remainingWallet = roundMoney(Math.max(0, creditedTotal - paidOutWallet));
  const remainingBank = roundMoney(Math.min(remainingWallet, Math.max(0, bankableTotal - paidOutAmount)));
  const maxWalletAmount = roundMoney(Math.min(remainingWallet, walletBalance));

  const charges = orderCharges(order);
  const summary = {
    orderId: String(order._id),
    userId: String(order.userId),
    paymentMethod: order.paymentMethod,
    status: order.status,
    refundWalletBalance: walletBalance,
    charges,
    groups,
    creditedTotal,
    bankableTotal,
    chargesDeductedTotal: roundMoney(creditedTotal - bankableTotal),
    paidOut: { walletAmount: paidOutWallet, amount: paidOutAmount },
    remaining: { walletAmount: remainingWallet, amount: remainingBank },
    maxWalletAmount,
    payouts
  };
  if (walletAmount !== undefined) summary.quote = quotePayout(summary, walletAmount);
  return summary;
};

/** Bank/UPI amount for taking `walletAmount` out of the wallet (proportional to what's left). */
const quotePayout = (summary, walletAmount) => {
  const take = roundMoney(walletAmount);
  const { walletAmount: remWallet, amount: remBank } = summary.remaining;
  if (!(take > 0) || remWallet <= 0) return { walletAmount: take, amount: 0, deducted: take };
  const amount = Math.abs(take - remWallet) < EPSILON
    ? remBank // paying out everything left: exact, no rounding drift
    : fromPaise(Math.floor((toPaise(take) * toPaise(remBank)) / toPaise(remWallet)));
  return { walletAmount: take, amount, deducted: roundMoney(take - amount) };
};

const httpError = (message, status = 400) => Object.assign(new Error(message), { status });

/**
 * Pays out `walletAmount` of the order's Refund/Cash Wallet money to the customer's bank/UPI:
 * deducts it from the wallet and records the payout (amount to transfer computed server-side).
 * The admin transfers the money manually and enters its reference.
 */
const createRefundPayout = async ({ orderId, walletAmount, method, bankDetails = {}, reference = '', note = '', admin }) => {
  if (!['Bank', 'UPI'].includes(method)) throw httpError('Payout method must be Bank or UPI.');
  const details = method === 'UPI'
    ? { upiId: String(bankDetails.upiId || '').trim() || null }
    : {
      accountHolderName: String(bankDetails.accountHolderName || '').trim() || null,
      accountNumber: String(bankDetails.accountNumber || '').trim() || null,
      ifscCode: String(bankDetails.ifscCode || '').trim().toUpperCase() || null,
      bankName: String(bankDetails.bankName || '').trim() || null
    };
  if (method === 'UPI' && !(details.upiId && details.upiId.includes('@'))) throw httpError('Enter a valid UPI ID.');
  if (method === 'Bank' && !(details.accountHolderName && details.accountNumber && details.ifscCode)) {
    throw httpError('Enter the account holder name, account number and IFSC code.');
  }

  const summary = await getRefundPayoutSummary(orderId);
  if (!summary) throw httpError('Order not found', 404);
  const take = roundMoney(walletAmount);
  if (!(take > 0)) throw httpError('Enter the amount to deduct from the Refund/Cash Wallet.');
  if (take > summary.maxWalletAmount + EPSILON) {
    throw httpError(summary.maxWalletAmount > 0
      ? `At most ₹${summary.maxWalletAmount} can be deducted for this order (refund still in the wallet: ₹${summary.remaining.walletAmount}, customer's wallet balance: ₹${summary.refundWalletBalance}).`
      : 'Nothing left to pay out for this order: no refund for it is left in the customer\'s Refund/Cash Wallet.');
  }
  const quote = quotePayout(summary, take);

  return runWalletTransaction(async (ctx) => {
    const entry = {
      walletAmount: quote.walletAmount,
      amount: quote.amount,
      method,
      bankDetails: details,
      reference: String(reference || '').trim(),
      note: String(note || '').trim(),
      adminId: admin?._id || null,
      adminName: admin?.name || admin?.email || '',
      createdAt: new Date()
    };
    // Conditional push: concurrent payouts can never deduct more than was credited for the order.
    const updated = await Order.findOneAndUpdate(
      {
        _id: orderId,
        $expr: { $lte: [{ $add: [{ $sum: { $ifNull: ['$refundPayouts.walletAmount', []] } }, quote.walletAmount] }, summary.creditedTotal + EPSILON] }
      },
      { $push: { refundPayouts: entry } },
      { ...ctx.sessionOpt, returnDocument: 'after' }
    );
    if (!updated) throw httpError('This order\'s refund was just paid out by someone else. Refresh and check before trying again.', 409);
    const payout = updated.refundPayouts[updated.refundPayouts.length - 1];
    ctx.undo.push(() => Order.updateOne({ _id: orderId }, { $pull: { refundPayouts: { _id: payout._id } } }));

    const where = method === 'UPI' ? `UPI ${details.upiId}` : `bank account ending ${String(details.accountNumber).slice(-4)}`;
    const debit = await debitRefundWalletForPayout({
      userId: updated.userId,
      amount: quote.walletAmount,
      orderId: updated._id,
      description: quote.deducted > 0
        ? `₹${quote.amount} sent to your ${where} for Order #${orderLabel(updated._id)} (₹${quote.deducted} platform fee/delivery charges not refundable to bank)`
        : `₹${quote.amount} sent to your ${where} for Order #${orderLabel(updated._id)}`,
      idempotencyKey: `REFUND_WALLET_PAYOUT:${payout._id}`
    }, ctx);
    if (!debit) throw httpError('The customer\'s Refund/Cash Wallet balance changed. Refresh and try again.', 409);

    return { payout: payout.toObject(), quote };
  }, `refund payout ${orderId}`);
};

module.exports = { getRefundPayoutSummary, quotePayout, createRefundPayout };
