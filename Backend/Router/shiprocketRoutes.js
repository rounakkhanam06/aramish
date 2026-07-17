const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../Middlewares/authMiddleware');
const shiprocketController = require('../Controllers/shiprocketController');

// Public APIs
router.post('/estimate', shiprocketController.estimateShipping);

// Admin APIs - Individual steps
router.post('/serviceability', protectAdmin, shiprocketController.checkServiceability);
router.post('/assign-awb', protectAdmin, shiprocketController.assignAWB);
router.post('/request-pickup', protectAdmin, shiprocketController.requestPickup);
router.post('/generate-label', protectAdmin, shiprocketController.generateLabel);

// Admin APIs - Lifecycle management
router.post('/create-order', protectAdmin, shiprocketController.createShiprocketOrderForExisting); // Manual create order on Shiprocket
router.post('/process-order', protectAdmin, shiprocketController.processOrder);       // One-click: AWB + Pickup + Label
router.post('/cancel-order', protectAdmin, shiprocketController.cancelShiprocketOrder); // Cancel order on Shiprocket + DB
router.post('/sync-status', protectAdmin, shiprocketController.syncOrderStatus);       // Manual pull status from Shiprocket

// Webhook (Public, called by Shiprocket)
router.post('/webhook', shiprocketController.webhookReceiver);

// Live Tracking
router.get('/track/:awb', shiprocketController.trackOrder);

module.exports = router;

