// Shared cursor-walk for "delete every entry for this tour" across the
// `[tourId, id]`-keyed IndexedDB stores. `riderPdfStore.ts` and
// `documentStore.ts` both key their store this way and both need to wipe one
// tour's entries on reset without touching any other tour's — this is the one
// place that does the range-bound cursor delete instead of two copies of the
// same ~15-line control flow.
import type { ID } from '@/types';

export function deleteAllForTour(db: IDBDatabase, storeName: string, tourId: ID): Promise<void> {
  const tx = db.transaction(storeName, 'readwrite');
  const range = IDBKeyRange.bound([tourId, ''], [tourId, '￿']);
  const store = tx.objectStore(storeName);
  return new Promise<void>((resolve, reject) => {
    const req = store.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  }).then(() => new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  }));
}
