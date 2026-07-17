const express = require('express');
const router = express.Router();
const notificationController = require('../Controllers/notificationController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

router.post('/send', protectAdmin, notificationController.sendBroadcast);
router.get('/', protectAdmin, notificationController.getHistory);
router.delete('/:id', protectAdmin, notificationController.deleteNotification);
router.post('/bulk-delete', protectAdmin, notificationController.bulkDeleteNotifications);

// User-facing routes
router.get('/my', protectUser, notificationController.getMyNotifications);
router.post('/read-all', protectUser, notificationController.markAllRead);
router.post('/:id/read', protectUser, notificationController.markSingleRead);

module.exports = router;
