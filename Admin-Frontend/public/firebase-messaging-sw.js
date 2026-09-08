// Import the Firebase scripts inside the service worker
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// Initialize Firebase App in the Admin service worker
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
  console.log('[Admin firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || "Aramish Admin";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "New update in Admin Panel",
    icon: payload.notification?.icon || payload.data?.image || "/aramish-logo.png",
    badge: "/favicon.svg",
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true,
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || "/orders"
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle clicking on notification banner in phone tray or desktop
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
