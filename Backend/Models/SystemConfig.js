const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  platformName: { type: String, default: 'Aramish' },
  supportEmail: { type: String, default: 'Info@aramishshoes.com' },
  helpline: { type: String, default: '+91 1800 123 4567' },
  currency: { type: String, default: 'INR (₹)' },
  commission: { type: Number, default: 10 },
  gstNo: { type: String, default: '07AAAAA0000A1Z5' },
  codChargeEnabled: { type: Boolean, default: true },
  codChargeAmount: { type: Number, default: 150 },
  prepaidDiscountEnabled: { type: Boolean, default: true },
  prepaidDiscountAmount: { type: Number, default: 100 },
  // Free Shipping for Customers: delivery is billed at ₹0 and the business pays Shiprocket's
  // freight from its own account (recorded per order as Order.shippingCost for finance).
  freeShippingEnabled: { type: Boolean, default: true },
  returnWindowDays: { type: Number, default: 2 },
  // ---- Wallet / reward rules (read ONLY through utils/walletService.getWalletConfig) ----
  welcomeBonusEnabled: { type: Boolean, default: true },
  welcomeBonusCoins: { type: Number, default: 1000, min: 0 },
  // Fixed coins credited to the referrer for EVERY successful (delivered) order of the referred customer
  referralRewardPerOrder: { type: Number, default: 200, min: 0 },
  rewardCoinsEnabled: { type: Boolean, default: true },
  // Customer's own order reward: % of the product selling value, floored to whole coins, capped per order (0 = no cap)
  orderRewardPercentage: { type: Number, default: 10, min: 0, max: 100 },
  orderRewardMaxCap: { type: Number, default: 400, min: 0 },
  // Max share of the eligible product value (excl. GST/delivery/fees) payable with wallet coins per order
  walletRedemptionPercentage: { type: Number, default: 25, min: 0, max: 100 },
  marqueeEnabled: { type: Boolean, default: true },
  walletEnabled: { type: Boolean, default: true },
  referralEnabled: { type: Boolean, default: true },
  crazyDealsHeaderName: { type: String, default: 'Crazy Deals' },
  showCrazyDealsTimer: { type: Boolean, default: true },
  crazyDealsDuration: { type: Number, default: 9930 },
  featuredCollectionHeaderName: { type: String, default: 'Featured Collection' },
  showFeaturedCollectionTimer: { type: Boolean, default: false },
  featuredCollectionDuration: { type: Number, default: 7200 },
  newArrivalsHeaderName: { type: String, default: 'New Arrivals' },
  showNewArrivalsTimer: { type: Boolean, default: true },
  newArrivalsDuration: { type: Number, default: 9930 }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
