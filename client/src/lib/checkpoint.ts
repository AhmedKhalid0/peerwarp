/**
 * IndexedDB persistence engine for Resumable P2P File Transfers.
 * Zero server storage: keeps in-progress checkpoints and chunks directly
 * in the client's browser database to survive network drops or page reloads.
 */

const DB_NAME = "peerwarp_transfers_db";
const DB_VERSION = 1;
const CHECKPOINTS_STORE = "checkpoints";
const CHUNKS_STORE = "chunks";

export interface TransferCheckpoint {
  fileKey: string;
  fileId: string;
  name: string;
  size: number;
  type: string;
  relativePath?: string;
  receivedBytes: number;
  totalChunks: number;
  isDirectSaved: boolean;
  lastUpdated: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not supported in this environment."));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(CHECKPOINTS_STORE)) {
        db.createObjectStore(CHECKPOINTS_STORE, { keyPath: "fileKey" });
      }

      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunkStore = db.createObjectStore(CHUNKS_STORE, { keyPath: "key" });
        chunkStore.createIndex("fileKey", "fileKey", { unique: false });
      }
    };

    req.onsuccess = () => {
      resolve(req.result);
    };

    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });

  return dbPromise;
}

/**
 * Generate a deterministic fingerprint for a file.
 */
export function generateFileKey(file: { name: string; size: number; lastModified?: number; relativePath?: string }): string {
  const mod = file.lastModified || 0;
  const rel = file.relativePath || file.name;
  return `${rel}::${file.size}::${mod}`;
}

/**
 * Save or update a transfer checkpoint.
 */
export async function saveTransferCheckpoint(checkpoint: Omit<TransferCheckpoint, "lastUpdated">): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHECKPOINTS_STORE, "readwrite");
      const store = tx.objectStore(CHECKPOINTS_STORE);
      const record: TransferCheckpoint = {
        ...checkpoint,
        lastUpdated: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[Checkpoint] Failed to save checkpoint:", err);
  }
}

/**
 * Retrieve an existing transfer checkpoint by fileKey.
 */
export async function getTransferCheckpoint(fileKey: string): Promise<TransferCheckpoint | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHECKPOINTS_STORE, "readonly");
      const store = tx.objectStore(CHECKPOINTS_STORE);
      const req = store.get(fileKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[Checkpoint] Failed to read checkpoint:", err);
    return null;
  }
}

/**
 * Save an individual binary chunk into IndexedDB.
 */
export async function saveChunkToStorage(
  fileKey: string,
  chunkIndex: number,
  chunkData: ArrayBuffer
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHUNKS_STORE, "readwrite");
      const store = tx.objectStore(CHUNKS_STORE);
      const key = `${fileKey}#${chunkIndex}`;
      const req = store.put({ key, fileKey, chunkIndex, data: chunkData });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[Checkpoint] Failed to save chunk ${chunkIndex}:`, err);
  }
}

/**
 * Load all chunks for a completed transfer from IndexedDB in sequential order.
 */
export async function loadAllChunks(fileKey: string, totalChunks: number): Promise<ArrayBuffer[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, "readonly");
    const store = tx.objectStore(CHUNKS_STORE);
    const index = store.index("fileKey");
    const req = index.getAll(fileKey);

    req.onsuccess = () => {
      const items: { chunkIndex: number; data: ArrayBuffer }[] = req.result || [];
      items.sort((a, b) => a.chunkIndex - b.chunkIndex);

      const buffers: ArrayBuffer[] = new Array(totalChunks);
      for (const item of items) {
        if (item.chunkIndex < totalChunks) {
          buffers[item.chunkIndex] = item.data;
        }
      }
      resolve(buffers);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a checkpoint and all associated chunks upon successful transfer or cancellation.
 */
export async function deleteTransferCheckpoint(fileKey: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([CHECKPOINTS_STORE, CHUNKS_STORE], "readwrite");

    // 1. Delete checkpoint
    const checkStore = tx.objectStore(CHECKPOINTS_STORE);
    checkStore.delete(fileKey);

    // 2. Delete all chunks matching fileKey
    const chunkStore = tx.objectStore(CHUNKS_STORE);
    const index = chunkStore.index("fileKey");
    const keyReq = index.getAllKeys(fileKey);

    keyReq.onsuccess = () => {
      const keys = keyReq.result || [];
      for (const k of keys) {
        chunkStore.delete(k);
      }
    };

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Non-blocking
    });
  } catch (err) {
    console.warn("[Checkpoint] Cleanup error:", err);
  }
}

/**
 * Purge checkpoints older than 24 hours to prevent browser storage buildup.
 */
export async function purgeStaleCheckpoints(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(CHECKPOINTS_STORE, "readonly");
    const store = tx.objectStore(CHECKPOINTS_STORE);
    const req = store.getAll();

    req.onsuccess = async () => {
      const all: TransferCheckpoint[] = req.result || [];
      const now = Date.now();
      for (const cp of all) {
        if (now - cp.lastUpdated > maxAgeMs) {
          await deleteTransferCheckpoint(cp.fileKey);
        }
      }
    };
  } catch (_) {}
}
