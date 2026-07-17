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
    enum: ['Original', 'Wallet'],
    default: 'Original'
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
  pickupScheduled: { type: Boolean, default: false }
}, { timestamps: true });

returnRequestSchema.index({ orderId: 1 });
returnRequestSchema.index({ userId: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
