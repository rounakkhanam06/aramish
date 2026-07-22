const express = require('express');
const router = express.Router();
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const {
  createExchangeRequest,
  getUserExchanges,
  getExchangeByOrderId,
  getAllExchanges,
  getExchangeById,
  getExchangeStats,
  updateExchangeStatus,
  handleExchangeWebhook,
  updateExchangeAddress,
  retryExchangeShipment
} = require('../Controllers/exchangeController');

// Webhook — no auth (must come before any auth middleware)
router.post('/webhook/shiprocket', handleExchangeWebhook);

// User routes
router.route('/')
  .get(protectUser, getUserExchanges)
  .post(protectUser, createExchangeRequest);

router.get('/by-order/:orderId', protectUser, getExchangeByOrderId);

// Admin routes
router.get('/admin/all', protectAdmin, getAllExchanges);
router.get('/admin/stats', protectAdmin, getExchangeStats);
router.get('/admin/:id', protectAdmin, getExchangeById);
router.put('/admin/:id/status', protectAdmin, updateExchangeStatus);
router.put('/admin/:id/address', protectAdmin, updateExchangeAddress);
router.post('/admin/:id/retry-shipment', protectAdmin, retryExchangeShipment);

module.exports = router;
