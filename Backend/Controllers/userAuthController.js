const User = require('../Models/User');
const jwt = require('jsonwebtoken');
const { getImageUrl } = require('../utils/imageHelper');

const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_MAX_SENDS_PER_HOUR = 5;      // per phone number
const OTP_MAX_ATTEMPTS = 5;            // guesses per OTP before it is discarded
const ONE_HOUR_MS = 60 * 60 * 1000;

// Generate JWT Token
const generateToken = (id, phone, tokenVersion = 0) => {
  return jwt.sign(
    { id, phone, tokenVersion, aud: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Helper: Get OTP (can use static OTP for test phones in any env, or all phones in staging/dev)
const getOtp = (phone) => {
  const isStaging = process.env.ENV === 'staging' || process.env.ENV === 'development';
  const testPhones = (process.env.TEST_PHONE_NUMBERS || '').split(',').map(p => p.trim());

  if (isStaging) {
    return process.env.STATIC_OTP || '123456';
  }
  if (testPhones.includes(phone)) {
    return process.env.STATIC_OTP || '123456';
  }
  // Otherwise, random 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Send OTP to phone number
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    const phoneRegex = /^[0-9]{10}$/;
    if (!phone || !phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number is required' });
    }

    // Find or create user (auto-register logic)
    let user = await User.findOne({ phone });

    if (user && user.status === 'Inactive') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated by admin. Please contact support.' });
    }

    const isNewUser = !user || !user.isVerified;

    if (!user) {
      try {
        user = await User.create({ phone });
      } catch (createErr) {
        // Two first-time requests for the same number at once: the other one created it
        if (createErr.code !== 11000) throw createErr;
        user = await User.findOne({ phone });
      }
    }

    const otp = getOtp(phone);
    const now = new Date();
    const otpExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    // Store hash, not raw OTP
    const crypto = require('crypto');
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Start a new hourly send window once the previous one is over
    await User.updateOne(
      { _id: user._id, $or: [{ otpSendWindowStart: null }, { otpSendWindowStart: { $lte: new Date(now.getTime() - ONE_HOUR_MS) } }] },
      { $set: { otpSendCount: 0, otpSendWindowStart: now } }
    );

    // Claim the send atomically, so parallel requests can't each pass the resend cooldown or the
    // hourly cap and send extra SMS. The cooldown also stops the frontend timer being bypassed.
    const claimed = await User.findOneAndUpdate(
      {
        _id: user._id,
        otpSendCount: { $lt: OTP_MAX_SENDS_PER_HOUR },
        $or: [{ otpLastSentAt: null }, { otpLastSentAt: { $lte: new Date(now.getTime() - OTP_RESEND_COOLDOWN_SECONDS * 1000) } }]
      },
      {
        $inc: { otpSendCount: 1 },
        $set: { otp: otpHash, otpExpiry, otpLastSentAt: now, otpFailedAttempts: 0 }
      },
      { new: true }
    );

    if (!claimed) {
      const current = await User.findById(user._id).select('otpLastSentAt otpSendCount otpSendWindowStart').lean();
      const cooldownLeft = current?.otpLastSentAt
        ? Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - (now.getTime() - new Date(current.otpLastSentAt).getTime()) / 1000)
        : 0;
      if (cooldownLeft > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${cooldownLeft}s before requesting another OTP.`,
          secondsRemaining: cooldownLeft
        });
      }
      const windowStart = current?.otpSendWindowStart ? new Date(current.otpSendWindowStart).getTime() : now.getTime();
      const secondsRemaining = Math.max(1, Math.ceil((windowStart + ONE_HOUR_MS - now.getTime()) / 1000));
      return res.status(429).json({
        success: false,
        message: `Too many OTP requests for this number. Please try again in ${Math.ceil(secondsRemaining / 60)} minutes.`,
        secondsRemaining
      });
    }

    if (process.env.ENV !== 'production') {
      console.log(`📱 OTP for ${phone}: ${otp} [ENV: ${process.env.ENV}]`);
    }

    // In production, send SMS using SMS India Hub//
    if (process.env.ENV === 'production') {
      const testPhones = (process.env.TEST_PHONE_NUMBERS || '').split(',').map(p => p.trim());
      const isTestPhone = testPhones.includes(phone);

      if (isTestPhone) {
        console.log(`📱 Bypassing SMS sending for test phone ${phone} in production. OTP: ${otp}`);
      } else {
        const apiKey = process.env.SMS_INDIA_HUB_API_KEY || process.env.SMS_API_KEY;
        const senderId = process.env.SMS_INDIA_HUB_SENDER_ID || process.env.SMS_SENDER_ID || 'BGADEC';
        const peId = process.env.SMS_INDIA_HUB_PE_ID || process.env.SMS_PE_ID;
        const templateId = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID;
        const appName = process.env.SMS_INDIA_HUB_APP_NAME || 'aramish shoes';
        const rawUrl = process.env.SMS_INDIA_HUB_URL || 'http://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
        const gwid = process.env.SMS_INDIA_HUB_GWID || '2';
        const timeoutMs = parseInt(process.env.SMS_INDIA_HUB_TIMEOUT_MS, 10) || 10000;

        const templatePattern = process.env.SMS_INDIA_HUB_TEMPLATE_TEXT || 'Welcome to the ${appName} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC';
        const message = templatePattern
          .replace(/\$\{appName\}|\{appName\}/g, appName)
          .replace(/\$\{otp\}|\{otp\}/g, otp);
        const encodedMsg = encodeURIComponent(message);

        let smsUrl = `${rawUrl}?APIKey=${apiKey}&senderid=${senderId}&channel=Trans&DCS=0&flashsms=0&number=91${phone}&text=${encodedMsg}&route=0`;
        let maskedUrl = `${rawUrl}?APIKey=******&senderid=${senderId}&channel=Trans&DCS=0&flashsms=0&number=91${phone}&text=${encodedMsg}&route=0`;

        if (templateId) {
          smsUrl += `&DLTTemplateId=${templateId}`;
          maskedUrl += `&DLTTemplateId=${templateId}`;
        }
        if (peId) {
          smsUrl += `&PEId=${peId}`;
          maskedUrl += `&PEId=${peId}`;
        }

        console.log(`📡 Sending SMS via SMS India Hub to 91${phone}...`);
        console.log(`📡 Request URL (Masked): ${maskedUrl}`);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          const smsRes = await fetch(smsUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          const smsText = await smsRes.text();
          console.log(`📡 SMS India Hub Response:`, smsText);
        } catch (smsErr) {
          console.error('📡 SMS India Hub Error:', smsErr.name === 'AbortError' ? 'Request timed out' : smsErr.message);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: process.env.ENV === 'staging'
        ? `OTP sent (Staging: use ${process.env.STATIC_OTP || '123456'})`
        : 'OTP sent to your phone number',
      isNewUser,
      resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      // Only expose OTP in staging for dev convenience
      ...(process.env.ENV === 'staging' && { otp })
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Verify OTP and Login/Register
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, referralCode, name } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP required' });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found. Please request OTP first.' });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated by admin. Please contact support.' });
    }

    // Check OTP validity
    const crypto = require('crypto');
    const inputHash = crypto.createHash('sha256').update(String(otp)).digest('hex');

    if (!user.otp) {
      return res.status(401).json({ success: false, message: 'OTP expired or already used. Please request a new one.' });
    }

    // Reserve one guess before checking it. Doing this atomically caps the guesses per OTP at
    // OTP_MAX_ATTEMPTS even when many requests arrive at once (brute-force protection).
    const attempt = await User.findOneAndUpdate(
      { _id: user._id, otp: user.otp, otpFailedAttempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { otpFailedAttempts: 1 } },
      { new: true }
    );
    if (!attempt) {
      return res.status(429).json({ success: false, message: 'Too many wrong attempts. Please request a new OTP.' });
    }

    // Only the OTP generated by sendOtp is accepted. Test numbers (TEST_PHONE_NUMBERS) get
    // STATIC_OTP from getOtp, so there is no separate mock-OTP bypass here.
    if (user.otp !== inputHash) {
      console.log(`❌ OTP Verification failed for ${phone}`);
      const attemptsLeft = OTP_MAX_ATTEMPTS - attempt.otpFailedAttempts;
      if (attemptsLeft <= 0) {
        // Out of guesses: discard this OTP so it can't be tried any further
        await User.updateOne({ _id: user._id, otp: user.otp }, { $set: { otp: null, otpExpiry: null } });
        return res.status(429).json({ success: false, message: 'Too many wrong attempts. Please request a new OTP.' });
      }
      return res.status(401).json({
        success: false,
        message: `Invalid OTP. ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`,
        attemptsLeft
      });
    }

    if (user.otpExpiry && new Date() > user.otpExpiry) {
      return res.status(401).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    // Mark verified, clear OTP
    const isNewUser = !user.isVerified;

    // Referral code is optional. If it fails validation (unknown, inactive referrer, self),
    // signup still completes — the referral just isn't linked.
    let referrer = null;
    let referralError = null;
    if ((isNewUser || !user.referredBy) && referralCode && referralCode.trim()) {
      const { validateReferralCode } = require('./referralController');
      const result = await validateReferralCode(referralCode, user._id);
      if (result.error) {
        referralError = result.error;
        console.log(`⚠️ Referral code "${referralCode}" not applied for ${phone}: ${result.error}`);
      } else {
        referrer = result.referrer;
      }
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    user.otpFailedAttempts = 0;
    user.lastLogin = new Date();
    if (name && typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }

    // Link the referral relationship (one-time, at signup/first-login).
    if (referrer) {
      try {
        const { registerReferral } = require('./referralController');
        const linked = await registerReferral(referrer, user);
        if (linked) {
          user.referredBy = referrer._id;
          console.log(`🔗 Referral successfully linked: ${referrer.phone} (${referrer.referralCode}) -> ${user.phone}`);
        }
      } catch (refErr) {
        console.error('Auto referral link error during registration:', refErr.message);
      }
    }

    await user.save();

    // Welcome Bonus (only once, admin-configurable amount) into the single combined wallet
    if (!user.welcomeBonusGiven) {
      try {
        const { creditWelcomeBonus } = require('../utils/walletService');
        const result = await creditWelcomeBonus(user._id);
        if (result.success) console.log(`🎁 Welcome bonus of ${result.amount} credited to user ${user._id}`);
      } catch (wbErr) {
        console.error('❌ Error processing welcome bonus:', wbErr.message);
      }
    }

    const token = generateToken(user._id, user.phone, user.tokenVersion);

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created & logged in!' : 'Login successful!',
      isNewUser,
      ...(referralError && { referralError }),
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        gender: user.gender,
        dob: user.dob,
        joinedAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-otp -otpExpiry');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update current logged in user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, dob, gender } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) {
      const emailExists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user.id } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'This email address is already in use by another account.' });
      }
      user.email = email.toLowerCase();
    }
    if (phone !== undefined) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
      }
      const phoneExists = await User.findOne({ phone, _id: { $ne: req.user.id } });
      if (phoneExists) {
        return res.status(400).json({ success: false, message: 'This phone number is already in use by another account.' });
      }
      user.phone = phone;
    }
    if (dob !== undefined) user.dob = dob;

    if (gender !== undefined) {
      if (gender === 'male' || gender === 'Male') user.gender = 'Male';
      else if (gender === 'female' || gender === 'Female') user.gender = 'Female';
      else if (gender === 'other' || gender === 'Other') user.gender = 'Other';
      else user.gender = null;
    }

    if (req.file) {
      user.avatar = getImageUrl(req.file.url);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: getImageUrl(user.avatar),
        gender: user.gender,
        dob: user.dob,
        joinedAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Change / set password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If user already has a password, verify the current one
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required' });
      }
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    user.password = newPassword; // will be hashed by pre-save hook
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Single combined wallet: balance, locked/available split, and full history.
//          All numbers are calculated by walletService — the app only displays them.
const getWallet = async (req, res) => {
  try {
    const WalletTransaction = require('../Models/WalletTransaction');
    const Order = require('../Models/Order');
    const walletService = require('../utils/walletService');

    const user = await User.findById(req.user.id, '_id').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const config = await walletService.getWalletConfig();
    const summary = await walletService.getWalletSummary(req.user.id, { config });

    const [walletTransactions, refundWalletTxns, refundWalletBalance] = await Promise.all([
      // Main wallet (coins). Legacy entries have no `wallet` field and belong here.
      WalletTransaction.find({ userId: req.user.id, wallet: { $ne: 'REFUND' } }).sort({ createdAt: -1 }).lean(),
      WalletTransaction.find({ userId: req.user.id, wallet: 'REFUND' }).sort({ createdAt: -1 }).lean(),
      walletService.getRefundWalletBalance(req.user.id)
    ]);

    // Per-entry lock state for reward credits (locked while the order's return window is
    // open or a return is pending; withdrawn if the order was returned/refunded).
    const rewardOrderIds = walletTransactions
      .filter(w => ['ORDER_REWARD', 'REFERRAL_REWARD'].includes(w.type) && w.orderId)
      .map(w => w.orderId);
    const rewardOrders = rewardOrderIds.length
      ? await Order.find({ _id: { $in: rewardOrderIds } }, 'status rewardCreditedAt rewardDeducted referralRewardCreditedAt referralRewardReversed').lean()
      : [];
    const orderMap = new Map(rewardOrders.map(o => [o._id.toString(), o]));

    const rewardState = (w) => {
      if (!['ORDER_REWARD', 'REFERRAL_REWARD'].includes(w.type)) return null;
      const o = w.orderId && orderMap.get(w.orderId.toString());
      if (!o) return 'UNLOCKED';
      const isOwn = w.type === 'ORDER_REWARD';
      if (isOwn ? o.rewardDeducted : o.referralRewardReversed) return 'WITHDRAWN';
      const creditedAt = isOwn ? o.rewardCreditedAt : o.referralRewardCreditedAt;
      return walletService.isRewardLocked(o, creditedAt || w.createdAt, config) ? 'LOCKED' : 'UNLOCKED';
    };

    // Earned totals per source (for display/reporting); the balance itself is one number.
    const earnedBySource = { WELCOME_BONUS: 0, REFERRAL_REWARD: 0, ORDER_REWARD: 0, GAME_REWARD: 0, REFUND: 0 };
    for (const w of walletTransactions) {
      const source = walletService.getTransactionSource(w);
      if (source in earnedBySource) {
        earnedBySource[source] = walletService.roundMoney(earnedBySource[source] + (walletService.getTransactionDirection(w) === 'credit' ? Math.abs(w.amount) : -Math.abs(w.amount)));
      }
    }

    res.status(200).json({
      success: true,
      walletEnabled: config.walletEnabled,
      walletBalance: summary.walletBalance,
      lockedRewardCoins: summary.lockedBalance,
      availableWalletBalance: summary.availableBalance,
      walletRedemptionPercentage: config.walletRedemptionPercentage,
      earnedBySource,
      // Refund Wallet: actual refunded money, fully usable (no % limit), separate from coins
      refundWalletBalance,
      refundWalletTransactions: refundWalletTxns.map(w => ({
        id: w._id,
        wallet: 'REFUND',
        type: w.type,
        direction: walletService.getTransactionDirection(w),
        amount: Math.abs(w.amount),
        balanceAfter: w.balanceAfter,
        description: w.description,
        orderId: w.orderId,
        createdAt: w.createdAt
      })),
      walletTransactions: walletTransactions.map(w => {
        const state = rewardState(w);
        return {
          id: w._id,
          wallet: 'MAIN',
          type: w.type,
          source: walletService.getTransactionSource(w),
          direction: walletService.getTransactionDirection(w),
          amount: Math.abs(w.amount),
          balanceAfter: w.balanceAfter,
          status: w.status,
          description: w.description,
          orderId: w.orderId,
          unlocksAt: w.unlocksAt,
          rewardState: state,
          isLocked: state === 'LOCKED',
          createdAt: w.createdAt
        };
      })
    });
  } catch (error) {
    console.error('Get Wallet Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update FCM Token for user
// @route   PUT /auth/fcm-token
// @access  Private
const updateFcmToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM Token is required' });
    }

    const User = require('../Models/User');
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetField = (platform === 'app' || platform === 'mobile') ? 'fcmMobileTokens' : 'fcmWebTokens';
    if (!user[targetField]) {
      user[targetField] = [];
    }

    if (!user[targetField].includes(token)) {
      user[targetField].push(token);
      // Cap to most recent 10 tokens (oldest first = least used)
      if (user[targetField].length > 10) {
        user[targetField] = user[targetField].slice(-10);
      }
      await user.save();
    }

    res.status(200).json({ success: true, message: `FCM token registered for ${platform || 'web'} successfully` });
  } catch (error) {
    console.error('Update FCM Token Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Remove FCM Token for user (on logout)
// @route   DELETE /auth/fcm-token
// @access  Private
const removeFcmToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM Token is required' });
    }

    const User = require('../Models/User');
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetField = (platform === 'app' || platform === 'mobile') ? 'fcmMobileTokens' : 'fcmWebTokens';
    if (!user[targetField]) {
      user[targetField] = [];
    }

    user[targetField] = user[targetField].filter(t => t !== token);
    await user.save();

    res.status(200).json({ success: true, message: `FCM token removed for ${platform || 'web'} successfully` });
  } catch (error) {
    console.error('Remove FCM Token Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = { sendOtp, verifyOtp, getMe, updateProfile, changePassword, getWallet, updateFcmToken, removeFcmToken };

