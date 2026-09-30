const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, getMe, updateProfile, changePassword, getWallet, updateFcmToken, removeFcmToken } = require('../Controllers/userAuthController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { uploadImage, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

// Public routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// Protected routes
router.get('/me', protectUser, getMe);
router.put('/profile', protectUser, uploadImage, processImage, handleUploadError, updateProfile);
router.put('/change-password', protectUser, changePassword);
router.get('/wallet', protectUser, getWallet);
router.post('/fcm-token', protectUser, updateFcmToken);
router.delete('/fcm-token', protectUser, removeFcmToken);

module.exports = router;

