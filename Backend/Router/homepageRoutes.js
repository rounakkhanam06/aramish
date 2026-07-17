const express = require('express');
const router = express.Router();
const { getHomepageData } = require('../Controllers/productController');

// Public route to get all catalog and homepage details in one request
router.get('/', getHomepageData);

module.exports = router;
