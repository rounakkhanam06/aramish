const Notification = require('../Models/Notification');
const User = require('../Models/User');
const { sendNotificationToUser } = require('../Router/firebaseAdmin');
const mongoose = require('mongoose');

// @desc    Send broadcast notification
// @route   POST /admin/notifications/send
// @access  Private/Admin
exports.sendBroadcast = async (req, res) => {
  try {
    const { title, body, target, targetUserIds } = req.body;

    if (!title || !body || !target) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Prepare notification record
    const notification = new Notification({
      title,
      body,
      target,
      targetUserIds: targetUserIds || [],
      status: 'Pending',
      sentAt: new Date()
    });

    await notification.save();

    let users = [];

    // Determine target audience
    if (target === 'All Users') {
      users = await User.find({}).select('_id fcmWebTokens fcmMobileTokens');
    } else if (target === 'Selected Users') {
      if (!targetUserIds || targetUserIds.length === 0) {
        notification.status = 'Failed';
        await notification.save();
        return res.status(400).json({ success: false, message: 'No users selected' });
      }
      users = await User.find({ _id: { $in: targetUserIds } }).select('_id fcmWebTokens fcmMobileTokens');
    }

    if (users.length === 0) {
      notification.status = 'Failed';
      await notification.save();
      return res.status(404).json({ success: false, message: 'No valid users found for the selected target' });
    }

    const pushPayload = { title, body };
    
    console.log(`[DEBUG] Broadcasting to ${users.length} users. User 0 tokens: Web(${users[0]?.fcmWebTokens?.length}) Mobile(${users[0]?.fcmMobileTokens?.length})`);

    // Send to all fetched users
    const sendPromises = users.map(user => 
      sendNotificationToUser(user._id, pushPayload)
    );

    Promise.allSettled(sendPromises).then(async () => {
      notification.status = 'Delivered';
      await notification.save();
    });

    res.status(200).json({ 
      success: true, 
      message: `Notification broadcast initiated to ${users.length} user(s).`,
      notification 
    });

  } catch (error) {
    console.error('Send Broadcast Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all broadcast notifications history
// @route   GET /admin/notifications
// @access  Private/Admin
exports.getHistory = async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .sort({ createdAt: -1 })
      .populate('targetUserIds', 'name email phone');

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('Get Notification History Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get current user's notifications (specific + broadcasts)
// @route   GET /api/notifications/my
// @access  Private (User)
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({
      $or: [
        { target: 'All Users' },
        { targetUserIds: userId }
      ]
    }).sort({ createdAt: -1 });

    const formatted = notifications.map(notif => {
      const isRead = notif.readBy && notif.readBy.some(id => id.toString() === userId.toString());
      return {
        _id: notif._id,
        title: notif.title,
        body: notif.body,
        read: isRead,
        createdAt: notif.createdAt || notif.sentAt
      };
    });

    res.status(200).json({ success: true, notifications: formatted });
  } catch (error) {
    console.error('Get My Notifications Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all notifications as read for current user
// @route   POST /api/notifications/read-all
// @access  Private (User)
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.updateMany(
      {
        $or: [
          { target: 'All Users' },
          { targetUserIds: userId }
        ],
        readBy: { $ne: userId }
      },
      {
        $addToSet: { readBy: userId }
      }
    );
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a notification (Admin only)
// @route   DELETE /admin/notifications/:id
// @access  Private/Admin
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    await notification.deleteOne();
    res.status(200).json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete Notification Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Bulk delete notifications (Admin only)
// @route   POST /admin/notifications/bulk-delete
// @access  Private/Admin
exports.bulkDeleteNotifications = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide array of notification IDs' });
    }
    await Notification.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ success: true, message: 'Notifications deleted successfully' });
  } catch (error) {
    console.error('Bulk Delete Notifications Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Mark a single notification as read for current user
// @route   POST /api/notifications/:id/read
// @access  Private (User)
exports.markSingleRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;
    
    // Make sure notification exists and target matches
    const notification = await Notification.findOne({
      _id: notificationId,
      $or: [
        { target: 'All Users' },
        { targetUserIds: userId }
      ]
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    // Add userId to readBy array if not already present
    await Notification.updateOne(
      { _id: notificationId },
      { $addToSet: { readBy: userId } }
    );
    
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark single read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
