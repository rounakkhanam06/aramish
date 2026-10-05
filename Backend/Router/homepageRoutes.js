const express = require('express');
const router = express.Router();
const { getHomepageData } = require('../Controllers/productController');
const { cachePublicCatalog } = require('../utils/catalogCache');

// Public route to get all catalog and homepage details in one request (cached briefly)
router.get('/', cachePublicCatalog, getHomepageData);

module.exports = router;
