const express = require('express');
const router = express.Router();
const { adminGetAllReferrals, getConfig, updateConfig } = require('../Controllers/referralController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

router.use(protectAdmin);

router.get('/', adminGetAllReferrals);
router.get('/config', getConfig);
router.put('/config', updateConfig);

module.exports = router;
