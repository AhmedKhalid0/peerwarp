/**
 * PeerWarp Service Worker
 * Handles PWA caching, offline shell, and Web Share Target API
 */

const CACHE_NAME = "peerwarp-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Helper to open IndexedDB in Service Worker
function openSharedDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("peerwarp_pwa", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("shared_files")) {
        db.createObjectStore("shared_files", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeSharedFiles(files) {
  return openSharedDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("shared_files", "readwrite");
      const store = tx.objectStore("shared_files");
      for (const file of files) {
        store.add({
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified || Date.now(),
          blob: file,
          timestamp: Date.now(),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Intercept OS Web Share Target
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll("files");
          if (files && files.length > 0) {
            await storeSharedFiles(files);
          }
        } catch (err) {
          console.error("PWA Web Share Target error:", err);
        }
        return Response.redirect("/?shared=true", 303);
      })()
    );
    return;
  }

  // 2. Bypass signaling websockets and api
  if (url.pathname.startsWith("/ws") || url.pathname.startsWith("/health")) {
    return;
  }
});
