const mongoose = require('mongoose');
const courierSelectionSchema = require('./courierSelectionSchema');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      mrp: { type: Number, default: 0 },
      quantity: { type: Number, required: true },
      image: { type: String },
      variationSku: { type: String, default: null },
      article: { type: String, default: null },
      attributes: { type: Map, of: String, default: {} },
      // Product cost price at checkout (admin-entered, for profit reporting). null = not set.
      costPrice: { type: Number, default: null },
      // Tax classification snapshotted at checkout for the GST invoice: HSN code and an admin
      // per-product GST rate override (null = rate from the footwear slab rules on the invoice date).
      hsnCode: { type: String, default: null },
      gstRateOverride: { type: Number, default: null }
    }
  ],
  subtotal: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  platformCommission: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  deliveryAddress: {
    name: { type: String, required: true },
    type: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, default: '' },
    // Place of supply for GST. stateSource: 'customer' (chosen by the customer) or 'pincode'
    // (derived from the pincode for an address saved before the state was collected).
    state: { type: String, default: null },
    stateCode: { type: String, default: null },
    stateSource: { type: String, default: null }
  },
  // Optional B2B billing details entered at checkout (validated GSTIN)
  buyerGstin: { type: String, default: null },
  buyerBusinessName: { type: String, default: null },
  // Set when the order was placed with the tax snapshot above. Orders without it (placed before
  // GST invoicing) are never auto-invoiced: their historical tax data needs separate review.
  taxDataCapturedAt: { type: Date, default: null },
  // GST tax invoice, assigned exactly once (number never changes or gets reused). `data` is the
  // complete immutable snapshot the PDF is rendered from (seller, buyer, lines, totals).
  invoice: {
    number: { type: String },
    sequence: { type: Number },
    financialYear: { type: String },
    date: { type: Date },
    data: { type: mongoose.Schema.Types.Mixed }
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Online'],
    required: true
  },
  paymentStatus: {
    type: String,
    // 'Cancelled': the order was cancelled before any payment was collected (e.g. COD).
    enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'Partially Refunded', 'Cancelled'],
    default: 'Pending'
  },
  paymentId: {
    type: String
  },
  coinsRedeemed: {
    type: Number,
    default: 0
  },
  walletUsed: {
    type: Number,
    default: 0
  },
  // Refund Wallet money used on this order, and how much of it has already been credited
  // back by cancellations/returns (so repeated partial returns can never over-restore).
  refundWalletUsed: {
    type: Number,
    default: 0
  },
  refundWalletRestored: {
    type: Number,
    default: 0
  },
  // Refund/Cash Wallet money for this order that an admin paid out to the customer's bank/UPI
  // (utils/refundPayout.js). walletAmount was deducted from the wallet; amount was transferred —
  // the difference is the order charges a bank/UPI refund doesn't cover.
  refundPayouts: [{
    walletAmount: { type: Number, required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['Bank', 'UPI'], required: true },
    bankDetails: {
      accountHolderName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      ifscCode: { type: String, default: null },
      bankName: { type: String, default: null },
      upiId: { type: String, default: null }
    },
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    adminName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  welcomeCoinsUsed: {
    type: Number,
    default: 0
  },
  referralCoinsUsed: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: [
      'Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered',
      'Cancelled', 'Return Requested', 'Refunded', 'Partially Refunded',
      'Exchange Requested', 'Exchange Approved', 'Pickup Scheduled',
      'Old Item Picked Up', 'Replacement Dispatched', 'Exchange Completed',
      'Exchange Rejected', 'Exchange Cancelled', 'Exchange Failed', 'Manual Review'
    ],
    default: 'Pending'
  },
  couponCode: {
    type: String,
    default: null
  },
  shiprocketOrderId: {
    type: String,
    default: null
  },
  shipmentId: {
    type: String,
    default: null
  },
  shiprocketResponses: {
    type: Array,
    default: []
  },
  deliveryCharge: {
    type: Number,
    default: 0
  },
  codCharge: {
    type: Number,
    default: 0
  },
  prepaidDiscount: {
    type: Number,
    default: 0
  },
  // What Shiprocket charges US for this order (an expense, not part of the customer's bill):
  // the courier's freight and, on a COD shipment with cash to collect, its own COD fee.
  // Recorded from the checkout quote and refreshed when a courier is auto-booked.
  // null = order placed before this was recorded (finance reports derive or estimate it).
  shippingCost: {
    type: Number,
    default: null
  },
  shiprocketCodFee: {
    type: Number,
    default: null
  },
  etd: {
    type: String,
    default: ''
  },
  rewardCredited: {
    type: Boolean,
    default: false
  },
  rewardCreditedAt: {
    type: Date,
    default: null
  },
  rewardCoinsAmount: {
    type: Number,
    default: 0
  },
  rewardDeducted: {
    type: Boolean,
    default: false
  },
  rewardDeductedAt: {
    type: Date,
    default: null
  },
  // Snapshot at checkout: product selling value (excl. GST/delivery/fees) used for the
  // reward % and the wallet redemption limit, and the reward coins that value earns.
  eligibleProductValue: {
    type: Number,
    default: null
  },
  rewardCoinsExpected: {
    type: Number,
    default: null
  },
  // Referral reward paid to the referrer for this order (one per successful order)
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralRewardCredited: {
    type: Boolean,
    default: false
  },
  referralRewardCreditedAt: {
    type: Date,
    default: null
  },
  referralRewardAmount: {
    type: Number,
    default: 0
  },
  referralRewardReversed: {
    type: Boolean,
    default: false
  },
  referralRewardReversedAt: {
    type: Date,
    default: null
  },
  refundProcessed: {
    type: Boolean,
    default: false
  },
  onlinePaymentRefundProcessed: {
    type: Boolean,
    default: false
  },
  awbCode: {
    type: String,
    default: null
  },
  courierName: {
    type: String,
    default: null
  },
  // Shiprocket courier_company_id of the booked courier, and the admin's selection record
  courierId: {
    type: Number,
    default: null
  },
  courierSelection: {
    type: courierSelectionSchema,
    default: null
  },
  // AWBs replaced by a courier reassignment. Late webhooks for these are ignored (they must never
  // switch the order back, or cancel it).
  awbHistory: {
    type: [String],
    default: []
  },
  // Guards courier booking against double clicks / parallel requests (stale after 2 minutes)
  bookingLockAt: {
    type: Date,
    default: null
  },
  shipmentStatus: {
    type: String,
    default: null
  },
  pickupScheduled: {
    type: Boolean,
    default: false
  },
  trackingHistory: [
    {
      status: String,
      timestamp: Date,
      location: String,
      activity: String
    }
  ]
}, { timestamps: true });

orderSchema.index({ userId: 1, createdAt: -1 }); // User order history
orderSchema.index({ status: 1, createdAt: -1 });  // Admin status filter
orderSchema.index({ paymentStatus: 1 });           // Payment reconciliation
orderSchema.index({ shiprocketOrderId: 1 }, { sparse: true }); // Webhook lookup
orderSchema.index({ couponCode: 1 }, { sparse: true }); // Coupon usage
orderSchema.index({ referrerId: 1 }, { sparse: true }); // Referrer locked-reward lookup

orderSchema.index({ paymentId: 1 }, { sparse: true, unique: true });
orderSchema.index({ 'invoice.number': 1 }, { unique: true, partialFilterExpression: { 'invoice.number': { $type: 'string' } } });

orderSchema.pre('save', function () {
  if (this.paymentId === null || this.paymentId === '') {
    this.paymentId = undefined;
  }
});

module.exports = mongoose.model('Order', orderSchema);
