const SystemConfig = require('../Models/SystemConfig');

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Public
const getSettings = async (req, res) => {
  try {
    let config = await SystemConfig.findOne({});
    if (!config) {
      config = new SystemConfig();
      await config.save();
    }
    res.status(200).json({ success: true, settings: config });
  } catch (error) {
    console.error('Get Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update system settings
// @route   PUT /api/admin/settings
// @access  Private (Admin)
const updateSettings = async (req, res) => {
  try {
    let config = await SystemConfig.findOne({});
    if (!config) {
      config = new SystemConfig();
    }

    const fields = [
      'platformName', 'supportEmail', 'helpline', 'currency',
      'commission', 'gstNo', 'gstPercentage',
      'coinConversionEnabled', 'coinsPerRupee', 'minimumRedeemCoins', 'maximumRedeemPerOrder'
    ];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (['commission', 'gstPercentage', 'coinsPerRupee', 'minimumRedeemCoins', 'maximumRedeemPerOrder'].includes(f)) {
          config[f] = Number(req.body[f]);
        } else if (f === 'coinConversionEnabled') {
          config[f] = req.body[f] === true || req.body[f] === 'true';
        } else {
          config[f] = req.body[f];
        }
      }
    });

    await config.save();
    res.status(200).json({ success: true, message: 'Settings updated successfully', settings: config });
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
