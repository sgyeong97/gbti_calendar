// Basic service worker for notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push events (for server-sent Web Push)
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || '알림';
  const options = {
    body: data.body || '',
    icon: data.icon || '/gbti_small.jpg',
    badge: data.badge || '/gbti_small.jpg',
    data: data.url ? { url: data.url } : undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/calendar';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.some((win) => {
        if ('focus' in win) { win.focus(); }
        if ('navigate' in win) { win.navigate(targetUrl); }
        return true;
      });
      if (!hadWindow && self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});


