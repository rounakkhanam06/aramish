const Address = require('../Models/Address');
const { resolveState } = require('../utils/gstData');

// Customer's state (GST place of supply): stored as the canonical state name. undefined = not sent.
const cleanState = (state) => {
  if (state === undefined || state === null || state === '') return { value: undefined };
  const resolved = resolveState(state);
  return resolved ? { value: resolved.name } : { error: 'Please select a valid state' };
};

// @desc    Get user addresses
// @route   GET /api/addresses
// @access  Private
const getAddresses = async (req, res) => {
  try {
    // Sort so default address comes first, then by date
    const addresses = await Address.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new address
// @route   POST /api/addresses
// @access  Private
const createAddress = async (req, res) => {
  try {
    let { name, phone, type, address, pincode, isDefault } = req.body;
    const state = cleanState(req.body.state);
    if (state.error) {
      return res.status(400).json({ success: false, message: state.error });
    }

    // Fallback to logged-in user phone if not explicitly provided
    if (!phone && req.user && req.user.phone) {
      phone = req.user.phone;
    }
    if (phone) {
      phone = phone.toString().replace(/\D/g, '').slice(-10);
    }

    if (!name || !phone || !address) {
      return res.status(400).json({ success: false, message: 'Please provide name, phone, and address' });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits' });
    }

    // If making this default, unset others
    if (isDefault) {
      await Address.updateMany({ userId: req.user._id }, { isDefault: false });
    } else {
      // If no addresses exist, make this default automatically
      const count = await Address.countDocuments({ userId: req.user._id });
      if (count === 0) {
        req.body.isDefault = true;
      }
    }

    const newAddress = await Address.create({
      userId: req.user._id,
      name,
      phone,
      type: type || 'Home',
      address,
      pincode: pincode || '',
      state: state.value,
      isDefault: isDefault || req.body.isDefault || false
    });

    res.status(201).json({ success: true, data: newAddress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update address
// @route   PUT /api/addresses/:id
// @access  Private
const updateAddress = async (req, res) => {
  try {
    const { name, phone, type, address, pincode, isDefault } = req.body;
    const state = cleanState(req.body.state);
    if (state.error) {
      return res.status(400).json({ success: false, message: state.error });
    }
    let existingAddress = await Address.findOne({ _id: req.params.id, userId: req.user._id });

    if (!existingAddress) {
      return res.status(404).json({ success: false, message: 'Address not found or unauthorized' });
    }

    let cleanPhone = phone;
    if (cleanPhone) {
      cleanPhone = cleanPhone.toString().replace(/\D/g, '').slice(-10);
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits' });
      }
    }

    if (isDefault) {
      await Address.updateMany({ userId: req.user._id, _id: { $ne: existingAddress._id } }, { isDefault: false });
    }

    existingAddress.name = name || existingAddress.name;
    existingAddress.phone = cleanPhone || existingAddress.phone;
    existingAddress.type = type || existingAddress.type;
    existingAddress.address = address || existingAddress.address;
    if (pincode !== undefined) existingAddress.pincode = pincode;
    if (state.value !== undefined) existingAddress.state = state.value;
    if (isDefault !== undefined) existingAddress.isDefault = isDefault;

    const updatedAddress = await existingAddress.save();
    res.status(200).json({ success: true, data: updatedAddress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete address
// @route   DELETE /api/addresses/:id
// @access  Private
const deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found or unauthorized' });
    }

    res.status(200).json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress
};
