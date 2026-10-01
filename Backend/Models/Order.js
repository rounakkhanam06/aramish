const mongoose = require('mongoose');

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
      attributes: { type: Map, of: String, default: {} }
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
    phone: { type: String, default: '' }
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

orderSchema.pre('save', function () {
  if (this.paymentId === null || this.paymentId === '') {
    this.paymentId = undefined;
  }
});

module.exports = mongoose.model('Order', orderSchema);
