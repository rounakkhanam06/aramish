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
    type: Number,
    required: true
  },
  costPrice: {
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
  article: {
    type: String,
    required: true,
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
  specifications: [{
    section: { type: String, required: true },
    fields: [{
      name: { type: String, required: true },
      value: { type: String, required: true }
    }]
  }],
  flags: {
    topSection: { type: Boolean, default: false },
    crazyDeals: { type: Boolean, default: false },
    flashSale: { type: Boolean, default: false }
  },
  gstCategory: {
    type: String
  },
  gstPercentage: {
    type: Number,
    default: 0
  },
  hsnCode: {
    type: String
  },
  images: [{
    type: String
  }],
  descriptionImages: [{
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
    color: { type: String, required: true },
    size: { type: String, required: true },
    stock: { type: Number, required: true, default: 0 },
    sku: { type: String, required: true },
    useDefaultPricing: { type: Boolean, default: true },
    mrp: { type: Number },
    sellingPrice: { type: Number },
    images: [{ type: String }]
  }]
}, { timestamps: true });

// For a product with variants, `stock` is the total across its variants (what the admin
// inventory list and stock alerts show). Every atomic variant stock $inc also $incs `stock` by
// the same amount; this keeps it right whenever the whole document is saved.
productSchema.pre('validate', function () {
  if (this.variations && this.variations.length > 0) {
    this.stock = this.variations.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }
});

productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 'text', brandName: 'text', tags: 'text' });
productSchema.index({ status: 1, sales: -1 });
productSchema.index({ status: 1, 'flags.crazyDeals': 1 });
productSchema.index({ status: 1, 'flags.flashSale': 1 });
productSchema.index({ brandId: 1 });
productSchema.index({ isTrending: 1 });
// Storefront lists: approved products newest first (homepage, /combined, ?status=Approved),
// the flagged homepage sections, category browsing and price sorting
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ status: 1, 'flags.crazyDeals': 1, createdAt: -1 });
productSchema.index({ status: 1, 'flags.flashSale': 1, createdAt: -1 });
productSchema.index({ status: 1, 'flags.topSection': 1, createdAt: -1 });
productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, sellingPrice: 1 });

module.exports = mongoose.model('Product', productSchema);
