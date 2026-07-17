const express = require('express');
const router = express.Router();
const { 
  getCoupons, 
  createCoupon, 
  toggleCouponStatus, 
  deleteCoupon,
  updateCoupon,
  validateCoupon,
  getUserCouponHistory
} = require('../Controllers/couponController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

// Get all coupons
router.get('/', getCoupons);
router.get('/history', protectUser, getUserCouponHistory);

// Validate coupon
router.post('/validate', protectUser, validateCoupon);

// Admin-only endpoints
router.post('/', protectAdmin, createCoupon);

router.put('/:id', protectAdmin, updateCoupon);
router.put('/:id/status', protectAdmin, toggleCouponStatus);
router.delete('/:id', protectAdmin, deleteCoupon);

module.exports = router;
