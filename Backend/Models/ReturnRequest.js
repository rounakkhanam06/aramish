const mongoose = require('mongoose');

const returnRequestSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      image: { type: String }
    }
  ],
  reason: {
    type: String,
    enum: ['Damaged Product', 'Wrong Item Sent', 'Defective Unit', 'Not As Described', 'Size/Fit Issue', 'Changed Mind', 'Other'],
    required: true
  },
  reasonDetails: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Requested', 'Approved', 'Rejected', 'Pick-up Scheduled', 'Received', 'Refunded'],
    default: 'Requested'
  },
  refundAmount: {
    type: Number,
    required: true
  },
  refundMethod: {
    type: String,
    enum: ['Original', 'Wallet', 'Bank'],
    default: 'Original'
  },
  bankDetails: {
    accountHolderName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    ifscCode: { type: String, default: null },
    bankName: { type: String, default: null },
    upiId: { type: String, default: null }
  },
  adminNotes: {
    type: String,
    default: ''
  },
  images: {
    type: [String],
    default: []
  },
  shiprocketReturnOrderId: { type: String, default: null },
  shiprocketReturnShipmentId: { type: String, default: null },
  awbCode: { type: String, default: null },
  courierName: { type: String, default: null },
  walletRefundProcessed: { type: Boolean, default: false },
  pickupScheduled: { type: Boolean, default: false },

  // Refund idempotency claims (guard the 'Refunded' branch against double stock
  // restoration / double cash refund on retry after a partial failure)
  stockRefundClaimed: { type: Boolean, default: false },
  cashRefundProcessed: { type: Boolean, default: false },

  // Shiprocket reverse-pickup shipment retry tracking (mirrors ExchangeRequest)
  shipmentStatus: {
    type: String,
    enum: ['Pending', 'Created', 'Failed', 'Manual Review'],
    default: 'Pending'
  },
  shipmentRetryInProgress: { type: Boolean, default: false },
  shipmentRetryCount: { type: Number, default: 0 },
  shipmentErrors: [
    {
      error: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  lastShipmentRetryAt: { type: Date, default: null }
}, { timestamps: true });

returnRequestSchema.index({ orderId: 1 });
returnRequestSchema.index({ userId: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
