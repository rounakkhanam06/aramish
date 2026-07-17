const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Percentage', 'Fixed Amount'],
    default: 'Percentage'
  },
  value: {
    type: Number,
    required: true
  },
  minOrder: {
    type: Number,
    default: 0
  },
  usageLimit: {
    type: Number,
    default: 1
  },
  expiry: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Paused', 'Expired'],
    default: 'Active'
  },
  perUserLimit: {
    type: Number,
    default: 1
  },
  usage: {
    type: Number,
    default: 0
  },
  maxDiscount: {
    type: Number,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
