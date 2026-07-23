const User = require('../Models/User');
const jwt = require('jsonwebtoken');
const { getImageUrl } = require('../utils/imageHelper');

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

    const isNewUser = !user;

    if (!user) {
      user = new User({ phone });
    }

    const otp = getOtp(phone);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store hash, not raw OTP
    const crypto = require('crypto');
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    user.otp = otpHash;
    user.otpExpiry = otpExpiry;
    await user.save();

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
        const apiKey = process.env.SMS_API_KEY;
        const senderId = process.env.SMS_SENDER_ID;
        const peId = process.env.SMS_PE_ID;
        const templateId = process.env.SMS_TEMPLATE_ID;
        const message = `Welcome to the Aramish powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;
        const encodedMsg = encodeURIComponent(message);

        let smsUrl = `https://cloud.smsindiahub.in/vendorsms/pushsms.aspx?APIKey=${apiKey}&msisdn=91${phone}&sid=${senderId}&msg=${encodedMsg}&fl=0&gwid=2`;
        let maskedUrl = `https://cloud.smsindiahub.in/vendorsms/pushsms.aspx?APIKey=******&msisdn=91${phone}&sid=${senderId}&msg=${encodedMsg}&fl=0&gwid=2`;

        if (peId) {
          smsUrl += `&EntityId=${peId}`;
          maskedUrl += `&EntityId=${peId}`;
        }
        if (templateId) {
          smsUrl += `&dlttemplateid=${templateId}`;
          maskedUrl += `&dlttemplateid=${templateId}`;
        }

        console.log(`📡 Sending SMS via SMS India Hub to 91${phone}...`);
        console.log(`📡 Request URL (Masked): ${maskedUrl}`);
        try {
          const smsRes = await fetch(smsUrl);
          const smsText = await smsRes.text();
          console.log(`📡 SMS India Hub Response:`, smsText);
        } catch (smsErr) {
          console.error('📡 SMS India Hub Error:', smsErr);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: process.env.ENV === 'staging'
        ? `OTP sent (Staging: use ${process.env.STATIC_OTP || '123456'})`
        : 'OTP sent to your phone number',
      isNewUser,
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
    const { phone, otp, referralCode } = req.body;

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
    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
    
    // Allow mock OTP '123456' for any user
    const isMockOtp = (otp === '123456');
    
    if (!isMockOtp && (!user.otp || user.otp !== inputHash)) {
      console.log(`❌ OTP Verification failed for ${phone}:`);
      console.log(`   - Input OTP: "${otp}"`);
      console.log(`   - Input Hash: "${inputHash}"`);
      console.log(`   - Stored Hash in DB: "${user.otp}"`);
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    if (!isMockOtp && user.otpExpiry && new Date() > user.otpExpiry) {
      return res.status(401).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    // Mark verified, clear OTP
    const isNewUser = !user.isVerified;
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    user.lastLogin = new Date();

    if (isNewUser && referralCode) {
      try {
        const uppercaseCode = referralCode.toUpperCase().trim();
        const referrer = await User.findOne({ referralCode: uppercaseCode });
        if (referrer && !referrer._id.equals(user._id)) {
          user.referredBy = referrer._id;
          
          const Referral = require('../Models/Referral');
          const existingReferral = await Referral.findOne({ referrer: referrer._id, referee: user._id });
          if (!existingReferral) {
            await Referral.create({
              referrer: referrer._id,
              referee: user._id,
              referralCode: uppercaseCode,
              status: 'pending'
            });
          }
        }
      } catch (refErr) {
        console.error('Auto referral link error during registration:', refErr.message);
      }
    }

    // Welcome Bonus Check (Only Once)
    if (!user.welcomeBonusGiven) {
      try {
        const SystemConfig = require('../Models/SystemConfig');
        const WalletTransaction = require('../Models/WalletTransaction');
        
        const config = await SystemConfig.findOne({});
        const welcomeAmount = config && config.welcomeBonusCoins !== undefined ? config.welcomeBonusCoins : 1000;
        
        user.walletBalance = (user.walletBalance || 0) + welcomeAmount;
        user.welcomeBonusRemaining = (user.welcomeBonusRemaining || 0) + welcomeAmount;
        user.welcomeBonusGiven = true;
        user.welcomeBonusDate = new Date();
        
        await WalletTransaction.create({
          userId: user._id,
          type: 'Welcome Bonus',
          amount: welcomeAmount,
          description: 'Welcome Bonus Credited'
        });
        
        console.log(`🎁 Welcome bonus of ${welcomeAmount} credited to user ${user._id}`);
      } catch (wbErr) {
        console.error('❌ Error processing welcome bonus:', wbErr.message);
      }
    }

    await user.save();

    const token = generateToken(user._id, user.phone, user.tokenVersion);

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created & logged in!' : 'Login successful!',
      isNewUser,
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
        avatar: user.avatar,
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

const getWallet = async (req, res) => {
  try {
    const CoinTransaction = require('../Models/CoinTransaction');
    const WalletTransaction = require('../Models/WalletTransaction');
    const User = require('../Models/User');

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coinTransactions = await CoinTransaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    const walletTransactions = await WalletTransaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      coins: user.referralCoins || 0,
      walletBalance: user.walletBalance || 0,
      welcomeBonusRemaining: user.welcomeBonusRemaining || 0,
      coinTransactions: coinTransactions.map(t => ({
        id: t._id,
        type: t.type,
        title: t.title,
        amount: t.amount,
        createdAt: t.createdAt
      })),
      walletTransactions: walletTransactions.map(w => ({
        id: w._id,
        type: w.type,
        amount: w.amount,
        coinsUsed: w.coinsUsed,
        status: w.status,
        description: w.description,
        createdAt: w.createdAt
      }))
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

