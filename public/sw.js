// Basic service worker for notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// This SW relies on postMessage or showNotification calls from the page.
// We keep it minimal since scheduling is done in-page via setTimeout.


