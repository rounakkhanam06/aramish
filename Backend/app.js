const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

// Behind nginx: read the visitor's real IP from X-Forwarded-For (used by iOS deferred referral matching).
// TRUST_PROXY = number of proxy hops in front of Node (default 1), e.g. 2 when Cloudflare sits in front of nginx.
const trustProxy = process.env.TRUST_PROXY || '1';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// Allowed Origins for CORS
const ALLOWED_ORIGINS = [
  "https://www.aramishshoes.com",
  "https://admin.aramishshoes.com",
  "https://www.admin.aramishshoes.com",
  "https://aramishshoes.com",
];

// Add dynamic origins from environment variables if they exist
if (process.env.FRONTEND_URL) ALLOWED_ORIGINS.push(process.env.FRONTEND_URL);
if (process.env.ADMIN_URL) ALLOWED_ORIGINS.push(process.env.ADMIN_URL);

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
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiters (in-memory, per server process). Per-IP limits are deliberately generous: mobile
// carriers put many customers behind one IPv4 address. The per-phone OTP limits that matter most
// are enforced in the database by userAuthController (resend cooldown, 5 sends/hour, 5 guesses/OTP).
const limiter = (windowMs, limit, message, extra = {}) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message },
  ...extra
});
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

// Payment/shipping provider callbacks must never be throttled
const isProviderWebhook = (req) => req.path.endsWith('/webhook');

// Coarse flood protection for every API route
app.use(limiter(ONE_MINUTE, 600, 'Too many requests. Please slow down.', { skip: isProviderWebhook }));

// OTP: per IP (stops one client spraying many numbers) and per phone number
app.use('/auth/send-otp', limiter(FIFTEEN_MINUTES, 30, 'Too many OTP requests from this network. Please try again later.'));
app.use('/auth/send-otp', limiter(FIFTEEN_MINUTES, 6, 'Too many OTP requests for this number. Please try again later.', {
  keyGenerator: (req) => (req.body?.phone ? `phone:${String(req.body.phone)}` : ipKeyGenerator(req.ip))
}));
app.use('/auth/verify-otp', limiter(FIFTEEN_MINUTES, 60, 'Too many login attempts from this network. Please try again later.'));

// Admin panel login: failed attempts only
app.use('/admin/auth/login', limiter(FIFTEEN_MINUTES, 10, 'Too many login attempts. Please try again after 15 minutes.', { skipSuccessfulRequests: true }));

// Other public endpoints that write data or call paid third-party APIs
app.use('/referral/deferred', limiter(ONE_MINUTE, 30, 'Too many requests. Please try again shortly.'));
app.use(['/api/shiprocket/estimate', '/shiprocket/estimate', '/api/logistics/estimate', '/logistics/estimate'],
  limiter(ONE_MINUTE, 60, 'Too many delivery estimates. Please try again shortly.'));
app.use(['/analytics/track'], limiter(ONE_MINUTE, 120, 'Too many requests. Please slow down.'));

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

// Server-rendered Open Graph meta tags for social-media crawlers (WhatsApp, Facebook, etc.)
app.use('/meta', require('./Router/shareMetaRoutes'));

// Serve Android Digital Asset Links for App Links / Referral handling
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const assetlinksPath = path.join(__dirname, '../Frontend/public/.well-known/assetlinks.json');
  res.sendFile(assetlinksPath, (err) => {
    if (err) {
      res.json([
        {
          "relation": ["delegate_permission/common.handle_all_urls"],
          "target": {
            "namespace": "android_app",
            "package_name": "com.aramishshoes.app",
            "sha256_cert_fingerprints": [
              "98:BC:C9:8B:7C:33:07:16:E8:3A:31:37:A1:AB:24:2C:79:DF:F1:A2:51:C8:79:D6:98:04:48:E8:20:8E:81:6B"
            ]
          }
        }
      ]);
    }
  });
});

// Serve Apple Universal Links (AASA) for iOS deep linking / Referral handling
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const aasaPath = path.join(__dirname, '../Frontend/public/.well-known/apple-app-site-association');
  res.sendFile(aasaPath, (err) => {
    if (err) {
      // Inline fallback – update TEAM_ID and BUNDLE_ID when your iOS app is ready
      res.json({
        "applinks": {
          "details": [
            {
              "appIDs": ["REPLACE_WITH_TEAM_ID.REPLACE_WITH_IOS_BUNDLE_ID"],
              "components": [
                { "/": "/r/*", "comment": "Referral invite links" },
                { "/": "/refer", "comment": "Refer & Earn page" },
                { "/": "/product/*", "comment": "Product deep links" }
              ]
            }
          ]
        }
      });
    }
  });
});

// Any successful catalog change (products, banners, chips, brands) clears the public catalog cache
const { clearCatalogCache } = require('./utils/catalogCache');
app.use(['/admin/catalog', '/catalog'], (req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) clearCatalogCache();
    });
  }
  next();
});

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
app.use('/exchanges', require('./Router/exchangeRoutes'));


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

