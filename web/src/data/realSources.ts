// =============================================================
// REAL DATA SOURCES REGISTRY
// -------------------------------------------------------------
// Mirror of sources.ts but for data that IS real (not mocked).
// Lets the UI surface a small "(i)" indicator next to real
// values with a click-to-popup showing exactly which document,
// section, and page the data came from.
//
// Most real data comes from the rider PDF:
//   RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf
//
// A few values are user-provided (e.g. Lorenzo Llamas as TM).
// =============================================================

export interface RealSource {
  /** Originating document — for the rider, always the same; for user input, "User entry". */
  document: string;
  /** Section reference, e.g. "§6 Input-Output" or "Cover page". */
  section: string;
  /** Page number(s) in the source PDF. */
  pages?: number[];
  /** Optional verbatim quote of the source text. */
  quote?: string;
  /** Optional detail / explanation. */
  detail?: string;
  /** Optional URL to the source artifact (e.g. /rider.pdf#page=6). */
  artifactUrl?: string;
  /** Friendly artifact label for the link. */
  artifactLabel?: string;
}

const RIDER_DOC = 'Rider PDF · Elsa y Elmar — Full Band 2025';
const RIDER_FILE = '/RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf';

export const realSources = {
  // ---- Rider cover (page 1) ----------------------------------
  rider_cover: {
    document: RIDER_DOC,
    section: 'Cover page',
    pages: [1],
    quote: 'TECH RIDER | Full Band 2025 — Updated: September 2025',
    detail: 'Page 1 carries the tour identity, the revision date, and the production manager contact. Also contains "FAVOR OMITIR VERSIONES ANTERIORES" (please ignore previous versions).',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_pm_contact: {
    document: RIDER_DOC,
    section: 'Cover page — production contacts',
    pages: [1],
    quote: 'Manuel González · magcs81@gmail.com · +52 55 54 74 70 48',
    detail: 'Production Manager contact block on the rider cover page.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_artist: {
    document: RIDER_DOC,
    section: 'Cover page + §6 monitor mixes',
    pages: [1, 6, 7],
    quote: 'Title: "TECH RIDER | Full Band 2025". §6 mix: "MAIN — ELSA".',
    detail: 'Artist name appears on the cover and is reinforced by the monitor mix labels in §6.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },

  // ---- Personnel — band members named in the rider ----------
  rider_person_elsa: {
    document: RIDER_DOC,
    section: '§6 monitor mixes · §12 rooming list',
    pages: [6, 7, 23],
    quote: '§6: "MAIN — ELSA" · §12: "Junior Suite: Elsa Carvajal"',
    detail: 'Full name "Elsa Carvajal" appears in the rooming list. First name "ELSA" also appears in the monitor mix labels and as the voice mic channel (CH 34).',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_person_julian: {
    document: RIDER_DOC,
    section: '§6 input list + monitor mixes · §12 rooming list',
    pages: [6, 7, 23],
    quote: '§6: "GUITAR — JULIAN", "Vox JULIAN (gtr)" · §12: "Single: Julian Bernal"',
    detail: 'Full name "Julian Bernal" appears in the rooming list. Cross-referenced from CH 36 (Vox JULIAN) and the GUITAR monitor mix.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_person_juan: {
    document: RIDER_DOC,
    section: '§6 monitor mixes · §12 rooming list',
    pages: [6, 7, 23],
    quote: '§6: "DRUM — JUAN" · §12: "Single: Drummer (Juan)"',
    detail: 'First name "Juan" appears in the DRUM monitor mix label and is parenthetically noted as the drummer in the rooming list. Last name is NOT in the rider — needs TM input.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_person_daniel: {
    document: RIDER_DOC,
    section: '§6 monitor mixes · §12 rooming list',
    pages: [6, 7, 23],
    quote: '§6: "BASS — DANIEL" · §12: "Single: Bassist (Daniel)"',
    detail: 'First name "Daniel" appears in the BASS monitor mix label and is parenthetically noted as the bassist in the rooming list. Last name is NOT in the rider — needs TM input.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_person_manuel: {
    document: RIDER_DOC,
    section: 'Cover page — production contacts',
    pages: [1],
    quote: 'Manuel González · magcs81@gmail.com · +52 55 54 74 70 48',
    detail: 'Production Manager named on the rider cover with email and phone.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },

  // ---- Party size / counts -----------------------------------
  rider_party_size: {
    document: RIDER_DOC,
    section: '§11 Transport + §12 Lodging',
    pages: [22, 23],
    quote: '§11: "8 tickets total: 2 AM Plus + 6 economy" · §12: "10 rooms / 11 people"',
    detail: 'Party size derived from §11 (air transport ticket count) and §12 (rooming list header). Counts disagree across the rider — see the conflicts panel.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_rooms: {
    document: RIDER_DOC,
    section: '§12 Lodging — rooming list',
    pages: [23],
    quote: '10 rooms (1 Junior Suite, 7 singles, 2 doubles)',
    detail: 'From the §12 rooming list. Note: rows total 13 occupants (rider header says 11) — flagged in conflicts.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_flight_tickets: {
    document: RIDER_DOC,
    section: '§11 Air transport',
    pages: [22],
    quote: '"8 tickets total: 2 AM Plus (front-row economy, seated together) + 6 economy"',
    detail: 'From §11. Direct flights preferred. TM approval required. All with 25kg bag, 2 passengers get 2 bags.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },

  // ---- Per-section data --------------------------------------
  rider_input_list: {
    document: RIDER_DOC,
    section: '§6 Input-Output — input list',
    pages: [6],
    detail: '44-channel input list with verbatim source labels, mic/DI model numbers, stand types, and phantom-power flags.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_monitor_mix: {
    document: RIDER_DOC,
    section: '§6 Input-Output — monitor outputs',
    pages: [6, 7],
    detail: '8 stereo monitor mixes; band names parsed from mix labels (Elsa, Juan, Daniel, Julian).',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_foh_outputs: {
    document: RIDER_DOC,
    section: '§6 Input-Output — FOH output patch',
    pages: [7],
    detail: '8 FOH outputs (SMPTE feed, talkback speaker, light/video send, main LR, sub, front fill).',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_backline: {
    document: RIDER_DOC,
    section: '§9 Backline',
    pages: [19, 20],
    detail: '3 drum-kit options, 3 bass rig options, 3 guitar amps (incl. spare), keyboard + percussion stands. Negative constraints captured: "NOT Yamaha hi-hat", "NOT motorcycle seat".',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_lodging: {
    document: RIDER_DOC,
    section: '§12 Lodging — rooming list',
    pages: [23],
    detail: 'Rooming list with full names where given, role placeholders otherwise.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_catering: {
    document: RIDER_DOC,
    section: '§14 Catering',
    pages: [25, 26],
    detail: '7 menus by room × time-of-day. Excluded brands captured ("NOT Sol", "NOT Corona"). Dietary tags and biodegradable disposables required.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_soundcheck: {
    document: RIDER_DOC,
    section: '§10 Soundcheck',
    pages: [21],
    quote: 'Closed-door soundcheck. Minimum 6 hours from load-in.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },
  rider_stage_specs: {
    document: RIDER_DOC,
    section: '§4 Stage specs',
    pages: [4],
    detail: 'Stage dimensions, ground support, barricade requirements, generators/power, ambulance required.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },

  // ---- Conflicts (derived from real rider sections) ---------
  rider_conflicts_derived: {
    document: RIDER_DOC,
    section: 'Cross-section conflict detection (§4 / §6 / §8 / §11 / §12)',
    pages: [4, 6, 8, 22, 23],
    detail:
      'Each conflict below is a REAL contradiction present in the rider PDF — not synthetic. The detector cross-references claims between sections (e.g., §11 says 8 flight tickets but §12 lists 11–12 occupants) and flags the discrepancy. Conflicts are never auto-resolved: a human always decides. The detector logic itself is automated; the conflicts it surfaces are facts about the rider.',
    artifactUrl: RIDER_FILE,
    artifactLabel: 'Open rider PDF',
  },

} satisfies Record<string, RealSource>;

export type RealSourceKey = keyof typeof realSources;

export function getRealSource(key: RealSourceKey): RealSource {
  return realSources[key] as RealSource;
}
