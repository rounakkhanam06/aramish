const Admin = require('../Models/Admin');
const jwt = require('jsonwebtoken');
const { getImageUrl } = require('../utils/imageHelper');

// Generate JWT Token
const generateToken = (id, email, role) => {
  const secret = process.env.JWT_ADMIN_SECRET || (process.env.JWT_SECRET ? process.env.JWT_SECRET + '_admin_secret_fallback' : 'admin_default_super_secret_key_1298471298');
  return jwt.sign(
    { id, email, role, aud: 'admin' },
    secret,
    { expiresIn: '7d' }
  );
};

// @desc    Admin Login
// @route   POST /api/admin/auth/login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email aur password required hai' });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account deactivated hai' });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    const token = generateToken(admin._id, admin.email, admin.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar,
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get current logged in admin
// @route   GET /api/admin/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    res.status(200).json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin Logout (client-side token removal)
// @route   POST /api/admin/auth/logout
// @access  Private
const adminLogout = (req, res) => {
  res.status(200).json({ success: true, message: 'Logout successful' });
};

// @desc    Get all users (customers)
// @route   GET /api/admin/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    const User = require('../Models/User');
    const Order = require('../Models/Order');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100000, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const { search, status } = req.query;

    let matchQuery = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const pipeline = [
      { $match: matchQuery }
    ];

    if (status && status !== 'All') {
      pipeline.push(
        {
          $lookup: {
            from: 'orders',
            localField: '_id',
            foreignField: 'userId',
            as: 'orders'
          }
        },
        {
          $addFields: {
            ordersCount: { $size: '$orders' },
            totalSpent: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$orders',
                      as: 'o',
                      cond: { $eq: ['$$o.paymentStatus', 'Paid'] }
                    }
                  },
                  as: 'paidOrder',
                  in: '$$paidOrder.total'
                }
              }
            }
          }
        },
        {
          $addFields: {
            derivedStatus: { $ifNull: ['$status', 'Active'] }
          }
        },
        { $match: { derivedStatus: status } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  orders: 0,
                  password: 0,
                  otp: 0,
                  otpExpiry: 0,
                  fcmWebTokens: 0,
                  fcmMobileTokens: 0
                }
              }
            ]
          }
        }
      );
    } else {
      pipeline.push(
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: 'orders',
                  localField: '_id',
                  foreignField: 'userId',
                  as: 'orders'
                }
              },
              {
                $addFields: {
                  ordersCount: { $size: '$orders' },
                  totalSpent: {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: '$orders',
                            as: 'o',
                            cond: { $eq: ['$$o.paymentStatus', 'Paid'] }
                          }
                        },
                        as: 'paidOrder',
                        in: '$$paidOrder.total'
                      }
                    }
                  }
                }
              },
              {
                $addFields: {
                  derivedStatus: { $ifNull: ['$status', 'Active'] }
                }
              },
              {
                $project: {
                  orders: 0,
                  password: 0,
                  otp: 0,
                  otpExpiry: 0,
                  fcmWebTokens: 0,
                  fcmMobileTokens: 0
                }
              }
            ]
          }
        }
      );
    }

    const result = await User.aggregate(pipeline);
    const users = result[0].data;
    const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

    // Calculate dashboard statistics dynamically
    const totalUsers = await User.countDocuments();

    const ltvStats = await Order.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, totalSales: { $sum: '$total' } } }
    ]);
    const totalSales = ltvStats[0] ? ltvStats[0].totalSales : 0;
    const avgLtv = totalUsers > 0 ? Math.round(totalSales / totalUsers) : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const activeNow = await User.countDocuments({ lastLogin: { $gte: fifteenMinsAgo } });

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      users,
      stats: {
        totalUsers,
        activeNow,
        avgLtv,
        newUsersThisWeek
      }
    });
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Create new user (customer)
// @route   POST /api/admin/users
// @access  Private
const createUser = async (req, res) => {
  try {
    const User = require('../Models/User');
    const { name, email, phone, gender, dob } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
    }

    let formattedName = null;
    if (name) {
      const trimmedName = name.trim().replace(/\s+/g, ' ');
      const nameRegex = /^[a-zA-Z]+(?:\s+[a-zA-Z]+)+$/;
      if (!nameRegex.test(trimmedName)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid full name (e.g., John Doe) containing only letters.' });
      }
      formattedName = trimmedName
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    if (email) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'User with this email already exists' });
      }
    }

    const newUser = new User({
      name: formattedName,
      email: email ? email.toLowerCase() : null,
      phone,
      gender: gender || null,
      dob: dob || null,
      isVerified: true
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Create User Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update user details
// @route   PUT /api/admin/auth/users/:id
// @access  Private
const updateUser = async (req, res) => {
  try {
    const User = require('../Models/User');
    const { name, email, phone, status } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (phone) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
      }

      const existingUser = await User.findOne({ phone, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
      }
      user.phone = phone;
    }

    if (email) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      const existingEmail = await User.findOne({ email: email.toLowerCase(), _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'User with this email already exists' });
      }
      user.email = email.toLowerCase();
    } else if (email === '') {
      user.email = null;
    }

    if (name !== undefined) {
      let formattedName = null;
      if (name) {
        const trimmedName = name.trim().replace(/\s+/g, ' ');
        const nameRegex = /^[a-zA-Z]+(?:\s+[a-zA-Z]+)+$/;
        if (!nameRegex.test(trimmedName)) {
          return res.status(400).json({ success: false, message: 'Please enter a valid full name (e.g., John Doe) containing only letters.' });
        }
        formattedName = trimmedName
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      user.name = formattedName;
    }

    if (status !== undefined) {
      user.status = status;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update admin profile details
// @route   PUT /api/admin/auth/profile
// @access  Private
const updateAdminProfile = async (req, res) => {
  try {
    const { name, email, phone, avatar } = req.body;
    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (phone !== undefined) admin.phone = phone;

    if (req.file) {
      admin.avatar = getImageUrl(req.file.url);
    } else if (avatar !== undefined) {
      admin.avatar = avatar;
    }

    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        avatar: admin.avatar,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Update Admin Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Change admin password
// @route   PUT /api/admin/auth/change-password
// @access  Private
const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new passwords are required' });
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    admin.password = newPassword;
    await admin.save();

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change Admin Password Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Force logout a user
// @route   POST /api/admin/auth/users/:id/force-logout
// @access  Private
const forceLogoutUser = async (req, res) => {
  try {
    const User = require('../Models/User');
    const { sendNotificationToUser } = require('../Router/firebaseAdmin');

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 1. Increment tokenVersion to invalidate existing JWT sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    // 2. Clear FMC tokens to fully revoke notification access
    const oldWebTokens = user.fcmWebTokens || [];
    const oldMobileTokens = user.fcmMobileTokens || [];
    user.fcmWebTokens = [];
    user.fcmMobileTokens = [];

    await user.save();

    // 3. Send force logout push notification to all OLD tokens
    const pushPayload = {
      notification: {
        title: "Session Expired",
        body: "Your account has been logged out by the administrator."
      },
      data: {
        type: "FORCE_LOGOUT"
      }
    };

    // We send directly via admin to the old tokens since we just cleared them from DB
    const { getMessaging } = require('firebase-admin/messaging');
    const { adminApp } = require('../Router/firebaseAdmin');

    const allOldTokens = [...new Set([...oldWebTokens, ...oldMobileTokens])];

    if (allOldTokens.length > 0) {
      const sendPromises = allOldTokens.map(token =>
        getMessaging(adminApp).send({
          token,
          ...pushPayload
        }).catch(err => console.log('FCM token already invalid:', err.message))
      );

      Promise.allSettled(sendPromises);
    }

    res.status(200).json({ success: true, message: 'User forced logged out successfully' });
  } catch (error) {
    console.error('Force Logout Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Force logout ALL users
// @route   POST /api/admin/auth/users/force-logout-all
// @access  Private
const forceLogoutAllUsers = async (req, res) => {
  try {
    const User = require('../Models/User');
    const users = await User.find({}).select('fcmWebTokens fcmMobileTokens');

    // Collect all tokens to send push notification
    let allOldTokens = [];
    users.forEach(u => {
      if (u.fcmWebTokens) allOldTokens.push(...u.fcmWebTokens);
      if (u.fcmMobileTokens) allOldTokens.push(...u.fcmMobileTokens);
    });
    allOldTokens = [...new Set(allOldTokens)];

    // 1. Increment tokenVersion and clear tokens for ALL users
    await User.updateMany({}, {
      $inc: { tokenVersion: 1 },
      $set: { fcmWebTokens: [], fcmMobileTokens: [] }
    });

    // 2. Send force logout push notification to all OLD tokens
    const pushPayload = {
      notification: {
        title: "Session Expired",
        body: "All user sessions have been terminated by the administrator."
      },
      data: {
        type: "FORCE_LOGOUT"
      }
    };

    if (allOldTokens.length > 0) {
      const { getMessaging } = require('firebase-admin/messaging');
      const { adminApp } = require('../Router/firebaseAdmin');

      const sendPromises = allOldTokens.map(token =>
        getMessaging(adminApp).send({
          token,
          ...pushPayload
        }).catch(err => console.log('FCM token already invalid:', err.message))
      );

      Promise.allSettled(sendPromises);
    }

    res.status(200).json({ success: true, message: `Successfully forced logout for ${users.length} users.` });
  } catch (error) {
    console.error('Force Logout All Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const User = require('../Models/User');
    const Order = require('../Models/Order');
    const Address = require('../Models/Address');
    const Wishlist = require('../Models/Wishlist');
    const CoinTransaction = require('../Models/CoinTransaction');

    const userId = req.params.id;

    // 1. Fetch User details
    const user = await User.findById(userId).select('-password -otp -otpExpiry').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 2. Fetch primary/default Address
    const address = await Address.findOne({ userId }).sort({ isDefault: -1, createdAt: -1 }).lean();

    // 3. Fetch Orders details & calculate stats
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();
    const totalOrders = orders.length;
    const ltv = orders.reduce((sum, o) => o.paymentStatus === 'Paid' ? sum + o.total : sum, 0);
    const returnsCount = orders.filter(o => o.status === 'Cancelled').length;

    // 4. Fetch Wishlist items populated with Product details
    const wishlist = await Wishlist.find({ userId })
      .populate({
        path: 'productId',
        select: 'name price images description'
      })
      .sort({ createdAt: -1 })
      .lean();

    // 5. Fetch Wallet/Coin Transactions & calculate balance
    const coinTransactions = await CoinTransaction.find({ userId }).sort({ createdAt: -1 }).lean();
    const totalEarned = coinTransactions.filter(t => t.type === 'earned').reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = coinTransactions.filter(t => t.type === 'spent').reduce((sum, t) => sum + t.amount, 0);
    const coinsBalance = totalEarned - totalSpent;

    // 5.1. Fetch dynamic average rating and reviews from Reel model
    const Reel = require('../Models/Reel');
    const userReviews = await Reel.find({ uploadedBy: userId }).populate('productId', 'name price images').lean();
    let avgRating = 0;
    if (userReviews.length > 0) {
      const sum = userReviews.reduce((acc, r) => acc + (r.rating || 0), 0);
      avgRating = parseFloat((sum / userReviews.length).toFixed(1));
    }

    // 5.2. Fetch user's support tickets
    const derivedStatus = user.status || 'Active';
    const SupportTicket = require('../Models/SupportTicket');
    const userTickets = await SupportTicket.find({ userId }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      user: {
        ...user,
        derivedStatus
      },
      address,
      stats: {
        totalOrders,
        ltv,
        returnsCount,
        coinsBalance,
        avgRating
      },
      orders: orders.map(o => ({
        id: o._id,
        date: new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        total: o.total,
        status: o.status,
        itemsCount: o.items.reduce((sum, item) => sum + item.quantity, 0)
      })),
      wishlist: wishlist.filter(w => w.productId).map(w => ({
        id: w._id,
        productId: w.productId._id,
        name: w.productId.name,
        price: w.productId.price,
        image: w.productId.images && w.productId.images[0] ? w.productId.images[0] : null
      })),
      reviews: userReviews.map(r => ({
        id: r._id,
        productId: r.productId ? r.productId._id : null,
        productName: r.productId ? r.productId.name : 'Unknown Product',
        productPrice: r.productId ? r.productId.price : 0,
        productImage: r.productId && r.productId.images && r.productId.images[0] ? r.productId.images[0] : null,
        video: r.video,
        rating: r.rating || 0,
        caption: r.caption || '',
        status: r.status,
        createdAt: new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      })),
      tickets: userTickets.map(t => ({
        id: t._id,
        ticketId: t.ticketId,
        subject: t.subject,
        category: t.category,
        priority: t.priority,
        status: t.status,
        description: t.description,
        date: new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      })),
      wallet: {
        balance: coinsBalance,
        transactions: coinTransactions.map(t => ({
          id: t._id,
          title: t.title,
          amount: t.amount,
          type: t.type,
          date: new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        }))
      }
    });
  } catch (error) {
    console.error('Get User Details Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = { adminLogin, getMe, adminLogout, getUsers, createUser, updateUser, updateAdminProfile, changeAdminPassword, forceLogoutUser, forceLogoutAllUsers, getUserDetails };
