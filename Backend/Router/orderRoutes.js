const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders, getAllOrders, updateOrderStatus, getUserOrderById, trackOrderById, getAdminOrderById, deleteOrder, cancelOrder, getWalletPreview, getRefundPayout, createRefundPayout } = require('../Controllers/orderController');
const { downloadMyInvoice, adminDownloadInvoice, adminIssueInvoice, adminInvoiceStatus } = require('../Controllers/invoiceController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { protectAdmin } = require('../Middlewares/authMiddleware');

// Public routes
router.get('/track/:id', trackOrderById);

// User routes
router.route('/')
  .get(protectUser, getUserOrders)
  .post(protectUser, createOrder);

router.post('/wallet-preview', protectUser, getWalletPreview);

router.route('/:id')
  .get(protectUser, getUserOrderById);

router.route('/:id/cancel')
  .post(protectUser, cancelOrder);

router.get('/:id/invoice', protectUser, downloadMyInvoice);

// Admin routes
router.route('/admin/all')
  .get(protectAdmin, getAllOrders);

router.route('/admin/:id')
  .get(protectAdmin, getAdminOrderById)
  .delete(protectAdmin, deleteOrder);

router.route('/admin/:id/status')
  .put(protectAdmin, updateOrderStatus);

router.route('/admin/:id/invoice')
  .get(protectAdmin, adminDownloadInvoice)
  .post(protectAdmin, adminIssueInvoice);
router.get('/admin/:id/invoice-status', protectAdmin, adminInvoiceStatus);

router.route('/admin/:id/refund-payout')
  .get(protectAdmin, getRefundPayout)
  .post(protectAdmin, createRefundPayout);

module.exports = router;

