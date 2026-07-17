const jwt = require('jsonwebtoken');
const User = require('../Models/User');

const protectUser = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify audience
    if (decoded.aud !== 'user') {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid token audience' });
    }

    req.user = await User.findById(decoded.id).select('-otp -otpExpiry');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    // Check if token version matches to enforce Force Logout
    if (decoded.tokenVersion !== req.user.tokenVersion) {
      return res.status(401).json({ success: false, message: 'Session expired' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
};

module.exports = { protectUser };
