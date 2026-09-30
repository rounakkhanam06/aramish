const User = require('../Models/User');
const Referral = require('../Models/Referral');
const Order = require('../Models/Order');

// Helper: generate unique 8-char code from user's name/phone
const generateReferralCode = (user) => {
  const base = (user.name || user.phone || 'ARAMISH').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${suffix}`;
};

// Helper: validate a referral code (existence, active referrer, not self).
// Codes are treated case-insensitively; input is trimmed and uppercased before lookup.
// Returns { referrer, normalized } on success, or { error } on failure.
// Backend is the final authority here — this same check is used at signup and on the standalone apply endpoint.
const validateReferralCode = async (rawCode, refereeId) => {
  const normalized = (rawCode || '').trim().toUpperCase();
  if (!normalized) {
    return { error: 'Referral code is required' };
  }

  const SystemConfig = require('../Models/SystemConfig');
  const config = await SystemConfig.findOne({});
  if (config && config.referralEnabled === false) {
    return { error: 'Referral program is currently unavailable' };
  }

  const referrer = await User.findOne({ referralCode: normalized });
  if (!referrer) {
    return { error: 'Invalid referral code' };
  }

  if (referrer.status === 'Inactive') {
    return { error: 'This referral code is no longer active' };
  }

  if (refereeId && referrer._id.equals(refereeId)) {
    return { error: 'You cannot use your own referral code' };
  }

  return { referrer, normalized };
};

// @desc    Get my referral info (code, stats, history)
// @route   GET /api/referral/me
// @access  Private (User)
const getMyReferral = async (req, res) => {
  try {
    let user = await User.findById(req.user._id);

    // Auto-generate referral code if user doesn't have one
    if (!user.referralCode) {
      let code;
      let attempts = 0;
      do {
        code = generateReferralCode(user);
        const exists = await User.findOne({ referralCode: code });
        if (!exists) break;
        attempts++;
      } while (attempts < 10);

      user.referralCode = code;
      await user.save();
    }

    // Get referral history
    const referrals = await Referral.find({ referrer: user._id })
      .populate('referee', 'name phone createdAt')
      .sort({ createdAt: -1 });

    const { getWalletConfig, roundMoney } = require('../utils/walletService');
    const walletConfig = await getWalletConfig();

    const stats = {
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter(r => !(r.successfulOrders > 0) && r.status === 'pending').length,
      completedReferrals: referrals.filter(r => r.successfulOrders > 0 || r.status !== 'pending').length,
      successfulOrders: referrals.reduce((sum, r) => sum + (r.successfulOrders || 0), 0),
      // Coins earned from referrals — already part of the single wallet balance
      totalCoinsEarned: roundMoney(referrals.reduce((sum, r) => sum + (r.referrerCoinsAwarded || 0), 0)),
      coinsPerOrder: walletConfig.referralRewardPerOrder,
      coinsPerReferral: walletConfig.referralRewardPerOrder, // legacy key for older app builds
      maxUsagePercentage: walletConfig.walletRedemptionPercentage
    };

    let referredByInfo = null;
    if (user.referredBy) {
      const referrerUser = await User.findById(user.referredBy, 'name phone referralCode');
      const referralRecord = await Referral.findOne({ referee: user._id, referrer: user.referredBy });
      if (referrerUser) {
        referredByInfo = {
          id: referrerUser._id,
          name: referrerUser.name || 'Friend',
          phone: referrerUser.phone ? `${referrerUser.phone.slice(0, 2)}******${referrerUser.phone.slice(-2)}` : '',
          code: referralRecord?.referralCode || referrerUser.referralCode || '',
          status: referralRecord?.status || 'pending',
          createdAt: referralRecord?.createdAt || null
        };
      }
    }

    const hasOrdered = !!(await Order.exists({ userId: user._id }));

    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      hasAppliedCode: !!user.referredBy,
      hasOrdered,
      referredBy: referredByInfo,
      stats,
      referrals: referrals.map(r => ({
        id: r._id,
        referee: r.referee ? { name: r.referee.name || 'New User', phone: r.referee.phone } : null,
        status: r.status,
        coinsEarned: r.referrerCoinsAwarded,
        successfulOrders: r.successfulOrders || 0,
        createdAt: r.createdAt,
        completedAt: r.completedAt
      }))
    });
  } catch (error) {
    console.error('Get Referral Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper: create the referral link between referrer and referee. No coins are credited
// here — the referrer earns the configured reward for EVERY successful (delivered) order of
// the referee, credited by walletService.creditReferralReward. Used by both the OTP-signup
// flow and the standalone "apply code" endpoint. Caller sets `referee.referredBy` and saves
// the referee. Returns true when a new link was created, false if one already existed.
const registerReferral = async (referrer, referee) => {
  const existing = await Referral.findOne({ referrer: referrer._id, referee: referee._id });
  if (existing) return false;

  await Referral.create({
    referrer: referrer._id,
    referee: referee._id,
    referralCode: referrer.referralCode,
    status: 'pending'
  });
  return true;
};

// @desc    Apply a referral code (called during/after signup)
// @route   POST /api/referral/apply
// @access  Private (User)
const applyReferralCode = async (req, res) => {
  try {
    const { code } = req.body;
    const referee = await User.findById(req.user._id);

    // One-time assignment: once a referral relationship exists, it cannot be changed
    if (referee.referredBy) {
      return res.status(400).json({ success: false, message: 'You have already used a referral code' });
    }

    // Referral codes are only for new customers — once someone has placed an order, they can no longer apply one
    const hasOrdered = await Order.exists({ userId: referee._id });
    if (hasOrdered) {
      return res.status(400).json({ success: false, message: 'Referral codes can only be applied before your first order' });
    }

    const { referrer, error } = await validateReferralCode(code, referee._id);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const created = await registerReferral(referrer, referee);
    if (!created) {
      return res.status(400).json({ success: false, message: 'This referral has already been registered' });
    }

    referee.referredBy = referrer._id;
    await referee.save();

    res.status(200).json({
      success: true,
      referrerName: referrer.name || 'Friend',
      referrerCode: referrer.referralCode,
      message: `Referral code applied! You were referred by ${referrer.name || 'a friend'}.`
    });
  } catch (error) {
    console.error('Apply Referral Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN ROUTES ───────────────────────────────────────────────────────────

// @desc    Get all referrals (admin)
// @route   GET /api/admin/referrals
// @access  Private (Admin)
const adminGetAllReferrals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status;

    const query = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};

    const [referrals, total] = await Promise.all([
      Referral.find(query)
        .populate('referrer', 'name phone referralCode walletBalance')
        .populate('referee', 'name phone createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Referral.countDocuments(query)
    ]);

    const stats = await Referral.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCoins: { $sum: '$referrerCoinsAwarded' },
        successfulOrders: { $sum: { $ifNull: ['$successfulOrders', 0] } }
      }}
    ]);

    const statsMap = { pending: 0, completed: 0, rewarded: 0, totalCoins: 0, successfulOrders: 0 };
    stats.forEach(s => {
      statsMap[s._id] = s.count;
      statsMap.totalCoins += s.totalCoins;
      statsMap.successfulOrders += s.successfulOrders;
    });
    statsMap.total = total;

    res.status(200).json({
      success: true,
      referrals,
      stats: statsMap,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Admin Get Referrals Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get referral program config (from SystemConfig)
// @route   GET /api/admin/referrals/config
// @access  Private (Admin)
const getConfig = async (req, res) => {
  try {
    const { getWalletConfig } = require('../utils/walletService');
    const config = await getWalletConfig();
    res.status(200).json({
      success: true,
      config: {
        referralEnabled: config.referralEnabled,
        referralRewardPerOrder: config.referralRewardPerOrder
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update referral program config
// @route   PUT /api/admin/referrals/config
// @access  Private (Admin)
const updateConfig = async (req, res) => {
  try {
    const { referralEnabled, referralRewardPerOrder } = req.body;
    const SystemConfig = require('../Models/SystemConfig');
    let config = await SystemConfig.findOne({});
    if (!config) config = new SystemConfig();

    if (referralRewardPerOrder !== undefined) {
      const amount = Number(referralRewardPerOrder);
      if (referralRewardPerOrder === '' || referralRewardPerOrder === null || !Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
        return res.status(400).json({ success: false, message: 'Referral reward per order must be a whole number of coins (0 or more)' });
      }
      config.referralRewardPerOrder = amount;
    }
    if (referralEnabled !== undefined) config.referralEnabled = referralEnabled === true || referralEnabled === 'true';

    await config.save();
    res.status(200).json({
      success: true,
      message: 'Referral config updated',
      config: { referralEnabled: config.referralEnabled, referralRewardPerOrder: config.referralRewardPerOrder }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyReferral,
  applyReferralCode,
  registerReferral,
  validateReferralCode,
  adminGetAllReferrals,
  getConfig,
  updateConfig
};
