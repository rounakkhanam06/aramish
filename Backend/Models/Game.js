const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  key: {
    type: String,
    required: true,
    unique: true,
  },
  rewardPoints: {
    type: Number,
    default: 100,
  },
  requiredDays: {
    type: Number,
    default: 3,
  },
  requiredPlaysPerDay: {
    type: Number,
    default: 5,
  },
  rewardRepeatable: {
    type: Boolean,
    default: true,
  },
  repeatRewardPoints: {
    type: Number,
    default: 50,
  },
  dailyPlayLimit: {
    type: Number,
    default: 20,
  },
  status: {
    type: Boolean,
    default: true,
  },
  questions: [
    {
      question: { type: String, required: true },
      highlighted: { type: String },
      image: { type: String },
      brand: { type: String },
      productName: { type: String },
      options: [{ type: String }],
      correctIdx: { type: Number, required: true }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
