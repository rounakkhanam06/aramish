const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../Controllers/settingsController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

router.get('/', getSettings);
router.put('/', protectAdmin, updateSettings);

module.exports = router;
