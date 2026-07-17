const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['earned', 'spent'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
