const express = require('express');
const router = express.Router();
const {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  publishBanners
} = require('../Controllers/bannerController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { uploadImage, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const { getImageUrl } = require('../utils/imageHelper');

// Public route to list banners
router.get('/', getBanners);

// Admin protected routes
router.post('/upload', protectAdmin, uploadImage, processImage, handleUploadError, (req, res) => {
  if (req.file) {
    return res.status(200).json({ success: true, url: getImageUrl(req.file.url) });
  }
  res.status(400).json({ success: false, message: 'File upload failed' });
});
router.post('/publish', protectAdmin, publishBanners);

router.post('/', protectAdmin, uploadImage, processImage, handleUploadError, createBanner);
router.put('/:id', protectAdmin, uploadImage, processImage, handleUploadError, updateBanner);
router.delete('/:id', protectAdmin, deleteBanner);

module.exports = router;
