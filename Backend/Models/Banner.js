const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String
  },
  subtitle: {
    type: String
  },
  image: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);
