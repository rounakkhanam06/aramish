const mongoose = require('mongoose');

const userGameProgressSchema = new mongoose.Schema({
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
  currentStreakDays: {
    type: Number,
    default: 0,
  },
  completedCycles: {
    type: Number,
    default: 0,
  },
  lastPlayedDate: {
    type: String, // YYYY-MM-DD
    default: null,
  },
  totalPointsEarned: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

// Ensure unique combination of userId and gameId
userGameProgressSchema.index({ userId: 1, gameId: 1 }, { unique: true });

module.exports = mongoose.model('UserGameProgress', userGameProgressSchema);
