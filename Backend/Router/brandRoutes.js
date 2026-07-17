const express = require('express');
const router = express.Router();
const {
  getBrands,
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  getBrandDetailsAndProducts
} = require('../Controllers/brandController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { uploadBrandFiles, processBrandFiles, handleUploadError } = require('../Middlewares/uploadMiddleware');

// Public routes
router.get('/', getBrands);
router.get('/:id', getBrandById);
router.get('/:brandId/products', getBrandDetailsAndProducts);

// Admin protected routes
router.get('/all/admin', protectAdmin, getAllBrands); // URL changed slightly to distinguish from getBrandById wildcard
router.post('/', protectAdmin, uploadBrandFiles, processBrandFiles, handleUploadError, createBrand);
router.put('/:id', protectAdmin, uploadBrandFiles, processBrandFiles, handleUploadError, updateBrand);
router.delete('/:id', protectAdmin, deleteBrand);

module.exports = router;
