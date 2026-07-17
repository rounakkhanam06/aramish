const mongoose = require('mongoose');

const categoryChipSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  categoryName: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

module.exports = mongoose.model('CategoryChip', categoryChipSchema);
