// IndexedDB persistence for general document bytes — route CSVs and hotel PDFs.
//
// Sibling to `riderPdfStore.ts`: same DB (`tour-hub`), but a separate object
// store (`documents`) added in DB_VERSION 2. The `rider-pdfs` store from v1 is
// preserved in the upgrade so rider bytes survive the version bump.
//
// Keyed by an arbitrary document id (e.g. the route-import filename or a hotel
// import id). Cleared explicitly via `deleteDocument` / `clearAllDocuments`.
// Native IndexedDB only, no deps.
//
// In non-browser environments (SSR, vitest jsdom-less) every call resolves to a
// benign no-op / null so callers don't need to feature-detect.

const DB_NAME = 'tour-hub';
const DB_VERSION = 2;
const RIDER_STORE = 'rider-pdfs';
const STORE = 'documents';

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RIDER_STORE)) db.createObjectStore(RIDER_STORE);
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveDocument(id: string, bytes: ArrayBuffer): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bytes, id);
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn('[documentStore] saveDocument failed:', err);
  }
}

export async function loadDocument(id: string): Promise<ArrayBuffer | null> {
  if (!hasIdb()) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    const value: unknown = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value instanceof ArrayBuffer ? value : null;
  } catch (err) {
    console.warn('[documentStore] loadDocument failed:', err);
    return null;
  }
}

export async function deleteDocument(id: string): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn('[documentStore] deleteDocument failed:', err);
  }
}

export async function clearAllDocuments(): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn('[documentStore] clearAllDocuments failed:', err);
  }
}
