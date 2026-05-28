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

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage() };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('scratchStorage round-trip', () => {
  it('returns null for a new visitor with nothing stored', () => {
    expect(loadScratchTour()).toBeNull();
  });

  it('persists and restores a scratch tour deep-equal', () => {
    const tour = createScratchTour();
    saveScratchTour(tour);
    expect(loadScratchTour()).toEqual(tour);
  });

  it('saving null removes the stored tour', () => {
    saveScratchTour(createScratchTour());
    saveScratchTour(null);
    expect(loadScratchTour()).toBeNull();
  });

  it('discards a corrupt stored payload', () => {
    window.localStorage.setItem('tour-hub:scratch-tour', '{not valid json');
    expect(loadScratchTour()).toBeNull();
  });

  it('discards valid JSON that is not Tour-shaped', () => {
    // Valid JSON, wrong shape — would crash callers doing `tour.days.length`.
    for (const payload of ['"a string"', '42', '[]', '{"id":"x"}']) {
      window.localStorage.setItem('tour-hub:scratch-tour', payload);
      expect(loadScratchTour()).toBeNull();
    }
  });

  it('clearScratchTour removes the stored tour', () => {
    saveScratchTour(createScratchTour());
    clearScratchTour();
    expect(window.localStorage.getItem('tour-hub:scratch-tour')).toBeNull();
  });
});
