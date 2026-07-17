const express = require('express');
const router = express.Router();
const { getPolicies, updatePolicy } = require('../Controllers/legalController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

router.get('/', getPolicies);
router.put('/', protectAdmin, updatePolicy);

module.exports = router;
