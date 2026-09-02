// Import the Firebase scripts inside the service worker
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// Initialize Firebase App in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCUOAGEtCCTGrpj7OIvcJKD_5tvA4qXyK8",
  authDomain: "aramish-17001.firebaseapp.com",
  projectId: "aramish-17001",
  storageBucket: "aramish-17001.firebasestorage.app",
  messagingSenderId: "166724734983",
  appId: "1:166724734983:web:2107ff64b1f0c24ff61aa2"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // If the payload already has a notification object, Firebase automatically displays it.
  // We only need to manually show it if it's a data-only message.
  if (!payload.notification) {
    const notificationTitle = payload.data?.title || "Aramish Notification";
    const notificationOptions = {
      body: payload.data?.body || "",
      icon: payload.data?.image || "/aramish-logo.png"
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  }

  if (payload.data?.type === 'FORCE_LOGOUT') {
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'FORCE_LOGOUT' });
      });
    });
  }
});
