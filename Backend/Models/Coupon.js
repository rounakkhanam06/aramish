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
  // What the coupon's eligibility is based on: cart amount (minOrder) or number of units (minQuantity)
  conditionType: {
    type: String,
    enum: ['Amount', 'Quantity'],
    default: 'Amount'
  },
  minOrder: {
    type: Number,
    default: 0
  },
  minQuantity: {
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

// Returns an error message if the order doesn't meet the coupon's condition, otherwise null.
// Coupons created before conditionType existed fall back to the amount rule.
couponSchema.statics.getConditionError = function (coupon, orderAmount, totalQuantity) {
  if (coupon.conditionType === 'Quantity') {
    const required = coupon.minQuantity || 0;
    if (totalQuantity !== undefined && Number(totalQuantity) < required) {
      return `Add at least ${required} item${required === 1 ? '' : 's'} to your order to use this coupon.`;
    }
    return null;
  }
  if (orderAmount !== undefined && Number(orderAmount) < (coupon.minOrder || 0)) {
    return `Minimum order amount of ₹${coupon.minOrder} is required to use this coupon.`;
  }
  return null;
};

module.exports = mongoose.model('Coupon', couponSchema);
