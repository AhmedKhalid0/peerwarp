/**
 * PeerWarp PWA & Web Share Target Client Manager
 * Handles Service Worker registration, OS Share Sheet file extraction,
 * and native app installation prompt.
 */

export function registerServiceWorker(): void {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    });
  }
}

/**
 * Retrieves files deposited by OS Web Share Target into IndexedDB.
 */
export async function getAndClearSharedFiles(): Promise<File[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return [];

  return new Promise((resolve) => {
    const request = indexedDB.open("peerwarp_pwa", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("shared_files")) {
        db.createObjectStore("shared_files", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("shared_files")) {
        return resolve([]);
      }

      const tx = db.transaction("shared_files", "readwrite");
      const store = tx.objectStore("shared_files");
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const records = getAllReq.result || [];
        if (records.length === 0) {
          resolve([]);
          return;
        }

        const files: File[] = [];
        for (const item of records) {
          try {
            const blob = item.blob || item;
            const file = new File([blob], item.name || "shared-file", {
              type: item.type || "application/octet-stream",
              lastModified: item.lastModified || Date.now(),
            });
            files.push(file);
          } catch (_) {}
        }

        // Clear retrieved records
        store.clear();
        resolve(files);
      };

      getAllReq.onerror = () => resolve([]);
    };
  });
}

// Global deferred prompt for PWA installation
let deferredPrompt: any = null;

export function initPwaInstallPrompt(onPromptAvailable: () => void): void {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    onPromptAvailable();
  });
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return choice.outcome === "accepted";
  } catch (_) {
    return false;
  }
}
