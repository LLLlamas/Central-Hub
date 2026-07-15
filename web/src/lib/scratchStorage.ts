// localStorage persistence for scratch tours (multi-tour). Only the scratch
// Tour is persisted per-tour, plus a lightweight tours-index for the "My
// Shows" switcher. AppState's overlay Maps (lockedDays, sectionEdits,
// visibilityEdits, …) are NOT persisted here — they reset on reload by design.
//
// The scratch Tour is plain JSON-serializable data (no Map/Set/Date), so
// JSON.stringify round-trips it cleanly. The uploaded PDF file itself is
// never stored — only the parsed import metadata — so the payload stays
// well under the localStorage quota.

import type { ID, Tour, TourSummary } from '@/types';
import { summarizeTour } from '@/lib/tourSummary';
import { getNowIso } from '@/lib/today';

function tourKey(tourId: ID): string {
  return `tour-hub:tour:${tourId}`;
}

const TOURS_INDEX_KEY = 'tour-hub:tours-index';

// Structural sanity check: valid JSON can still be the wrong shape (a number,
// string, or an object missing the array fields the app reads). Such a payload
// would crash callers that do `tour.days.length`, so treat it as corrupt.
export function isTourShaped(value: unknown): value is Tour {
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
 * Restore a persisted scratch tour by id. Returns null when nothing is
 * stored or the payload is corrupt/wrong-shape — AppState then builds a
 * fresh shell.
 */
export function loadScratchTour(tourId: ID): Tour | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(tourKey(tourId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isTourShaped(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Strip large/derivable, or plain runtime-only, fields from the tour before
 * serializing:
 *  - `RiderSection.plots[*].dataUrl` — base64-encoded PNGs of plot pages. Even
 *    a handful of 2x-scale pages can push 2-3 MB into localStorage (quota is
 *    5-10 MB). Re-derived from the source PDF on app boot — see
 *    `hydrateRiderPlotImages` in `data/riderFixture.ts`.
 *  - `RiderSection.media[*].objectUrl` — Blob URLs for locally-uploaded stage
 *    media, session-scoped like `pdfObjectUrl` below. Re-minted on app boot
 *    from the document store — see the stage-media rehydration effect in
 *    `state/AppState.tsx`. Applies to every section of every rider import, not
 *    just the active one, mirroring the `plots` stripping just above it.
 */
export function stripForPersistence(tour: Tour): Tour {
  return {
    ...tour,
    riderImports: tour.riderImports.map((ri) => {
      const { pdfObjectUrl: _omitUrl, ...rest } = ri;
      return {
        ...rest,
        sections: rest.sections.map((s) => {
          if (!s.plots && !s.media) return s;
          return {
            ...s,
            plots: s.plots?.map(({ dataUrl: _omit, width: _w, height: _h, ...keep }) => keep),
            media: s.media?.map(({ objectUrl: _omitObj, ...keep }) => keep),
          };
        }),
      };
    }),
  };
}

/** Read the "My Shows" tours index. Returns [] on missing/corrupt data. */
export function loadToursIndex(): TourSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TOURS_INDEX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as TourSummary[]) : [];
  } catch {
    return [];
  }
}

function saveToursIndex(index: TourSummary[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOURS_INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    console.warn('[scratchStorage] could not persist tours index:', err);
  }
}

// Replace the entry with a matching id, or append if new. Never touches
// other tours' entries.
function upsertTourSummary(summary: TourSummary): void {
  const index = loadToursIndex();
  const i = index.findIndex((t) => t.id === summary.id);
  if (i >= 0) {
    index[i] = summary;
  } else {
    index.push(summary);
  }
  saveToursIndex(index);
}

export function saveScratchTour(tourId: ID, scratchTour: Tour | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (scratchTour) {
      window.localStorage.setItem(tourKey(tourId), JSON.stringify(stripForPersistence(scratchTour)));
      upsertTourSummary(summarizeTour(scratchTour, getNowIso()));
    } else {
      window.localStorage.removeItem(tourKey(tourId));
    }
  } catch (err) {
    // Quota exceeded or storage unavailable — degrade to in-memory only.
    console.warn('[scratchStorage] could not persist scratch tour:', err);
  }
}

export function clearScratchTour(tourId: ID): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(tourKey(tourId));
    saveToursIndex(loadToursIndex().filter((t) => t.id !== tourId));
  } catch {
    /* ignore */
  }
}

export function createTourId(): ID {
  return `tour_${crypto.randomUUID()}`;
}
