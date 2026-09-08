const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');

let adminApp;
try {
  let serviceAccount = null;

  // 1. Try to load from environment variable first (recommended for staging/production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('🔥 Loading Firebase credentials from FIREBASE_SERVICE_ACCOUNT environment variable.');
    } catch (parseErr) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', parseErr.message);
    }
  }

  // 2. Fall back to local file only in development/staging if environment variable is not set
  if (!serviceAccount && process.env.ENV !== 'production') {
    try {
      serviceAccount = require('../Config/firebase-service-account.json');
      console.log('🔥 Loading Firebase credentials from local Config/firebase-service-account.json.');
    } catch (fileErr) {
      // Graceful fallback for developers without local JSON configuration
      console.log('⚠️ Local Config/firebase-service-account.json not found. Proceeding without Firebase Admin capabilities.');
    }
  }

  if (serviceAccount) {
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('🔥 Firebase Admin SDK Initialized Successfully');
  } else {
    console.warn('⚠️ Firebase Admin SDK is inactive: No credentials found (FIREBASE_SERVICE_ACCOUNT or local JSON file).');
  }
} catch (error) {
  console.error('❌ Firebase Admin SDK Initialization Failed:', error.message);
}

/**
 * Send a push notification to a specific user
 * @param {string} userId 
 * @param {object} payload { title, body, data }
 */
const sendNotificationToUser = async (userId, payload) => {
  try {
    const User = require('../Models/User');
    const user = await User.findById(userId);
    if (!user) {
      console.log(`📡 User ${userId} not found`);
      return;
    }

    const webTokens = (user.fcmWebTokens && user.fcmWebTokens.length > 0) ? [user.fcmWebTokens[user.fcmWebTokens.length - 1]] : [];
    const mobileTokens = (user.fcmMobileTokens && user.fcmMobileTokens.length > 0) ? [user.fcmMobileTokens[user.fcmMobileTokens.length - 1]] : [];
    // Remove duplicates by using Set
    const allTokens = [...new Set([...webTokens, ...mobileTokens])];

    if (allTokens.length === 0) {
      console.log(`📡 No FCM tokens registered for user ${userId}`);
      return;
    }

    const { title, body, data } = payload;
    const messagePayload = {
      notification: { 
        title, 
        body 
      },
      data: {
        ...(data || {}),
        title: title || 'Aramish',
        body: body || '',
        url: data?.url || '/'
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          title,
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [200, 100, 200],
          requireInteraction: false,
          data: {
            url: data?.url || '/'
          }
        },
        fcmOptions: {
          link: data?.url || '/'
        }
      },
      android: {
        priority: 'high',
        notification: {
          title,
          body,
          icon: 'stock_ticker_update',
          color: '#ee4923',
          sound: 'default'
        }
      }
    };

    console.log(`📡 Sending push notification to user ${userId} on ${allTokens.length} device(s)...`);
    
    const sendPromises = allTokens.map(token => 
      getMessaging(adminApp).send({
        token,
        ...messagePayload
      }).catch(err => {
        console.error(`❌ Failed to send notification to token: ${token.substring(0, 15)}...`, err.message);
        // Clean up invalid/inactive tokens from database
        if (
          err.code === 'messaging/invalid-argument' ||
          err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/registration-token-not-registered'
        ) {
          User.findByIdAndUpdate(userId, { 
            $pull: { 
              fcmWebTokens: token,
              fcmMobileTokens: token
            } 
          }).catch(dbErr => {
            console.error('❌ Failed to clean up invalid token:', dbErr.message);
          });
        }
      })
    );

    await Promise.all(sendPromises);
  } catch (err) {
    console.error('❌ Error sending notification:', err.message);
  }
};

/**
 * Send push notification to all Active Admins (for new orders, returns, exchanges, etc.)
 * @param {object} payload { title, body, data }
 */
const sendNotificationToAdmins = async (payload) => {
  try {
    const Admin = require('../Models/Admin');
    const admins = await Admin.find({ isActive: true });
    
    let allTokens = [];
    for (const admin of admins) {
      const webTokens = admin.fcmWebTokens || [];
      const mobileTokens = admin.fcmMobileTokens || [];
      allTokens.push(...webTokens, ...mobileTokens);
    }
    allTokens = [...new Set(allTokens.filter(Boolean))];

    if (allTokens.length === 0) {
      console.log('📡 No Admin FCM tokens registered for admin notification');
      return;
    }

    const { title, body, data } = payload;
    const messagePayload = {
      notification: { 
        title, 
        body 
      },
      data: {
        ...(data || {}),
        title: title || 'Aramish Admin',
        body: body || '',
        url: data?.url || '/admin/orders'
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          title,
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [300, 100, 300, 100, 300],
          requireInteraction: true,
          data: {
            url: data?.url || '/admin/orders'
          }
        },
        fcmOptions: {
          link: data?.url || '/admin/orders'
        }
      },
      android: {
        priority: 'high',
        notification: {
          title,
          body,
          icon: 'stock_ticker_update',
          color: '#ee4923',
          sound: 'default'
        }
      }
    };

    console.log(`📡 Sending push notification to ${allTokens.length} Admin device(s)...`);
    
    const sendPromises = allTokens.map(token => 
      getMessaging(adminApp).send({
        token,
        ...messagePayload
      }).catch(err => {
        console.error(`❌ Failed to send admin notification to token: ${token.substring(0, 15)}...`, err.message);
        if (
          err.code === 'messaging/invalid-argument' ||
          err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/registration-token-not-registered'
        ) {
          Admin.updateMany({}, {
            $pull: {
              fcmWebTokens: token,
              fcmMobileTokens: token
            }
          }).catch(() => {});
        }
      })
    );

    await Promise.all(sendPromises);
  } catch (err) {
    console.error('❌ Error sending notification to admins:', err.message);
  }
};

module.exports = {
  adminApp,
  sendNotificationToUser,
  sendNotificationToAdmins
};
