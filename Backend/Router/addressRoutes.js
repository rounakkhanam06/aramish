const express = require('express');
const router = express.Router();
const {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress
} = require('../Controllers/addressController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

// Apply protection middleware to all address routes
router.use(protectUser);

router.route('/')
  .get(getAddresses)
  .post(createAddress);

router.route('/:id')
  .put(updateAddress)
  .delete(deleteAddress);

module.exports = router;
