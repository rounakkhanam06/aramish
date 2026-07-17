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
      quantity: { type: Number, required: true },
      image: { type: String },
      variationSku: { type: String, default: null },
      attributes: { type: Map, of: String, default: {} }
    }
  ],
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
    enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'Partially Refunded'],
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
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Refunded', 'Partially Refunded'],
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
  etd: {
    type: String,
    default: ''
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

orderSchema.index({ paymentId: 1 }, { sparse: true, unique: true });

orderSchema.pre('save', function () {
  if (this.paymentId === null || this.paymentId === '') {
    this.paymentId = undefined;
  }
});

module.exports = mongoose.model('Order', orderSchema);
