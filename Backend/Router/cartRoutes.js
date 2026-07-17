const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart
} = require('../Controllers/cartController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

// Apply protection middleware to all cart routes
router.use(protectUser);

router.route('/')
  .get(getCart)
  .post(addToCart)
  .put(updateCartQuantity)
  .delete(clearCart);

router.route('/:productId')
  .delete(removeFromCart);

module.exports = router;
