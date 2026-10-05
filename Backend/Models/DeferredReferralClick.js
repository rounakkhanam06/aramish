const mongoose = require('mongoose');

// A tap on a referral invite link (/r/CODE) from an iPhone/iPad without the app installed.
// iOS has no install referrer, so on the app's first launch the backend matches the new install
// to this tap by network + device signals and hands the referral code back (deferred deep link).
const deferredReferralClickSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true
  },
  // IPv4 address, or the /64 network prefix for IPv6 (devices rotate the rest of the address)
  ipKey: {
    type: String,
    required: true
  },
  osVersion: String,  // e.g. "17.5"
  screen: String,     // physical pixels, "1179x2556"
  tzOffset: Number,   // minutes east of UTC
  language: String,   // e.g. "en-in"
  claimedAt: {
    type: Date,
    default: null
  },
  // Removed automatically after 3 days; only clicks from the last 24 hours are ever matched
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 3
  }
});

deferredReferralClickSchema.index({ ipKey: 1, createdAt: -1 });

module.exports = mongoose.model('DeferredReferralClick', deferredReferralClickSchema);
