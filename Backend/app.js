const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
// const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

// Allowed Origins for CORS
const ALLOWED_ORIGINS = [
  'https://aramish.com',
  'https://admin.aramish.com',
  'https://aramishworld.com',
  'https://admin.aramishworld.com',
  'http://localhost:5173',
  'http://localhost:5174'
];

// Export ALLOWED_ORIGINS for socket.io configuration
app.ALLOWED_ORIGINS = ALLOWED_ORIGINS;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false // Allow loading uploads on the client
}));
app.use(compression());

// Custom in-place NoSQL Injection Sanitizer (Supports Express 5.0 read-only req.query)
const sanitizeNoSql = (obj) => {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (key.startsWith('$') || key.startsWith('.')) {
        delete obj[key];
      } else {
        sanitizeNoSql(obj[key]);
      }
    }
  }
};
app.use((req, res, next) => {
  if (req.body) sanitizeNoSql(req.body);
  if (req.query) sanitizeNoSql(req.query);
  if (req.params) sanitizeNoSql(req.params);
  next();
});

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || process.env.ENV !== 'production') {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Request payload limits
app.use(express.json({ 
  limit: '10kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate Limiters (Disabled as requested)
/*
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please try again after 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth/send-otp', otpLimiter);
app.use('/auth/verify-otp', otpLimiter);

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/admin/auth/login', adminLimiter);
*/

// Serve uploads with caching headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    if (filePath.endsWith('.mp4')) {
      res.set('Accept-Ranges', 'bytes');
    }
  }
}));

// Routes
app.use('/admin/auth', require('./Router/adminAuthRoutes'));
app.use('/auth', require('./Router/userAuthRoutes'));
app.use('/addresses', require('./Router/addressRoutes'));
app.use('/cart', require('./Router/cartRoutes'));
app.use('/orders', require('./Router/orderRoutes'));
app.use('/api/payments', require('./Router/paymentRoutes'));
app.use('/referral', require('./Router/referralRoutes'));
app.use('/games', require('./Router/gameRoutes'));
app.use('/reels', require('./Router/reelRoutes'));
app.use('/analytics', require('./Router/analyticsRoutes'));
app.use('/admin/analytics', require('./Router/analyticsRoutes'));
app.use('/support-tickets', require('./Router/supportTicketRoutes'));

app.use('/admin/catalog/chips', require('./Router/categoryChipRoutes'));
app.use('/admin/catalog/subchips', require('./Router/subCategoryChipRoutes'));
app.use('/admin/catalog/banners', require('./Router/bannerRoutes'));
app.use('/admin/catalog/products', require('./Router/productRoutes'));
app.use('/admin/catalog/brands', require('./Router/brandRoutes'));
app.use('/catalog/brands', require('./Router/brandRoutes'));
app.use('/homepage', require('./Router/homepageRoutes'));
app.use('/admin/settings', require('./Router/settingsRoutes'));
app.use('/admin/promotions/coupons', require('./Router/couponRoutes'));
app.use('/admin/referrals', require('./Router/adminReferralRoutes'));
app.use('/admin/content/legal', require('./Router/legalRoutes'));
app.use('/admin/content/qna', require('./Router/qnaRoutes'));
app.use('/admin/shiprocket', require('./Router/shiprocketRoutes'));
app.use('/api/shiprocket', require('./Router/shiprocketRoutes'));
app.use('/api/logistics', require('./Router/shiprocketRoutes')); // Alias without 'shiprocket' keyword for webhook
app.use('/shiprocket', require('./Router/shiprocketRoutes'));
app.use('/logistics', require('./Router/shiprocketRoutes'));
app.use('/admin/notifications', require('./Router/notificationRoutes'));
app.use('/notifications', require('./Router/notificationRoutes'));
app.use('/returns', require('./Router/returnRoutes'));

// Health check with DB connection check
app.get('/health', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      return res.json({
        status: 'ok',
        db: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    }
    res.status(503).json({ status: 'error', db: 'disconnected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Aramish API is running 🚀' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error({
    message: err.message,
    stack: process.env.ENV === 'production' ? undefined : err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: (process.env.ENV === 'production' || process.env.NODE_ENV === 'production')
      ? 'Something went wrong'
      : err.message
  });
});

module.exports = app;

