const mongoose = require('mongoose');

// Atomic named sequences (e.g. invoice serials per prefix + financial year).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Counter', counterSchema);
