const jwt = require('jsonwebtoken');
const Admin = require('../Models/Admin');

const protectAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
  }

  try {
    const secret = process.env.JWT_ADMIN_SECRET || (process.env.JWT_SECRET ? process.env.JWT_SECRET + '_admin_secret_fallback' : 'admin_default_super_secret_key_1298471298');
    const decoded = jwt.verify(token, secret);
    
    // Verify audience
    if (decoded.aud !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid token audience' });
    }

    req.admin = await Admin.findById(decoded.id).select('-password');
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Admin not found' });
    }

    // Verify admin is active
    if (!req.admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account is deactivated' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
};

// Attaches req.admin when a valid admin token is present, but never blocks the request.
// Used on public product routes that also serve the admin panel, so admin-only fields
// (e.g. costPrice) can be included for authenticated admins without requiring auth for everyone.
const attachAdminIfPresent = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return next();

  try {
    const secret = process.env.JWT_ADMIN_SECRET || (process.env.JWT_SECRET ? process.env.JWT_SECRET + '_admin_secret_fallback' : 'admin_default_super_secret_key_1298471298');
    const decoded = jwt.verify(token, secret);
    if (decoded.aud === 'admin') {
      const admin = await Admin.findById(decoded.id).select('-password');
      if (admin && admin.isActive) {
        req.admin = admin;
      }
    }
  } catch (error) {
    // Invalid/expired token on an otherwise-public route — just proceed unauthenticated.
  }

  next();
};

module.exports = { protectAdmin, attachAdminIfPresent };
