// Rider fixture for scratch mode.
//
// The scratch-mode rider IS the Elsa y Elmar rider — the same PDF the demo
// tour uses. Rather than duplicating the ~500 lines of extracted rider
// sections, scratch mode reuses the demo rider import and the personnel the
// rider names. Clones are returned so scratch-mode edits never mutate the
// shared demo data.

import { mockTour } from '@/data/mockTour';
import { MOCK_NOW } from '@/lib/today';
import type { RiderImport, TourPerson } from '@/types';

// Rider/personnel records are plain JSON-safe data — a JSON round-trip is a
// dependency-free deep clone (no Date/Map/Set in these types).
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A fresh RiderImport for the scratch tour — a clone of the demo rider. */
export function buildScratchRiderImport(): RiderImport {
  const ri = clone(mockTour.riderImports[0]);
  ri.uploadedBy = 'Tour Manager';
  ri.uploadedAt = MOCK_NOW;
  return ri;
}

/**
 * The personnel the rider names — the band + crew. Excludes the demo Tour
 * Manager (`tp_lorenzo`): the scratch tour already has its own TM.
 */
export function buildScratchRiderPersonnel(): TourPerson[] {
  return clone(mockTour.personnel.filter((p) => p.id !== 'tp_lorenzo'));
}
