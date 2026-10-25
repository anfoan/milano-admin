// Milano Admin service worker: cache images for responsiveness, but always refresh application code.
const CACHE_NAME = 'milano-admin-cache-v6-runtime-safe';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

const isHttpGet = (request) => request.method === 'GET'
    && (request.url.startsWith('http://') || request.url.startsWith('https://'));

const isApplicationCode = (request, url) => request.destination === 'document'
    || request.destination === 'script'
    || request.destination === 'style'
    || request.destination === 'worker'
    || /\/assets\/.*\.(?:js|mjs|css)(?:$|\?)/i.test(url.pathname);

const networkFirst = async (request) => {
    try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response?.ok && new URL(request.url).origin === self.location.origin) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('', { status: 503, statusText: 'Offline' });
    }
};

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (!isHttpGet(request)) return;

    const url = new URL(request.url);
    const isRemoteData = /firestore\.googleapis\.com|firebase|cloudinary\.com/i.test(url.hostname);
    const isBranding = request.destination === 'manifest' || /manifest\.json|icon-\d+|favicon|admin-icon/i.test(url.pathname);

    // Never serve an outdated Vite chunk, page, manifest, or Firebase response after deployment.
    if (isApplicationCode(request, url) || isRemoteData || isBranding) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Local images/fonts can still open instantly on repeat visits and fall back to the network on first visit.
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
                if (response?.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }
                return response;
            }).catch(() => new Response('', { status: 503, statusText: 'Offline' })))
        );
        return;
    }

    event.respondWith(networkFirst(request));
});
