const mongoose = require('mongoose');

const legalPolicySchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true,
    enum: ['privacy', 'terms', 'returnExchange']
  },
  content: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('LegalPolicy', legalPolicySchema);
