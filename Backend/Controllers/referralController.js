const User = require('../Models/User');
const Referral = require('../Models/Referral');
const CoinTransaction = require('../Models/CoinTransaction');

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

    const SystemConfig = require('../Models/SystemConfig');
    const systemConfig = await SystemConfig.findOne({});
    const coinsPerReferral = systemConfig && systemConfig.referralCoinsReferrer !== undefined ? systemConfig.referralCoinsReferrer : 100;
    const maxUsagePercentage = systemConfig && systemConfig.referralWalletMaxUsagePercentage !== undefined ? systemConfig.referralWalletMaxUsagePercentage : 25;
    
    const stats = {
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter(r => r.status === 'pending').length,
      completedReferrals: referrals.filter(r => r.status !== 'pending').length,
      totalCoinsEarned: user.referralCoins || 0,
      coinsPerReferral,
      maxUsagePercentage
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
          status: referralRecord?.status || 'rewarded',
          coinsAwarded: referralRecord?.refereeCoinsAwarded || 0,
          createdAt: referralRecord?.createdAt || null
        };
      }
    }

    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      referralCoins: user.referralCoins || 0,
      hasAppliedCode: !!user.referredBy,
      referredBy: referredByInfo,
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

// Helper: credit referral coins to both sides, log transactions, and notify.
// Shared by the instant "reward on signup" path and the "reward on first order" path
// so both timing modes go through the exact same crediting code.
const creditReferralCoins = async ({ referrerId, refereeId, referrerCoins, refereeCoins, refereeDisplayName, referralCode, instant }) => {
  if (referrerCoins > 0) {
    await User.findByIdAndUpdate(referrerId, { $inc: { referralCoins: referrerCoins } });
    await CoinTransaction.create({
      userId: referrerId,
      type: 'earned',
      title: `Referral Reward (Invited ${refereeDisplayName})`,
      amount: referrerCoins
    });
  }

  if (refereeCoins > 0) {
    await User.findByIdAndUpdate(refereeId, { $inc: { referralCoins: refereeCoins } });
    await CoinTransaction.create({
      userId: refereeId,
      type: 'earned',
      title: `Referral Reward (Signed up with code ${referralCode})`,
      amount: refereeCoins
    });
  }

  try {
    const Notification = require('../Models/Notification');
    const { sendNotificationToUser } = require('../Router/firebaseAdmin');

    if (referrerCoins > 0) {
      const referrerNotif = new Notification({
        title: 'Referral Reward Credited! 🎉',
        body: instant
          ? `Your friend ${refereeDisplayName} joined using your code. You earned ${referrerCoins} coins!`
          : `Your friend ${refereeDisplayName} placed their first order. You earned ${referrerCoins} coins!`,
        target: 'Selected Users',
        targetUserIds: [referrerId],
        status: 'Delivered'
      });
      await referrerNotif.save();
      await sendNotificationToUser(referrerId, { title: referrerNotif.title, body: referrerNotif.body });
    }

    if (refereeCoins > 0) {
      const refereeNotif = new Notification({
        title: 'Welcome Reward Credited! 🎁',
        body: `You joined using code ${referralCode}. You earned ${refereeCoins} welcome coins!`,
        target: 'Selected Users',
        targetUserIds: [refereeId],
        status: 'Delivered'
      });
      await refereeNotif.save();
      await sendNotificationToUser(refereeId, { title: refereeNotif.title, body: refereeNotif.body });
    }
  } catch (notifErr) {
    console.error('Error sending referral notifications:', notifErr.message);
  }
};

// Helper: create the referral link between referrer and referee, honoring the admin's
// chosen reward timing (instant at signup, or deferred to the referee's first order).
// Used by both the OTP-signup flow and the standalone "apply code" endpoint so behavior
// is identical no matter how the code was submitted. Caller is responsible for setting
// `referee.referredBy` and saving the referee document — this only creates the Referral
// record and (for instant timing) credits the coins.
// Returns the reward timing that was applied ('signup' | 'first_order'), or null if a
// referral between this pair already exists (one-time assignment guard).
const registerReferral = async (referrer, referee) => {
  const existing = await Referral.findOne({ referrer: referrer._id, referee: referee._id });
  if (existing) return null;

  const SystemConfig = require('../Models/SystemConfig');
  const config = await SystemConfig.findOne({});
  const rewardTiming = config && config.referralRewardTiming === 'signup' ? 'signup' : 'first_order';
  const referrerCoins = config && config.referralCoinsReferrer !== undefined ? config.referralCoinsReferrer : 100;
  const refereeCoins = config && config.referralCoinsReferee !== undefined ? config.referralCoinsReferee : 100;

  if (rewardTiming === 'signup') {
    await Referral.create({
      referrer: referrer._id,
      referee: referee._id,
      referralCode: referrer.referralCode,
      status: 'rewarded',
      completedAt: new Date(),
      referrerCoinsAwarded: referrerCoins,
      refereeCoinsAwarded: refereeCoins
    });

    await creditReferralCoins({
      referrerId: referrer._id,
      refereeId: referee._id,
      referrerCoins,
      refereeCoins,
      refereeDisplayName: referee.name || referee.phone,
      referralCode: referrer.referralCode,
      instant: true
    });
  } else {
    // Reward deferred — coins are credited later by completeReferral() on first delivered order
    await Referral.create({
      referrer: referrer._id,
      referee: referee._id,
      referralCode: referrer.referralCode,
      status: 'pending'
    });
  }

  return rewardTiming;
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

    const { referrer, error } = await validateReferralCode(code, referee._id);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const rewardTiming = await registerReferral(referrer, referee);
    if (!rewardTiming) {
      return res.status(400).json({ success: false, message: 'This referral has already been registered' });
    }

    referee.referredBy = referrer._id;
    await referee.save();

    res.status(200).json({
      success: true,
      referrerName: referrer.name || 'Friend',
      referrerCode: referrer.referralCode,
      message: rewardTiming === 'signup'
        ? `Referral code applied! You were referred by ${referrer.name || 'a friend'}. Coins credited!`
        : `Referral code applied! You were referred by ${referrer.name || 'a friend'}. Coins will be credited after your first order.`
    });
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

    // Atomically claim the pending referral so concurrent/duplicate calls (e.g. retried
    // webhooks) can never credit the same referral twice. Referrals already rewarded at
    // signup (rewardTiming: 'signup') are not 'pending', so this is a no-op for them.
    const referral = await Referral.findOneAndUpdate(
      { referee: userId, status: 'pending' },
      {
        $set: {
          status: 'rewarded',
          completedAt: new Date(),
          referrerCoinsAwarded: finalReferrerCoins,
          refereeCoinsAwarded: finalRefereeCoins
        }
      }
    );
    // findOneAndUpdate returns the pre-update doc; null means it was already claimed or never existed
    if (!referral) return;

    await creditReferralCoins({
      referrerId: referral.referrer,
      refereeId: userId,
      referrerCoins: finalReferrerCoins,
      refereeCoins: finalRefereeCoins,
      refereeDisplayName: user.name || user.phone,
      referralCode: referral.referralCode,
      instant: false
    });
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
        referralEnabled: config.referralEnabled !== false,
        referralWalletMaxUsagePercentage: config.referralWalletMaxUsagePercentage !== undefined ? config.referralWalletMaxUsagePercentage : 25,
        referralRewardTiming: config.referralRewardTiming === 'signup' ? 'signup' : 'first_order'
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
    const { referralCoinsPerReferral, referralCoinsReferrer, referralCoinsReferee, referralEnabled, referralWalletMaxUsagePercentage, referralRewardTiming } = req.body;
    const SystemConfig = require('../Models/SystemConfig');
    let config = await SystemConfig.findOne({});
    if (!config) config = new SystemConfig();

    if (referralCoinsPerReferral !== undefined) config.referralCoinsPerReferral = Number(referralCoinsPerReferral);
    if (referralCoinsReferrer !== undefined) config.referralCoinsReferrer = Number(referralCoinsReferrer);
    if (referralCoinsReferee !== undefined) config.referralCoinsReferee = Number(referralCoinsReferee);
    if (referralEnabled !== undefined) config.referralEnabled = referralEnabled;
    if (referralWalletMaxUsagePercentage !== undefined) config.referralWalletMaxUsagePercentage = Number(referralWalletMaxUsagePercentage);
    if (referralRewardTiming !== undefined) config.referralRewardTiming = referralRewardTiming === 'signup' ? 'signup' : 'first_order';

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
  validateReferralCode,
  adminGetAllReferrals,
  getConfig,
  updateConfig
};
