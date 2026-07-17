const express = require('express');
const router = express.Router();
const { webhookReceiver } = require('../Controllers/paymentController');

router.post('/webhook', webhookReceiver);

module.exports = router;
