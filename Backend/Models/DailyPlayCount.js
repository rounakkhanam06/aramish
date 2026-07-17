const mongoose = require('mongoose');

const dailyPlayCountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  playCount: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

// Optimize lookups
dailyPlayCountSchema.index({ userId: 1, gameId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyPlayCount', dailyPlayCountSchema);
