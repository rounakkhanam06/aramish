const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  logo: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  isTrending: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, { timestamps: true });

brandSchema.index({ status: 1 });
brandSchema.index({ isTrending: 1 });

module.exports = mongoose.model('Brand', brandSchema);
