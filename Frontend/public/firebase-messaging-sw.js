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
  
  const notificationTitle = payload.notification?.title || payload.data?.title || "Aramish Shoes";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "You have a new update from Aramish!",
    icon: payload.notification?.icon || payload.data?.image || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || "/"
    }
  };

  // Messages with a `notification` block are already displayed by the Firebase SDK —
  // showing them here too produced every push twice. Only data-only messages need it.
  if (!payload.notification) {
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

// Handle clicking on notification banner in phone tray or desktop
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

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
