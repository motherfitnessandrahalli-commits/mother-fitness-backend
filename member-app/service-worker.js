const CACHE_NAME = 'ultra-fitness-member-v13';
const urlsToCache = [
    './',
    './index.html',
    './dashboard.html',
    './qr-code.html',
    './attendance.html',
    './payments.html',
    './profile.html',
    './bmi-calculator.html',
    './styles.css',
    './app.js',
    './api.js',
    './manifest.json'
];

// Install event - cache files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // IGNORE API REQUESTS (Always go to network)
    if (event.request.url.includes('/api/')) {
        return; // Fallback to browser default (network)
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then((response) => {
                    // Don't cache if not successful
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Cache new requests
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'ultra-fitness-notification',
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification('Mother Fitness', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('./')
    );
});
