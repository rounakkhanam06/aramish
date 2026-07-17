const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'Home'
  },
  address: {
    type: String,
    required: true
  },
  pincode: {
    type: String
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

addressSchema.index({ userId: 1 });

module.exports = mongoose.model('Address', addressSchema);
