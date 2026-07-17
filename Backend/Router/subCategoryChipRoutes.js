const express = require('express');
const router = express.Router();
const {
  getSubCategoryChips,
  createSubCategoryChip,
  updateSubCategoryChip,
  deleteSubCategoryChip
} = require('../Controllers/subCategoryChipController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { uploadImage, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

// Public route to list subchips
router.get('/', getSubCategoryChips);

// Admin protected routes
router.post('/', protectAdmin, uploadImage, processImage, handleUploadError, createSubCategoryChip);
router.put('/:id', protectAdmin, uploadImage, processImage, handleUploadError, updateSubCategoryChip);
router.delete('/:id', protectAdmin, deleteSubCategoryChip);

module.exports = router;
