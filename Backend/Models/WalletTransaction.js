const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['Redemption', 'Refund', 'Payment', 'Order Cancellation'],
    required: true,
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
