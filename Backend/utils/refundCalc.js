// Refund amounts — one rule shared by the return flow (estimate, request, admin refund) and by
// the admin payout of Refund/Cash Wallet money to a bank/UPI, so the two can never disagree.

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Order charges the Refund/Cash Wallet gives back on a full return/cancellation but a bank/UPI
// transfer does not: GST charged on top (legacy orders), delivery, platform fee and COD charge.
const orderCharges = (order) => ({
  gst: round2(order.gstAmount),
  delivery: round2(order.deliveryCharge),
  platformFee: round2(order.platformCommission),
  codCharge: round2(order.codCharge)
});

// Money the customer actually paid for the order (cash/online + Refund/Cash Wallet). Coins
// redeemed on it are non-returnable and never part of a refund.
const moneyPaid = (order) => (Number(order.total) || 0) + (Number(order.refundWalletUsed) || 0);

// Most the customer can get back for `returnItems` (prices taken from the order, never from the
// request): the items' value, less their share of the coupon and prepaid discounts on a partial
// return; for a Wallet refund also their share of GST, plus delivery and platform fee on a full
// return. Never more than the money actually paid, and a Bank/UPI refund never more than the money
// paid towards the products (money paid less every order charge) — so on a full return the charges
// stay deducted even when a coupon or coins would otherwise hide them under the money-paid cap.
const calculateEligibleRefund = (order, returnItems, refundMethod) => {
  const itemsValue = returnItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  // Return lines saved before they recorded a variant match their order line by product alone.
  const returnedQty = (orderItem) => returnItems
    .filter(r => String(r.productId) === String(orderItem.productId) &&
      (!r.variationSku || r.variationSku === orderItem.variationSku))
    .reduce((sum, r) => sum + r.quantity, 0);
  const isFullReturn = order.items.every(orderItem => returnedQty(orderItem) === orderItem.quantity);

  let eligible = itemsValue;
  // Partial return: the order-level coupon and prepaid discounts were spread over every item, so
  // the returned items only give back their discounted share.
  if (!isFullReturn && order.subtotal > 0) {
    const orderDiscounts = (order.discountAmount || 0) + (order.prepaidDiscount || 0);
    const discountShare = (itemsValue / order.subtotal) * orderDiscounts;
    eligible = Math.max(0, itemsValue - discountShare);
  }

  const paid = moneyPaid(order);
  const charges = orderCharges(order);
  let cap = paid;
  if (refundMethod === 'Wallet') {
    const proportionalGst = (order.subtotal && order.subtotal > 0) ? (itemsValue / order.subtotal) * (order.gstAmount || 0) : 0;
    eligible += proportionalGst;
    if (isFullReturn) {
      eligible += (order.deliveryCharge || 0) + (order.platformCommission || 0);
    }
  } else {
    cap = Math.max(0, paid - charges.gst - charges.delivery - charges.platformFee - charges.codCharge);
  }
  return round2(Math.min(eligible, cap));
};

// Splits `total` over `lines` in proportion to each line's weight, in paise, giving the rounding
// remainder to the last line so the parts always add up to `total` exactly.
const splitProportionally = (total, lines, weightOf) => {
  const totalPaise = Math.round(total * 100);
  const weights = lines.map(weightOf);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let allocated = 0;
  return lines.map((line, idx) => {
    const share = idx === lines.length - 1
      ? totalPaise - allocated
      : (weightSum > 0 ? Math.floor((totalPaise * weights[idx]) / weightSum) : 0);
    allocated += share;
    return share / 100;
  });
};

module.exports = { round2, orderCharges, moneyPaid, calculateEligibleRefund, splitProportionally };
