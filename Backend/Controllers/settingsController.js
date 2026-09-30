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

    // Wallet/reward rules: validated here, applied by utils/walletService to all future
    // transactions. Whole-coin amounts and 0-100 percentages.
    const walletRuleLimits = {
      welcomeBonusCoins: { label: 'Welcome bonus', integer: true },
      referralRewardPerOrder: { label: 'Referral reward per order', integer: true },
      orderRewardPercentage: { label: 'Order reward percentage', max: 100 },
      orderRewardMaxCap: { label: 'Order reward maximum cap', integer: true },
      walletRedemptionPercentage: { label: 'Wallet redemption percentage', max: 100 }
    };
    for (const [key, rule] of Object.entries(walletRuleLimits)) {
      if (req.body[key] === undefined) continue;
      const n = Number(req.body[key]);
      if (req.body[key] === '' || !Number.isFinite(n) || n < 0 || (rule.max !== undefined && n > rule.max) || (rule.integer && !Number.isInteger(n))) {
        const expected = rule.integer ? 'a whole number of coins (0 or more)' : `a number between 0 and ${rule.max}`;
        return res.status(400).json({ success: false, message: `${rule.label} must be ${expected}` });
      }
    }

    const fields = [
      'platformName', 'supportEmail', 'helpline', 'currency',
      'commission', 'gstNo', 'gstPercentage', 'returnWindowDays',
      'welcomeBonusCoins', 'rewardCoinsEnabled', 'marqueeEnabled', 'walletEnabled',
      'referralRewardPerOrder', 'orderRewardPercentage', 'orderRewardMaxCap', 'walletRedemptionPercentage', 'referralEnabled',
      'crazyDealsHeaderName', 'showCrazyDealsTimer', 'crazyDealsDuration',
      'featuredCollectionHeaderName', 'showFeaturedCollectionTimer', 'featuredCollectionDuration',
      'newArrivalsHeaderName', 'showNewArrivalsTimer', 'newArrivalsDuration',
      'codChargeEnabled', 'codChargeAmount', 'prepaidDiscountEnabled', 'prepaidDiscountAmount', 'welcomeBonusEnabled'
    ];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if ([
          'commission', 'gstPercentage',
          'returnWindowDays', 'welcomeBonusCoins', 'crazyDealsDuration', 'featuredCollectionDuration', 'newArrivalsDuration',
          'codChargeAmount', 'prepaidDiscountAmount',
          'referralRewardPerOrder', 'orderRewardPercentage', 'orderRewardMaxCap', 'walletRedemptionPercentage'
        ].includes(f)) {
          config[f] = Number(req.body[f]);
        } else if (['rewardCoinsEnabled', 'marqueeEnabled', 'walletEnabled', 'referralEnabled', 'showCrazyDealsTimer', 'showFeaturedCollectionTimer', 'showNewArrivalsTimer', 'codChargeEnabled', 'prepaidDiscountEnabled', 'welcomeBonusEnabled'].includes(f)) {
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
