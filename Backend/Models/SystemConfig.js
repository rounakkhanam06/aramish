const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  platformName: { type: String, default: 'Aramish' },
  supportEmail: { type: String, default: 'Info@aramishshoes.com' },
  helpline: { type: String, default: '+91 1800 123 4567' },
  currency: { type: String, default: 'INR (₹)' },
  commission: { type: Number, default: 10 },
  // ---- Business & Tax (GST invoice) details, read through utils/invoiceService ----
  // Seller GSTIN printed on every tax invoice. Invoices are not issued until it is a valid, real GSTIN.
  gstNo: { type: String, default: '' },
  businessLegalName: { type: String, default: '' },
  businessTradeName: { type: String, default: '' },
  businessAddress: { type: String, default: '' },
  businessState: { type: String, default: '' },
  businessStateCode: { type: String, default: '' },
  businessPan: { type: String, default: '' },
  // Invoice numbers: <prefix>/<YY-YY financial year>/<6-digit serial>, e.g. ARM/26-27/000001
  invoicePrefix: { type: String, default: 'ARM' },
  // Courier partners never offered for booking (unreliable pickups/deliveries). Matched by
  // Shiprocket courier_company_id; the name is kept for display.
  blockedCouriers: {
    type: [{
      _id: false,
      courierId: { type: Number, required: true },
      name: { type: String, default: '' },
      reason: { type: String, default: '' },
      blockedAt: { type: Date, default: Date.now }
    }],
    default: []
  },
  // HSN used for a product that has no HSN code of its own (snapshotted at checkout)
  defaultHsnCode: { type: String, default: '' },
  // Footwear (Chapter 64) GST slabs by date. The rule in force on the invoice date applies:
  // per-pair sale value (taxable, after discounts) up to `threshold` -> rateUpToThreshold, above -> rateAboveThreshold.
  gstRateRules: {
    type: [{
      _id: false,
      effectiveFrom: { type: Date, required: true },
      threshold: { type: Number, default: 0, min: 0 },
      rateUpToThreshold: { type: Number, required: true, min: 0, max: 40 },
      rateAboveThreshold: { type: Number, required: true, min: 0, max: 40 }
    }],
    default: () => [
      // Notification 21/2021-CT(Rate): all footwear 12% from 01-01-2022
      { effectiveFrom: new Date('2022-01-01T00:00:00+05:30'), threshold: 0, rateUpToThreshold: 12, rateAboveThreshold: 12 },
      // Notification 9/2025-CT(Rate): <= Rs 2,500 per pair 5%, above 18% from 22-09-2025
      { effectiveFrom: new Date('2025-09-22T00:00:00+05:30'), threshold: 2500, rateUpToThreshold: 5, rateAboveThreshold: 18 }
    ]
  },
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
