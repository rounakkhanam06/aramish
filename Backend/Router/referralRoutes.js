const express = require('express');
const router = express.Router();
const { getMyReferral, applyReferralCode } = require('../Controllers/referralController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

router.use(protectUser);

router.get('/me', getMyReferral);
router.post('/apply', applyReferralCode);

module.exports = router;
