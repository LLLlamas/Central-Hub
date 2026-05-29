// IndexedDB persistence for uploaded rider PDF bytes.
//
// localStorage holds the parsed RiderImport metadata; the raw PDF bytes live
// here so the embedded viewer + every "open the rider PDF" affordance survives
// a page refresh. On boot, AppStateProvider rehydrates a Blob URL from these
// bytes and assigns it to `RiderImport.pdfObjectUrl`.
//
// Keyed by `RiderImport.id` so re-uploads (which mint a new id) don't collide
// with the prior rider's bytes — they're cleaned up explicitly via
// `deleteRiderPdf` / `clearAllRiderPdfs`. Native IndexedDB only, no deps.
//
// In non-browser environments (SSR, vitest jsdom-less) every call resolves
// to a benign no-op / null so callers don't need to feature-detect.

const DB_NAME = 'tour-hub';
const DB_VERSION = 1;
const STORE = 'rider-pdfs';

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
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

export async function saveRiderPdf(id: string, bytes: ArrayBuffer): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bytes, id);
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn('[riderPdfStore] saveRiderPdf failed:', err);
  }
}

export async function loadRiderPdf(id: string): Promise<ArrayBuffer | null> {
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
    console.warn('[riderPdfStore] loadRiderPdf failed:', err);
    return null;
  }
}

export async function deleteRiderPdf(id: string): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn('[riderPdfStore] deleteRiderPdf failed:', err);
  }
}

export async function clearAllRiderPdfs(): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn('[riderPdfStore] clearAllRiderPdfs failed:', err);
  }
}
