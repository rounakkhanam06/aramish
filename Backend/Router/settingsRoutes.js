const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, blockCourier, unblockCourier } = require('../Controllers/settingsController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

router.get('/', getSettings);
router.put('/', protectAdmin, updateSettings);
router.post('/blocked-couriers', protectAdmin, blockCourier);
router.delete('/blocked-couriers/:courierId', protectAdmin, unblockCourier);

module.exports = router;
