const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    default: null
  },
  email: {
    type: String,
    default: null,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  avatar: {
    type: String,
    default: null
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', null],
    default: null
  },
  dob: {
    type: Date,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  otpLastSentAt: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  password: {
    type: String,
    default: null
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  // Single combined coin wallet (welcome bonus + referral rewards + order rewards).
  // Only ever modified through utils/walletService.js, which writes a WalletTransaction
  // for every change. Locked (in-return-window) reward coins are included here and
  // excluded from the spendable amount by walletService.getWalletSummary().
  walletBalance: {
    type: Number,
    default: 0
  },
  // Refund Wallet: the customer's actual refunded MONEY (not coins). Kept completely separate
  // from walletBalance, has no redemption % limit, and is returned to this wallet if an
  // order paid with it is cancelled/returned. Also only modified through walletService.
  refundWalletBalance: {
    type: Number,
    default: 0
  },
  welcomeBonusGiven: {
    type: Boolean,
    default: false
  },
  welcomeBonusDate: {
    type: Date,
    default: null
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fcmWebTokens: {
    type: [String],
    default: []
  },
  fcmMobileTokens: {
    type: [String],
    default: []
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, { timestamps: true });

// Hash password before saving if modified
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Indexes
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ referredBy: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
