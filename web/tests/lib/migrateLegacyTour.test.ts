import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrateLegacyTourIfNeeded } from '@/lib/migrateLegacyTour';
import { loadScratchTour } from '@/lib/scratchStorage';
import { loadOverlays, type OverlayBundle } from '@/lib/overlayStorage';
import { createScratchTour } from '@/data/scratchTour';
import type { Tour } from '@/types';

// Minimal in-memory localStorage so the module's window guards pass under the
// Node test environment — same pattern as scratchStorage.test.ts.
function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
}

const LEGACY_TOUR_KEY = 'tour-hub:scratch-tour';
const LEGACY_OVERLAYS_KEY = 'tour-hub:scratch-overlays';
const MIGRATED_FLAG_KEY = 'tour-hub:migrated-v2';
const TOURS_INDEX_KEY = 'tour-hub:tours-index';
const LEGACY_TOUR_ID = 'tour_legacy-1';

function minimalBundle(): OverlayBundle {
  return {
    lockedDays: [],
    resolvedConflicts: [],
    dayUpdates: [],
    sectionApprovals: [],
    sectionEdits: [],
    pendingEdits: [],
    pendingConflictResolutions: [],
    sectionEditHistory: [],
    dayLockHistory: [],
    visibilityEdits: [],
    pendingVisibilityEdits: [],
    visibilityEditHistory: [],
    scheduleItemEditHistory: [],
    flightPassengerResolutions: [],
    userKey: 'tp_scratch_tm',
  };
}

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage() };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('migrateLegacyTourIfNeeded', () => {
  it('no-ops on a fresh install (no legacy data) and just sets the flag', async () => {
    await migrateLegacyTourIfNeeded();

    expect(window.localStorage.getItem(MIGRATED_FLAG_KEY)).toBe('1');
    expect(window.localStorage.getItem(TOURS_INDEX_KEY)).toBeNull();
    expect(loadScratchTour(LEGACY_TOUR_ID)).toBeNull();
  });

  it('migrates a legacy tour + overlay bundle into the per-tour scheme', async () => {
    const legacyTour: Tour = createScratchTour(LEGACY_TOUR_ID);
    const legacyBundle = minimalBundle();
    window.localStorage.setItem(LEGACY_TOUR_KEY, JSON.stringify(legacyTour));
    window.localStorage.setItem(LEGACY_OVERLAYS_KEY, JSON.stringify(legacyBundle));

    await migrateLegacyTourIfNeeded();

    // New per-tour key holds the migrated tour, keyed by the legacy tour's own id.
    const migrated = loadScratchTour(LEGACY_TOUR_ID);
    expect(migrated).toEqual(legacyTour);

    // Overlays migrated alongside it.
    expect(loadOverlays(LEGACY_TOUR_ID)).toEqual(legacyBundle);

    // Tours-index seeded with exactly one entry for this tour (side effect of
    // saveScratchTour).
    const index = JSON.parse(window.localStorage.getItem(TOURS_INDEX_KEY) ?? '[]');
    expect(index).toHaveLength(1);
    expect(index[0].id).toBe(LEGACY_TOUR_ID);

    // Old fixed keys are gone.
    expect(window.localStorage.getItem(LEGACY_TOUR_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_OVERLAYS_KEY)).toBeNull();

    // Flag set so it doesn't run again.
    expect(window.localStorage.getItem(MIGRATED_FLAG_KEY)).toBe('1');
  });

  it('is idempotent — running twice does not duplicate the tours index', async () => {
    const legacyTour: Tour = createScratchTour(LEGACY_TOUR_ID);
    window.localStorage.setItem(LEGACY_TOUR_KEY, JSON.stringify(legacyTour));
    window.localStorage.setItem(LEGACY_OVERLAYS_KEY, JSON.stringify(minimalBundle()));

    await migrateLegacyTourIfNeeded();
    await migrateLegacyTourIfNeeded();

    const index = JSON.parse(window.localStorage.getItem(TOURS_INDEX_KEY) ?? '[]');
    expect(index).toHaveLength(1);
    expect(loadScratchTour(LEGACY_TOUR_ID)).toEqual(legacyTour);
  });

  it('handles a legacy tour with no overlay bundle present', async () => {
    const legacyTour: Tour = createScratchTour(LEGACY_TOUR_ID);
    window.localStorage.setItem(LEGACY_TOUR_KEY, JSON.stringify(legacyTour));

    await migrateLegacyTourIfNeeded();

    expect(loadScratchTour(LEGACY_TOUR_ID)).toEqual(legacyTour);
    expect(loadOverlays(LEGACY_TOUR_ID)).toBeNull();
    expect(window.localStorage.getItem(MIGRATED_FLAG_KEY)).toBe('1');
  });

  it('discards a corrupt legacy payload as if fresh install', async () => {
    window.localStorage.setItem(LEGACY_TOUR_KEY, '{not valid json');

    await migrateLegacyTourIfNeeded();

    expect(window.localStorage.getItem(MIGRATED_FLAG_KEY)).toBe('1');
    expect(window.localStorage.getItem(LEGACY_TOUR_KEY)).toBe('{not valid json');
  });
});

// Note: the IndexedDB re-key path (rider-pdfs / documents stores) is not
// exercised here. The project's vitest environment is `node` with no
// IndexedDB polyfill (no fake-indexeddb dependency in package.json), so
// `migrateLegacyTourIfNeeded`'s `hasIdb()` guard is always false under test —
// the re-key code path only runs in a real browser. Covered by inspection.
