const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders, getAllOrders, updateOrderStatus, getUserOrderById, trackOrderById, getAdminOrderById, deleteOrder, cancelOrder } = require('../Controllers/orderController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { protectAdmin } = require('../Middlewares/authMiddleware');

// Public routes
router.get('/track/:id', trackOrderById);

// User routes
router.route('/')
  .get(protectUser, getUserOrders)
  .post(protectUser, createOrder);

router.route('/:id')
  .get(protectUser, getUserOrderById);

router.route('/:id/cancel')
  .post(protectUser, cancelOrder);

// Admin routes
router.route('/admin/all')
  .get(protectAdmin, getAllOrders);

router.route('/admin/:id')
  .get(protectAdmin, getAdminOrderById)
  .delete(protectAdmin, deleteOrder);

router.route('/admin/:id/status')
  .put(protectAdmin, updateOrderStatus);

module.exports = router;

