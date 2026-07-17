const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  body: { 
    type: String, 
    required: true 
  },
  target: { 
    type: String, 
    enum: ['All Users', 'Selected Users'], 
    required: true 
  },
  targetUserIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }],
  status: { 
    type: String, 
    enum: ['Pending', 'Delivered', 'Failed'],
    default: 'Delivered' 
  },
  readRate: { 
    type: String, 
    default: '0%' 
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sentAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
