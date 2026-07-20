const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadCSV = multer({ storage: multer.memoryStorage() });
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  getTopBuys,
  getTrendingBrands,
  getCombinedCatalog,
  bulkUploadProducts,
  downloadTemplate
} = require('../Controllers/productController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { uploadImagesAny, processImages, handleUploadError } = require('../Middlewares/uploadMiddleware');

// Public routes to list products/brands
router.get('/', getProducts);
router.get('/combined', getCombinedCatalog);
router.get('/top-buys', getTopBuys);
router.get('/trending-brands', getTrendingBrands);
router.get('/download-template', protectAdmin, downloadTemplate);
router.get('/:id', getProductById);

// Admin protected routes
router.post('/bulk-upload', protectAdmin, uploadCSV.single('file'), bulkUploadProducts);
router.post('/', protectAdmin, uploadImagesAny, processImages, handleUploadError, createProduct);
router.post('/bulk-delete', protectAdmin, bulkDeleteProducts);
router.put('/:id', protectAdmin, uploadImagesAny, processImages, handleUploadError, updateProduct);
router.delete('/:id', protectAdmin, deleteProduct);

module.exports = router;
