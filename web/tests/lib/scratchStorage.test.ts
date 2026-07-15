import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadScratchTour, saveScratchTour, clearScratchTour } from '@/lib/scratchStorage';
import { createScratchTour } from '@/data/scratchTour';

// Minimal in-memory localStorage so the module's window guards pass under the
// Node test environment.
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

const TOUR_ID = 'tour_test-1';

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage() };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('scratchStorage round-trip', () => {
  it('returns null for a new visitor with nothing stored', () => {
    expect(loadScratchTour(TOUR_ID)).toBeNull();
  });

  it('persists and restores a scratch tour deep-equal', () => {
    const tour = createScratchTour(TOUR_ID);
    saveScratchTour(TOUR_ID, tour);
    expect(loadScratchTour(TOUR_ID)).toEqual(tour);
  });

  it('saving null removes the stored tour', () => {
    saveScratchTour(TOUR_ID, createScratchTour(TOUR_ID));
    saveScratchTour(TOUR_ID, null);
    expect(loadScratchTour(TOUR_ID)).toBeNull();
  });

  it('discards a corrupt stored payload', () => {
    window.localStorage.setItem(`tour-hub:tour:${TOUR_ID}`, '{not valid json');
    expect(loadScratchTour(TOUR_ID)).toBeNull();
  });

  it('discards valid JSON that is not Tour-shaped', () => {
    // Valid JSON, wrong shape â€” would crash callers doing `tour.days.length`.
    for (const payload of ['"a string"', '42', '[]', '{"id":"x"}']) {
      window.localStorage.setItem(`tour-hub:tour:${TOUR_ID}`, payload);
      expect(loadScratchTour(TOUR_ID)).toBeNull();
    }
  });

  it('clearScratchTour removes the stored tour', () => {
    saveScratchTour(TOUR_ID, createScratchTour(TOUR_ID));
    clearScratchTour(TOUR_ID);
    expect(window.localStorage.getItem(`tour-hub:tour:${TOUR_ID}`)).toBeNull();
  });
});
