// IndexedDB persistence for uploaded rider PDF bytes.
//
// localStorage holds the parsed RiderImport metadata; the raw PDF bytes live
// here so the embedded viewer + every "open the rider PDF" affordance survives
// a page refresh. On boot, AppStateProvider rehydrates a Blob URL from these
// bytes and assigns it to `RiderImport.pdfObjectUrl`.
//
// Keyed by a compound `[tourId, RiderImport.id]` array key so re-uploads
// (which mint a new id) don't collide with the prior rider's bytes, and so
// two different tours can never collide even when their ids happen to match
// (e.g. timestamp-based ids). Cleaned up explicitly via `deleteRiderPdf` /
// `clearAllRiderPdfs`. Native IndexedDB only, no deps.
//
// In non-browser environments (SSR, vitest jsdom-less) every call resolves
// to a benign no-op / null so callers don't need to feature-detect.

import type { ID } from '@/types';
import { deleteAllForTour } from '@/lib/idbTourRange';

const DB_NAME = 'tour-hub';
// v2 adds the `documents` store (see lib/documentStore.ts). Both modules open
// the same DB, so they must share a version — opening at a lower version than
// the live DB throws VersionError. Create both stores in the upgrade so either
// entry point can be the one that runs the migration.
const DB_VERSION = 2;
const STORE = 'rider-pdfs';
const DOC_STORE = 'documents';

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(DOC_STORE)) db.createObjectStore(DOC_STORE);
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

export async function saveRiderPdf(tourId: ID, id: string, bytes: ArrayBuffer): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bytes, [tourId, id]);
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn('[riderPdfStore] saveRiderPdf failed:', err);
  }
}

export async function loadRiderPdf(tourId: ID, id: string): Promise<ArrayBuffer | null> {
  if (!hasIdb()) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get([tourId, id]);
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

export async function deleteRiderPdf(tourId: ID, id: string): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete([tourId, id]);
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn('[riderPdfStore] deleteRiderPdf failed:', err);
  }
}

export async function clearAllRiderPdfs(tourId: ID): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    await deleteAllForTour(db, STORE, tourId);
    db.close();
  } catch (err) {
    console.warn('[riderPdfStore] clearAllRiderPdfs failed:', err);
  }
}
