const mongoose = require('mongoose');

const gamePlayLogSchema = new mongoose.Schema({
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
  playedAt: {
    type: Date,
    default: Date.now,
  },
  pointsAwarded: {
    type: Number,
    default: 0,
  },
  dayCount: {
    type: Number,
    default: 0,
  },
  playNumberOfDay: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

gamePlayLogSchema.index({ gameId: 1, userId: 1 });
gamePlayLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('GamePlayLog', gamePlayLogSchema);
