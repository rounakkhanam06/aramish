const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    required: true
  },
  // 'pending' = signed up but no order yet, 'completed' = first order placed, 'rewarded' = coins credited
  status: {
    type: String,
    enum: ['pending', 'completed', 'rewarded'],
    default: 'pending'
  },
  referrerCoinsAwarded: {
    type: Number,
    default: 0
  },
  refereeCoinsAwarded: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

referralSchema.index({ referrer: 1 });
referralSchema.index({ referee: 1 });

module.exports = mongoose.model('Referral', referralSchema);
