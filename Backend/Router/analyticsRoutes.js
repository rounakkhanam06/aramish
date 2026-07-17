const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../Models/User');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const {
  trackEvents,
  getOverview,
  getDau,
  getRetention,
  getSessionsInfo,
  getCheckoutFunnel,
  getTopEvents,
  getSearchAnalytics,
  getTopProducts,
  getGameAnalytics,
  getEarnings,
  getSystemNotifications,
  globalSearch
} = require('../Controllers/analyticsController');

// Optional user parser middleware to attach req.user if a valid token is provided
const optionalUser = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-otp -otpExpiry');
      if (user && decoded.tokenVersion === user.tokenVersion) {
        req.user = user;
      }
    } catch (error) {
      // Silent pass for analytics logging
    }
  }
  next();
};

// Tracking endpoint (accessible by anyone, registers user if logged in)
router.post('/track', optionalUser, trackEvents);

// Admin-only analytics retrieval endpoints
router.get('/overview', protectAdmin, getOverview);
router.get('/dau', protectAdmin, getDau);
router.get('/retention', protectAdmin, getRetention);
router.get('/sessions', protectAdmin, getSessionsInfo);
router.get('/funnel', protectAdmin, getCheckoutFunnel);
router.get('/events', protectAdmin, getTopEvents);
router.get('/search', protectAdmin, getSearchAnalytics);
router.get('/products/top', protectAdmin, getTopProducts);
router.get('/games', protectAdmin, getGameAnalytics);
router.get('/earnings', protectAdmin, getEarnings);
router.get('/notifications/system', protectAdmin, getSystemNotifications);
router.get('/search/global', protectAdmin, globalSearch);

module.exports = router;
