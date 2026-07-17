const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  createReel,
  createAdminReel,
  getReels,
  adminGetReels,
  adminUpdateReelStatus,
  adminDeleteReel,
  likeReel,
  commentReel,
  updateReelComment,
  deleteReelComment,
  incrementViews,
  checkEligibility
} = require('../Controllers/reelController');

const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { protectAdmin } = require('../Middlewares/authMiddleware');

// Setup video file disk storage
const uploadDir = path.join(__dirname, '../uploads/videos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `video-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'), false);
  }
};

const uploadVideo = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB max limit
  },
  fileFilter: fileFilter
});

// Public routes
router.get('/', getReels);
router.post('/:id/view', incrementViews);

// User protected routes
router.get('/check-eligibility', protectUser, checkEligibility);
router.post('/', protectUser, uploadVideo.single('video'), createReel);
router.post('/:id/like', protectUser, likeReel);
router.post('/:id/comment', protectUser, commentReel);
router.put('/:id/comment/:commentId', protectUser, updateReelComment);
router.delete('/:id/comment/:commentId', protectUser, deleteReelComment);

// Admin protected routes
router.get('/admin/all', protectAdmin, adminGetReels);
router.post('/admin/upload', protectAdmin, uploadVideo.single('video'), createAdminReel);
router.put('/admin/:id/status', protectAdmin, adminUpdateReelStatus);
router.delete('/admin/:id', protectAdmin, adminDeleteReel);

module.exports = router;
