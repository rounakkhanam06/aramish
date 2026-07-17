const express = require('express');
const router = express.Router();
const {
  getCategoryChips,
  createCategoryChip,
  updateCategoryChip,
  deleteCategoryChip
} = require('../Controllers/categoryChipController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { uploadImage, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

// Public route to list chips
router.get('/', getCategoryChips);

// Admin protected routes
router.post('/', protectAdmin, uploadImage, processImage, handleUploadError, createCategoryChip);
router.put('/:id', protectAdmin, uploadImage, processImage, handleUploadError, updateCategoryChip);
router.delete('/:id', protectAdmin, deleteCategoryChip);

module.exports = router;
