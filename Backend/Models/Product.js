const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  subCategory: {
    type: String
  },
  description: {
    type: String
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  mrp: {
    type: Number
  },
  stock: {
    type: Number,
    default: 1
  },
  discountLabel: {
    type: String
  },
  sku: {
    type: String,
    unique: true
  },
  highlights: {
    type: Map,
    of: String
  },
  technicalSpecs: {
    type: Map,
    of: String
  },
  shippingSpecs: {
    weight: { type: Number, required: true },
    length: Number,
    width: Number,
    height: Number
  },
  flags: {
    topSection: { type: Boolean, default: false },
    crazyDeals: { type: Boolean, default: false },
    flashSale: { type: Boolean, default: false }
  },
  gstCategory: {
    type: String
  },
  hsnCode: {
    type: String
  },
  images: [{
    type: String
  }],
  brandName: {
    type: String,
    default: 'Generic'
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: false
  },
  isTrending: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String
  }],
  manufacturerInfo: {
    type: String
  },
  status: {
    type: String,
    enum: ['Approved', 'Pending', 'Out of Stock'],
    default: 'Pending'
  },
  sales: {
    type: Number,
    default: 0
  },
  variations: [{
    sku: String,
    price: Number,
    stock: Number,
    attributes: { type: Map, of: String }
  }]
}, { timestamps: true });

productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 'text', brandName: 'text', tags: 'text' });
productSchema.index({ status: 1, sales: -1 });
productSchema.index({ status: 1, 'flags.crazyDeals': 1 });
productSchema.index({ status: 1, 'flags.flashSale': 1 });
productSchema.index({ brandId: 1 });
productSchema.index({ isTrending: 1 });

module.exports = mongoose.model('Product', productSchema);
