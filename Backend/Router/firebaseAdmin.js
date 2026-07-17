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
      notification: { title, body },
      data: data || {}
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

module.exports = {
  adminApp,
  sendNotificationToUser
};
