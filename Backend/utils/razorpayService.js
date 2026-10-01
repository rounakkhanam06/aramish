const axios = require('axios');

const RAZORPAY_API = 'https://api.razorpay.com/v1';

const getAuth = () => ({ username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET });

const isRazorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/**
 * Confirms `paymentId` is an INR payment of `expectedAmount` rupees (±₹1) and makes sure the
 * money is captured. The storefront opens Razorpay Checkout without a server-side order, so a
 * payment can arrive only "authorized" — and Razorpay voids authorized payments after a few
 * days unless they are captured, leaving an order marked Paid with no money behind it.
 * Throws on any mismatch; Razorpay API errors carry `response.data.error.description`.
 */
const verifyAndCapturePayment = async (paymentId, expectedAmount) => {
  const auth = getAuth();
  const { data: payment } = await axios.get(`${RAZORPAY_API}/payments/${paymentId}`, { auth });

  if (!payment || (payment.status !== 'captured' && payment.status !== 'authorized')) {
    throw new Error('Razorpay payment is not captured or authorized.');
  }
  if (payment.currency !== 'INR') {
    throw new Error('Currency mismatch. Only INR is supported.');
  }
  const paidAmountRupees = payment.amount / 100;
  if (Math.abs(paidAmountRupees - expectedAmount) > 1) {
    throw new Error(`Payment amount mismatch. Expected: ₹${expectedAmount}, Paid: ₹${paidAmountRupees}`);
  }

  if (payment.status === 'authorized') {
    try {
      await axios.post(`${RAZORPAY_API}/payments/${paymentId}/capture`, { amount: payment.amount, currency: 'INR' }, { auth });
    } catch (captureErr) {
      // The account's auto-capture may have captured it in the meantime.
      const { data: latest } = await axios.get(`${RAZORPAY_API}/payments/${paymentId}`, { auth });
      if (latest.status !== 'captured') throw captureErr;
    }
  }
  return payment;
};

module.exports = { isRazorpayConfigured, verifyAndCapturePayment };
