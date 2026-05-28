// Filename-matched fixture registry for scratch mode.
//
// There is no backend and no real PDF/CSV parsing yet. In scratch mode an
// upload is matched by filename against this registry; a match populates the
// known mock data that file represents. An unknown file is treated as a
// "sample only" — the UI says so rather than pretending to parse it.
//
// When a real ingest backend exists this registry is replaced by an actual
// upload → parse pipeline. See CLAUDE.md "Data modes".

export type FixtureKind = 'route' | 'rider' | 'flight' | 'travel_grid' | 'hotel';

export interface Fixture {
  id: string;
  kind: FixtureKind;
  /** Exact filename shipped in web/public/. */
  filename: string;
  /** Short human label for the file. */
  label: string;
  /** Terse description of what importing it populates. */
  extracts: string;
}

export const FIXTURES: Fixture[] = [
  {
    id: 'route_mexico_7day',
    kind: 'route',
    filename: 'mock-tour-route-mexico-7day.csv',
    label: 'Tour route — Mexico leg (7 days)',
    extracts: '7 tour days, 2 venues, and a show-day schedule skeleton.',
  },
  {
    id: 'rider_elsa_elmar',
    kind: 'rider',
    filename: 'RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf',
    label: 'Tech rider — Elsa y Elmar Full Band 2025',
    extracts: 'Rider sections, band roster, PM contact, and party size.',
  },
  {
    id: 'travel_grid_mexico',
    kind: 'travel_grid',
    filename: 'mock-travel-grid-mexico.csv',
    label: 'Travel-agent grid — Mexico leg',
    extracts: 'Both Mexico flights × 8 passengers in one bulk import (the agent’s grid).',
  },
  {
    id: 'flight_am19',
    kind: 'flight',
    filename: 'AM19_Group_LAX-MEX_2025-09-22.pdf',
    label: 'Flight AM 19 — LAX → CDMX',
    extracts: 'A LAX→CDMX flight (Sep 22) with 8 passengers, for review.',
  },
  {
    id: 'flight_vb1014',
    kind: 'flight',
    filename: 'VB1014_Group_MEX-MTY_2025-09-27.pdf',
    label: 'Flight VB 1014 — CDMX → Monterrey',
    extracts: 'A CDMX→MTY flight (Sep 27) with 8 passengers, for review.',
  },
  {
    id: 'hotel_block_mexico',
    kind: 'hotel',
    filename: 'Hotel_Block_Mexico_2025-09.pdf',
    label: 'Hotel block — Mexico leg (2 hotels)',
    extracts: 'The CDMX + Monterrey hotel blocks, rooming lists, and hotel-advance tasks.',
  },
];

// Normalize a filename for comparison: lowercase, trimmed, and with the
// browser's duplicate-download suffix (" (1)", " (2)", …) stripped.
function normalize(name: string): string {
  const lower = name.trim().toLowerCase();
  const dot = lower.lastIndexOf('.');
  const stem = dot >= 0 ? lower.slice(0, dot) : lower;
  const ext = dot >= 0 ? lower.slice(dot) : '';
  return stem.replace(/\s*\(\d+\)\s*$/, '').trim() + ext;
}

/** Match an uploaded file (by name) to a known fixture, or null if unknown. */
export function matchFixture(filename: string): Fixture | null {
  const target = normalize(filename);
  return FIXTURES.find((f) => normalize(f.filename) === target) ?? null;
}

/** All fixtures of a given kind — used to tell the user what to upload. */
export function fixturesOfKind(kind: FixtureKind): Fixture[] {
  return FIXTURES.filter((f) => f.kind === kind);
}

/**
 * The warning note for an upload that didn't match the step's expected kind:
 * either a known fixture for a different step, or an unrecognized file.
 * `expect` describes what this step wants (e.g. 'a CSV', 'a flight PDF');
 * `sampleFilename` is the canonical fixture to suggest for the unknown case.
 */
export function nonMatchNote(
  file: File,
  matched: Fixture | null,
  expect: string,
  sampleFilename: string,
): { tone: 'warning'; title: string; detail: string } {
  if (matched) {
    return {
      tone: 'warning',
      title: 'That file belongs to another step',
      detail: `"${file.name}" is a ${matched.kind} file. This step expects ${expect}.`,
    };
  }
  return {
    tone: 'warning',
    title: 'Sample only',
    detail: `"${file.name}" isn't a recognized sample. This prototype matches uploads by filename — upload "${sampleFilename}".`,
  };
}
