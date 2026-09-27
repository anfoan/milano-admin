// Service Worker - Milano Store v3 (Force Update for New Database)
const CACHE_NAME = 'milano-cache-v4'; // INCREMENT VERSION TO FORCE REFRESH

// On install: Skip waiting to activate immediately
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force immediate activation
});

// On activate: Clear ALL old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete ALL caches that don't match current version
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// On fetch: Network-first strategy (always get fresh data, fallback to cache only if offline)
self.addEventListener('fetch', (event) => {
    // Skip caching for localhost (Vite dev) and Firebase/Firestore
    if (event.request.url.includes('localhost') ||
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('firebase') ||
        event.request.url.includes('cloudinary.com')) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503, statusText: 'Offline' })));
        return;
    }

    // Only cache GET requests with http/https schemes (ignore POST, chrome-extension, etc.)
    if (event.request.method !== 'GET' || 
        (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://'))) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503, statusText: 'Offline' })));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response for caching
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Only use cache if network fails (offline mode)
                return caches.match(event.request);
            })
    );
});
