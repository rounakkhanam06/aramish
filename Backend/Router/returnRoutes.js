const express = require('express');
const router = express.Router();
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const {
  createReturnRequest,
  getUserReturns,
  getAllReturns,
  getReturnById,
  updateReturnStatus,
  getReturnByOrderId
} = require('../Controllers/returnController');

// User routes
router.route('/')
  .get(protectUser, getUserReturns)
  .post(protectUser, createReturnRequest);

router.get('/by-order/:orderId', protectUser, getReturnByOrderId);

// Admin routes
router.get('/admin/all', protectAdmin, getAllReturns);
router.get('/admin/:id', protectAdmin, getReturnById);
router.put('/admin/:id/status', protectAdmin, updateReturnStatus);

module.exports = router;
