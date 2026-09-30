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
  // 'pending' = no successful order yet, 'rewarded' = at least one order has earned the referrer coins.
  // ('completed' is kept only for legacy records.)
  status: {
    type: String,
    enum: ['pending', 'completed', 'rewarded'],
    default: 'pending'
  },
  // Running total of coins the referrer has earned from this referee's successful orders
  referrerCoinsAwarded: {
    type: Number,
    default: 0
  },
  successfulOrders: {
    type: Number,
    default: 0
  },
  // Legacy: the referee no longer receives referral coins (they get the welcome bonus instead)
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
