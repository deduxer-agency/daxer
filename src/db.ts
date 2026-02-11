/**
 * IndexedDB storage layer for Daxer Studio.
 * Stores image blobs (reference images + generated images) in IndexedDB
 * which has no practical size limit, unlike localStorage's ~5-10MB cap.
 *
 * Small state (settings, project metadata) still uses localStorage.
 * Image data URLs are stored/retrieved from IndexedDB by their ID.
 */

const DB_NAME = 'daxer-studio';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then((db) => {
    const transaction = db.transaction(IMAGES_STORE, mode);
    return transaction.objectStore(IMAGES_STORE);
  });
}

// ---- Public API ----

export async function saveImageBlob(id: string, dataUrl: string): Promise<void> {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put({ id, dataUrl });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getImageBlob(id: string): Promise<string | null> {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result?.dataUrl || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteImageBlob(id: string): Promise<void> {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveMultipleImageBlobs(
  entries: { id: string; dataUrl: string }[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);

    for (const entry of entries) {
      store.put({ id: entry.id, dataUrl: entry.dataUrl });
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getMultipleImageBlobs(
  ids: string[]
): Promise<Map<string, string>> {
  const store = await tx('readonly');
  const results = new Map<string, string>();

  return new Promise((resolve) => {
    let remaining = ids.length;
    if (remaining === 0) {
      resolve(results);
      return;
    }

    for (const id of ids) {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result?.dataUrl) {
          results.set(id, request.result.dataUrl);
        }
        remaining--;
        if (remaining === 0) resolve(results);
      };
      request.onerror = () => {
        remaining--;
        if (remaining === 0) resolve(results);
      };
    }
  });
}

export async function deleteMultipleImageBlobs(ids: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);

    for (const id of ids) {
      store.delete(id);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
