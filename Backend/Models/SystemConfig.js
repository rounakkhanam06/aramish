const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  platformName: { type: String, default: 'Aramish' },
  supportEmail: { type: String, default: 'support@aramish.com' },
  helpline: { type: String, default: '+91 1800 123 4567' },
  currency: { type: String, default: 'INR (₹)' },
  commission: { type: Number, default: 10 },
  gstNo: { type: String, default: '07AAAAA0000A1Z5' },
  gstPercentage: { type: Number, default: 18 },
  referralCoinsPerReferral: { type: Number, default: 100 },
  referralCoinsReferrer: { type: Number, default: 100 },
  referralCoinsReferee: { type: Number, default: 100 },
  returnWindowDays: { type: Number, default: 7 },
  referralEnabled: { type: Boolean, default: true },
  coinConversionEnabled: { type: Boolean, default: true },
  coinsPerRupee: { type: Number, default: 100 },
  minimumRedeemCoins: { type: Number, default: 500 },
  maximumRedeemPerOrder: { type: Number, default: 10000 }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
