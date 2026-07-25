const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['Welcome Bonus', 'ORDER_REDEMPTION', 'REFUND', 'Redemption', 'Refund', 'Payment', 'Order Cancellation', 'ORDER_REWARD', 'ORDER_REWARD_REDUCE'],
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  unlocksAt: {
    type: Date,
  },
  amount: {
    type: Number,
    required: true,
  },
  coinsUsed: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    default: 'Completed',
  },
  description: {
    type: String,
    default: '',
  }
}, { timestamps: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
