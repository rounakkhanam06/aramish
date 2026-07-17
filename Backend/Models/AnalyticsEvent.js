const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  event: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['engagement', 'commerce', 'social', 'game', 'studio', 'auth', 'other'],
    default: 'other',
    index: true
  },
  properties: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    userAgent: { type: String, default: '' },
    platform: { type: String, default: 'web' },
    referrer: { type: String, default: '' },
    screenResolution: { type: String, default: '' }
  }
}, { timestamps: true });

// TTL index to automatically expire analytics data after 90 days
analyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound indexes for analytics queries
analyticsEventSchema.index({ event: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
