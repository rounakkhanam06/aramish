const User = require('../Models/User');
const Referral = require('../Models/Referral');
const CoinTransaction = require('../Models/CoinTransaction');

// Helper: generate unique 8-char code from user's name/phone
const generateReferralCode = (user) => {
  const base = (user.name || user.phone || 'ARAMISH').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${suffix}`;
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

    const stats = {
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter(r => r.status === 'pending').length,
      completedReferrals: referrals.filter(r => r.status !== 'pending').length,
      totalCoinsEarned: user.referralCoins || 0,
    };

    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      referralCoins: user.referralCoins || 0,
      stats,
      referrals: referrals.map(r => ({
        id: r._id,
        referee: r.referee ? { name: r.referee.name || 'New User', phone: r.referee.phone } : null,
        status: r.status,
        coinsEarned: r.referrerCoinsAwarded,
        createdAt: r.createdAt,
        completedAt: r.completedAt
      }))
    });
  } catch (error) {
    console.error('Get Referral Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Apply a referral code (called during/after signup)
// @route   POST /api/referral/apply
// @access  Private (User)
const applyReferralCode = async (req, res) => {
  try {
    const { code } = req.body;
    const referee = await User.findById(req.user._id);

    if (!code) {
      return res.status(400).json({ success: false, message: 'Referral code is required' });
    }

    if (referee.referredBy) {
      return res.status(400).json({ success: false, message: 'You have already used a referral code' });
    }

    // Find referrer
    const referrer = await User.findOne({ referralCode: code.toUpperCase() });
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }

    if (referrer._id.equals(referee._id)) {
      return res.status(400).json({ success: false, message: 'You cannot use your own referral code' });
    }

    // Check if already referred
    const existing = await Referral.findOne({ referrer: referrer._id, referee: referee._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This referral has already been registered' });
    }

    // Create referral record (pending until first order)
    await Referral.create({
      referrer: referrer._id,
      referee: referee._id,
      referralCode: code.toUpperCase(),
      status: 'pending'
    });

    // Mark referee as referred
    referee.referredBy = referrer._id;
    await referee.save();

    res.status(200).json({ success: true, message: 'Referral code applied successfully! Coins will be credited after your first order.' });
  } catch (error) {
    console.error('Apply Referral Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Complete referral & award coins (called when first order placed)
// @route   POST /api/referral/complete
// @access  Private (User) — called internally
const completeReferral = async (userId, referrerCoins = 100, refereeCoins = 100) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.referredBy) return;

    // Load actual config to get latest values
    const SystemConfig = require('../Models/SystemConfig');
    const config = await SystemConfig.findOne({});
    const finalReferrerCoins = config && config.referralCoinsReferrer !== undefined ? config.referralCoinsReferrer : referrerCoins;
    const finalRefereeCoins = config && config.referralCoinsReferee !== undefined ? config.referralCoinsReferee : refereeCoins;

    // Find pending referral
    const referral = await Referral.findOne({ referee: userId, status: 'pending' });
    if (!referral) return;

    referral.status = 'rewarded';
    referral.completedAt = new Date();
    referral.referrerCoinsAwarded = finalReferrerCoins;
    referral.refereeCoinsAwarded = finalRefereeCoins;
    await referral.save();

    // Credit coins to referrer
    await User.findByIdAndUpdate(referral.referrer, {
      $inc: { referralCoins: finalReferrerCoins }
    });
    await CoinTransaction.create({
      userId: referral.referrer,
      type: 'earned',
      title: `Referral Reward (Invited ${user.name || user.phone})`,
      amount: finalReferrerCoins
    });

    // Credit coins to referee
    await User.findByIdAndUpdate(userId, {
      $inc: { referralCoins: finalRefereeCoins }
    });
    await CoinTransaction.create({
      userId: userId,
      type: 'earned',
      title: `Referral Reward (Signed up with code ${referral.referralCode})`,
      amount: finalRefereeCoins
    });

    // Create notification and send push for Referrer
    try {
      const Notification = require('../Models/Notification');
      const { sendNotificationToUser } = require('../Router/firebaseAdmin');

      const referrerNotif = new Notification({
        title: 'Referral Reward Credited! 🎉',
        body: `Your friend ${user.name || user.phone} placed their first order. You earned ${finalReferrerCoins} coins!`,
        target: 'Selected Users',
        targetUserIds: [referral.referrer],
        status: 'Delivered'
      });
      await referrerNotif.save();
      await sendNotificationToUser(referral.referrer, {
        title: referrerNotif.title,
        body: referrerNotif.body
      });
    } catch (notifErr) {
      console.error('Error sending referral referrer notification:', notifErr.message);
    }

    // Create notification and send push for Referee
    try {
      const Notification = require('../Models/Notification');
      const { sendNotificationToUser } = require('../Router/firebaseAdmin');

      const refereeNotif = new Notification({
        title: 'Welcome Reward Credited! 🎁',
        body: `You joined using code ${referral.referralCode}. You earned ${finalRefereeCoins} welcome coins!`,
        target: 'Selected Users',
        targetUserIds: [userId],
        status: 'Delivered'
      });
      await refereeNotif.save();
      await sendNotificationToUser(userId, {
        title: refereeNotif.title,
        body: refereeNotif.body
      });
    } catch (notifErr) {
      console.error('Error sending referral referee notification:', notifErr.message);
    }
  } catch (err) {
    console.error('Complete Referral Error:', err);
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
        .populate('referrer', 'name phone referralCode referralCoins')
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
        totalCoins: { $sum: '$referrerCoinsAwarded' }
      }}
    ]);

    const statsMap = { pending: 0, completed: 0, rewarded: 0, totalCoins: 0 };
    stats.forEach(s => {
      statsMap[s._id] = s.count;
      statsMap.totalCoins += s.totalCoins;
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
    const SystemConfig = require('../Models/SystemConfig');
    let config = await SystemConfig.findOne({});
    if (!config) {
      config = await new SystemConfig().save();
    }
    res.status(200).json({
      success: true,
      config: {
        referralCoinsPerReferral: config.referralCoinsPerReferral || 100,
        referralCoinsReferrer: config.referralCoinsReferrer !== undefined ? config.referralCoinsReferrer : (config.referralCoinsPerReferral || 100),
        referralCoinsReferee: config.referralCoinsReferee !== undefined ? config.referralCoinsReferee : (config.referralCoinsPerReferral || 100),
        referralEnabled: config.referralEnabled !== false
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
    const { referralCoinsPerReferral, referralCoinsReferrer, referralCoinsReferee, referralEnabled } = req.body;
    const SystemConfig = require('../Models/SystemConfig');
    let config = await SystemConfig.findOne({});
    if (!config) config = new SystemConfig();

    if (referralCoinsPerReferral !== undefined) config.referralCoinsPerReferral = Number(referralCoinsPerReferral);
    if (referralCoinsReferrer !== undefined) config.referralCoinsReferrer = Number(referralCoinsReferrer);
    if (referralCoinsReferee !== undefined) config.referralCoinsReferee = Number(referralCoinsReferee);
    if (referralEnabled !== undefined) config.referralEnabled = referralEnabled;

    await config.save();
    res.status(200).json({ success: true, message: 'Referral config updated', config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyReferral,
  applyReferralCode,
  completeReferral,
  adminGetAllReferrals,
  getConfig,
  updateConfig
};
