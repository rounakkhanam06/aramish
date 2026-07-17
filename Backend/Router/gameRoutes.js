const express = require('express');
const router = express.Router();

const {
  getGamesList,
  recordPlay,
  adminGetGames,
  adminCreateGame,
  adminUpdateGame,
  adminGetReports
} = require('../Controllers/gameController');

const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { protectAdmin } = require('../Middlewares/authMiddleware');

// User routes
router.get('/', protectUser, getGamesList);
router.post('/play', protectUser, recordPlay);

// Admin routes
router.get('/admin', protectAdmin, adminGetGames);
router.post('/admin', protectAdmin, adminCreateGame);
router.put('/admin/:id', protectAdmin, adminUpdateGame);
router.get('/admin/reports', protectAdmin, adminGetReports);

module.exports = router;
