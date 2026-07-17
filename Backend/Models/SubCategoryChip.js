const mongoose = require('mongoose');

const subCategoryChipSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  categoryId: {
    type: String,
    required: true
  },
  subCategoryName: {
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

module.exports = mongoose.model('SubCategoryChip', subCategoryChipSchema);
