const express = require('express');
const router = express.Router();
const { getMyReferral, applyReferralCode } = require('../Controllers/referralController');
const { recordReferralClick, matchDeferredReferral } = require('../Controllers/deferredReferralController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

// Public: iOS deferred deep linking (the visitor has no account yet)
router.post('/deferred/click', recordReferralClick);
router.post('/deferred/match', matchDeferredReferral);

router.use(protectUser);

router.get('/me', getMyReferral);
router.post('/apply', applyReferralCode);

module.exports = router;
