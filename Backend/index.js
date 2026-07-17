const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./Config/db');
const Admin = require('./Models/Admin');
const mongoose = require('mongoose');

const http = require('http');
const socketIo = require('socket.io');
const socketHandler = require('./Router/socketHandler');

const PORT = process.env.PORT || 5000;

// Process-level safety handlers
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection at Promise:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception thrown:', err);
  process.exit(1);
});

// Auto-create admin if not exists
const ensureAdmin = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const env = process.env.ENV || process.env.NODE_ENV || 'development';

  // If there are already any admin users in the database, do not force env variables or auto-creation
  const count = await Admin.countDocuments();
  if (count > 0) {
    console.log(`👤 Admins exist in database: ${count} admin(s) found. Skipping auto-creation.`);
    return;
  }

  if (env === 'production') {
    if (!email || !password) {
      console.warn('⚠️ WARNING: No admin users found in database, and ADMIN_EMAIL / ADMIN_PASSWORD are not set in environment variables.');
      return;
    }
    if (password === '123' || password.length < 12) {
      throw new Error('CRITICAL SECURITY ERROR: Admin password is too weak. It must be at least 12 characters and not the default "123".');
    }
  }

  const adminEmail = email || 'admin@gmail.com';
  const adminPassword = password || '123';

  const existing = await Admin.findOne({ email: adminEmail });
  if (!existing) {
    await Admin.create({ name: 'Super Admin', email: adminEmail, password: adminPassword, role: 'super_admin' });
    console.log(`✅ Admin auto-created: ${adminEmail}`);
  } else {
    console.log(`👤 Admin already exists: ${adminEmail}`);
  }
};

// Connect to MongoDB then start server
connectDB().then(async () => {
  await ensureAdmin();
  
  const server = http.createServer(app);
  const io = socketIo(server, {
    cors: {
      origin: app.ALLOWED_ORIGINS || '*',
      methods: ['GET', 'POST']
    }
  });

  socketHandler(io);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await mongoose.connection.close();
      console.log('Server and DB connections closed');
      process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});

