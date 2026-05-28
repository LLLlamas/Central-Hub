// localStorage persistence for the scratch tour.
// Only the scratch Tour is persisted. AppState's overlay Maps (lockedDays,
// sectionEdits, visibilityEdits, …) are NOT — they reset on reload by design.
//
// The scratch Tour is plain JSON-serializable data (no Map/Set/Date), so
// JSON.stringify round-trips it cleanly. The uploaded PDF file itself is
// never stored — only the parsed import metadata — so the payload stays
// well under the localStorage quota.

import type { Tour } from '@/types';

const TOUR_KEY = 'tour-hub:scratch-tour';

// Structural sanity check: valid JSON can still be the wrong shape (a number,
// string, or an object missing the array fields the app reads). Such a payload
// would crash callers that do `tour.days.length`, so treat it as corrupt.
function isTourShaped(value: unknown): value is Tour {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    Array.isArray(t.days) &&
    Array.isArray(t.legs) &&
    Array.isArray(t.scheduleItems) &&
    Array.isArray(t.personnel) &&
    Array.isArray(t.riderImports) &&
    Array.isArray(t.flightImports)
  );
}

/**
 * Restore the persisted scratch tour. Returns null when nothing is stored or
 * the payload is corrupt/wrong-shape — AppState then builds a fresh shell.
 */
export function loadScratchTour(): Tour | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TOUR_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isTourShaped(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveScratchTour(scratchTour: Tour | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (scratchTour) {
      window.localStorage.setItem(TOUR_KEY, JSON.stringify(scratchTour));
    } else {
      window.localStorage.removeItem(TOUR_KEY);
    }
  } catch (err) {
    // Quota exceeded or storage unavailable — degrade to in-memory only.
    console.warn('[scratchStorage] could not persist scratch tour:', err);
  }
}

export function clearScratchTour(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOUR_KEY);
  } catch {
    /* ignore */
  }
}
