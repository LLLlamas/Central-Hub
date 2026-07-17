// One-time migration from the pre-multi-tour storage scheme (a single fixed
// localStorage tour + overlay bundle, and bare-string IndexedDB keys) to the
// per-tour scheme (`scratchStorage.ts` / `overlayStorage.ts` keyed by tourId,
// plus a "My Tours" tours-index; IndexedDB entries keyed by `[tourId, id]`).
//
// Runs once per browser, gated by the `tour-hub:migrated-v2` flag. No-ops
// entirely on the `supabase` backend, which never had this local-only scheme.
// Safe to call on every boot — cheap flag check when already migrated, and
// self-healing (doesn't set the flag / remove old data) if any step throws,
// so a failed migration simply retries next load instead of losing data.

import { BACKEND_KIND } from '@/lib/backend';
import { isTourShaped, saveScratchTour } from '@/lib/scratchStorage';
import { isBundleShaped, saveOverlays, type OverlayBundle } from '@/lib/overlayStorage';
import type { Tour } from '@/types';

const LEGACY_TOUR_KEY = 'tour-hub:scratch-tour';
const LEGACY_OVERLAYS_KEY = 'tour-hub:scratch-overlays';
const MIGRATED_FLAG_KEY = 'tour-hub:migrated-v2';

// Duplicated minimal constants (not exported from riderPdfStore.ts /
// documentStore.ts) — just enough to open the existing DB and walk its
// stores. Opened without an explicit version so we never race the app's own
// versioned `open()` calls elsewhere; if the DB doesn't exist yet this simply
// creates it with no object stores, which the re-key step treats as "nothing
// to migrate" for that store.
const DB_NAME = 'tour-hub';
const RIDER_STORE = 'rider-pdfs';
const DOC_STORE = 'documents';

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openRawDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
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

// Re-key every bare-string entry in one object store to `[tourId, oldKey]`.
// Skips entries whose key is already an array (already migrated, shouldn't
// happen but defensive) and no-ops entirely if the store doesn't exist yet.
async function rekeyStore(db: IDBDatabase, storeName: string, tourId: string): Promise<void> {
  if (!db.objectStoreNames.contains(storeName)) return;
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const keys = await requestToPromise(store.getAllKeys());
  for (const key of keys) {
    if (Array.isArray(key)) continue;
    const value = await requestToPromise(store.get(key));
    store.delete(key);
    store.put(value, [tourId, key]);
  }
  await txDone(tx);
}

async function rekeyIndexedDb(tourId: string): Promise<void> {
  if (!hasIdb()) return;
  const db = await openRawDb();
  try {
    await rekeyStore(db, RIDER_STORE, tourId);
    await rekeyStore(db, DOC_STORE, tourId);
  } finally {
    db.close();
  }
}

function readLegacyJson(key: string): unknown {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Synchronous fast-path check for `MigrationGate` — true for the
 * overwhelmingly common case (supabase, or a `local` user who's already been
 * migrated) so the gate can skip its async spinner render entirely instead of
 * always blocking first paint behind one tick of `migrateLegacyTourIfNeeded`.
 */
export function isAlreadyMigrated(): boolean {
  if (BACKEND_KIND === 'supabase') return true;
  if (typeof window === 'undefined') return true;
  return !!window.localStorage.getItem(MIGRATED_FLAG_KEY);
}

/**
 * Migrate the old fixed-key scratch tour + overlays (and IndexedDB bare-string
 * keys) into the new per-tour scheme, once. Safe to call unconditionally on
 * every app boot.
 */
export async function migrateLegacyTourIfNeeded(): Promise<void> {
  if (BACKEND_KIND === 'supabase') return;
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(MIGRATED_FLAG_KEY)) return;

  const legacyTourRaw = readLegacyJson(LEGACY_TOUR_KEY);
  const legacyTour: Tour | null = isTourShaped(legacyTourRaw) ? legacyTourRaw : null;

  if (!legacyTour) {
    // Fresh install (or already on the new scheme with the old keys already
    // cleared) — nothing to migrate.
    window.localStorage.setItem(MIGRATED_FLAG_KEY, '1');
    return;
  }

  const legacyOverlaysRaw = readLegacyJson(LEGACY_OVERLAYS_KEY);
  const legacyOverlays: OverlayBundle | null = isBundleShaped(legacyOverlaysRaw)
    ? legacyOverlaysRaw
    : null;

  const tourId = legacyTour.id;

  try {
    saveScratchTour(tourId, legacyTour);
    if (legacyOverlays) {
      saveOverlays(tourId, legacyOverlays);
    }
    await rekeyIndexedDb(tourId);

    window.localStorage.removeItem(LEGACY_TOUR_KEY);
    window.localStorage.removeItem(LEGACY_OVERLAYS_KEY);
    window.localStorage.setItem(MIGRATED_FLAG_KEY, '1');
  } catch (err) {
    console.warn('[migrateLegacyTour] migration failed, will retry next load:', err);
  }
}
