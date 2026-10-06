const mongoose = require('mongoose');

// Every change to User.walletBalance is recorded here (see utils/walletService.js).
// Convention for new records: credits are positive, debits are negative. Some legacy
// ORDER_REDEMPTION records were stored with a positive amount — consumers should use
// walletService.getTransactionDirection() rather than the sign alone.
const walletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'Welcome Bonus', 'ORDER_REDEMPTION', 'REFUND', 'Redemption', 'Refund', 'Payment', 'Order Cancellation',
      'ORDER_REWARD', 'ORDER_REWARD_REDUCE',
      'REFERRAL_REWARD', 'REFERRAL_REWARD_REVERSAL', 'CHECKOUT_ROLLBACK', 'LEGACY_BALANCE_MERGE',
      // Refund Wallet (actual money) entries
      'REFUND_WALLET_CREDIT',          // refund paid into the Refund Wallet
      'REFUND_WALLET_DEBIT',           // Refund Wallet money used on an order
      'REFUND_WALLET_RESTORE',         // money credited back after a cancellation/full return
      'REFUND_WALLET_PARTIAL_REFUND'   // money credited back for a partial return
    ],
    required: true,
  },
  // Which balance this entry changed: MAIN = coins wallet (User.walletBalance),
  // REFUND = Refund Wallet money (User.refundWalletBalance). Legacy entries have no value = MAIN.
  wallet: {
    type: String,
    enum: ['MAIN', 'REFUND'],
    default: 'MAIN',
  },
  // Where the coins came from / went to — used for history, auditing and reporting.
  source: {
    type: String,
    enum: ['WELCOME_BONUS', 'REFERRAL_REWARD', 'ORDER_REWARD', 'ORDER_REDEMPTION', 'REFUND', 'ADJUSTMENT'],
    default: null,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  // For referral rewards: the referred customer whose order earned the reward
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  unlocksAt: {
    type: Date,
  },
  amount: {
    type: Number,
    required: true,
  },
  balanceAfter: {
    type: Number,
    default: null,
  },
  // Unique per logical event (e.g. "ORDER_REWARD:<orderId>") so a duplicate trigger can
  // never create a second ledger entry — enforced by the database, not just app logic.
  idempotencyKey: {
    type: String,
    default: undefined,
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

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
