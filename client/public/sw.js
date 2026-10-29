// Service Worker for Holder PWA with Web Share Target Level 2 Support
const CACHE_NAME = 'holder-cache-v2';
const OFFLINE_URL = '/';
const DB_NAME = 'holder_share_db';
const STORE_NAME = 'shared_items';

function openShareDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedPayload(payload) {
  const db = await openShareDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      id: 'latest',
      ...payload,
      timestamp: Date.now()
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.webmanifest',
        '/icons/icon-192.png',
        '/icons/icon-512.png'
      ]).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept Web Share Target POST requests to /share
  if (event.request.method === 'POST' && url.pathname === '/share') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const title = formData.get('title') || '';
        const text = formData.get('text') || '';
        const shareUrl = formData.get('url') || '';

        // Extract files (declared as 'media' in manifest)
        const mediaFiles = formData.getAll('media');
        const candidateFile = mediaFiles.length > 0 
          ? mediaFiles[0] 
          : (formData.get('files') || formData.get('file') || formData.get('image'));

        let filePayload = null;
        if (candidateFile && (candidateFile instanceof Blob || typeof candidateFile.size === 'number')) {
          filePayload = {
            blob: candidateFile,
            name: candidateFile.name || `shared_screenshot_${Date.now()}.png`,
            type: candidateFile.type || 'image/png',
            size: candidateFile.size
          };
        }

        await saveSharedPayload({
          title,
          text,
          url: shareUrl,
          file: filePayload
        });

        // 303 redirect turns the POST into a GET request to the /share page
        return Response.redirect('/share?shared=1', 303);
      } catch (err) {
        console.error('[SW] Share target processing error:', err);
        return Response.redirect('/share?error=share_failed', 303);
      }
    })());
    return;
  }

  // Pass through other API and non-GET requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Network-first strategy for dynamic Next.js app, with cache fallback
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match(OFFLINE_URL);
        if (fallback) return fallback;
      }
      return new Response('Network error occurred', {
        status: 408,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});
