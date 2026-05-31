/* ============================================================
 * TOUR DATA â€” Elsa y Elmar Â· Full Band 2025
 * ------------------------------------------------------------
 * This file mixes REAL data extracted from the rider PDF
 * (`RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf`)
 * with mock placeholders for everything not derivable from the
 * rider (tour route, calendar dates, flights, hotels, schedule
 * items). The UI flags mock values inline with <MockTag />.
 *
 * REAL (from rider PDF / handoff-post-pdf-interpret.md):
 *   - Artist name, production manager contact, band roster
 *   - Input list (44 channels) + monitor mixes (8) + FOH outputs (8)
 *   - Audio PA, stage specs, lighting equipment, backline,
 *     soundcheck rules, transport spec, rooming list, dressing
 *     rooms, catering menus, conflicts
 *
 * MOCK (no rider source â€” placeholders awaiting real data):
 *   - Tour dates and route (would come from agent deal memos)
 *   - Schedule item times (rider only says 6h soundcheck min)
 *   - Specific hotels and venues
 *   - Specific flight bookings (rider only gives counts)
 *   - Placeholder names for crew not named in the rider
 * ============================================================
 */

import type {
  Tour,
  Day,
  Group,
  GroupTag,
  Person,
  TourPerson,
  ScheduleItem,
  Travel,
  Hotel,
  Task,
  Document,
  FlightImport,
  RiderImport,
  RiderSection,
  Conflict,
  UpdateStamp,
} from '@/types';
import { vis } from '@/lib/visibility';

// ============================================================
// REAL Â· Organization (artist's team)
// Source: cover page of rider implies an artist team; we don't
// know the official name. Using a plausible placeholder.
// ============================================================
export const mockOrgId = 'org_elsa_team';

// ============================================================
// MOCK Â· Tour shell
// Real source: TM setup wizard after agent hand-off. The rider
// PDF tells us this is the "Full Band 2025" tour but contains
// NO route, NO dates, NO venues â€” that all comes from the
// booking agent's deal memo + routing spreadsheet (Phase 1).
// ============================================================
const tourId = 'tour_full_band_2026';

// ============================================================
// REAL/MOCK MIXED Â· Groups
// Mostly inferred from the rider's rooming list and monitor
// outputs (which roles exist on this tour). Exact group names
// are TM choice and would normally be copied from a prior tour.
// ============================================================
// Exported so the scratch tour (data/scratchTour.ts) reuses the exact same
// group taxonomy â€” groups are a reusable template, not tour-specific data.
export const groups: Group[] = [
  { id: 'grp_artist', name: 'Artist', color: '#b8392b', description: 'The band itself.' },
  { id: 'grp_aparty', name: 'A Party', color: '#d97a4a', description: 'Artist + close circle (MUA, personal).' },
  { id: 'grp_mgmt', name: 'Management', color: '#a07a2e', description: 'Tour manager, artist manager.' },
  { id: 'grp_production', name: 'Production', color: '#5a6638', description: 'PM, stage manager.' },
  { id: 'grp_audio', name: 'Audio', color: '#3c5a6a', description: 'Front-of-house engineer (rider Â§6).' },
  { id: 'grp_lighting', name: 'Lighting', color: '#7a5a8a', description: 'Lighting designer.' },
  { id: 'grp_video', name: 'Video', color: '#2e6478', description: 'VJ / playback.' },
  { id: 'grp_staff', name: 'Staff', color: '#6b665c', description: 'Touring staff (rooming list Â§12).' },
];

// Group tags â€” none in the rider for this tour size (1 audio engineer covers FOH+monitors).
const groupTags: GroupTag[] = [];

// ============================================================
// PERSONNEL
// Sources marked per-person below.
// ============================================================
const persons: Person[] = [
  // --- REAL from rider Â§6/Â§12
  { id: 'p_elsa', name: 'Elsa Carvajal' },
  { id: 'p_julian', name: 'Julian Bernal' },
  // --- REAL first name only (rider Â§6 monitor mix); last name unknown
  { id: 'p_juan', name: 'Juan' },
  { id: 'p_daniel', name: 'Daniel' },
  // --- REAL from rider cover page
  { id: 'p_manuel', name: 'Manuel GonzÃ¡lez', email: 'magcs81@gmail.com', phone: '+52 55 54 74 70 48' },
  // --- PLACEHOLDER Â· Tour Manager (real name TBD)
  { id: 'p_lorenzo', name: 'Tour Manager' },
  // --- PLACEHOLDERS for roles named in rider Â§12 but without names.
  //     These will be replaced when the TM provides crew names.
  { id: 'p_audio', name: 'Audio Engineer' },
  { id: 'p_lighting', name: 'Lighting Engineer' },
  { id: 'p_vj', name: 'VJ' },
  { id: 'p_mua', name: 'MUA' },
  { id: 'p_personal', name: 'Personal Asst' },
  { id: 'p_staff1', name: 'Staff #1' },
  { id: 'p_staff2', name: 'Staff #2' },
];
const personById = Object.fromEntries(persons.map((p) => [p.id, p]));

const TOUR_START = '2026-09-22';
const TOUR_END = '2026-10-23';

function tp(
  id: string,
  personId: string,
  role: string,
  groupId: string,
  tagIds: string[] = [],
  opts: { isPlaceholder?: boolean; startDate?: string; endDate?: string } = {},
): TourPerson {
  return {
    id,
    personId,
    person: personById[personId]!,
    role,
    groupId,
    tagIds,
    startDate: opts.startDate ?? TOUR_START,
    endDate: opts.endDate ?? TOUR_END,
    isPlaceholder: opts.isPlaceholder,
  };
}

const personnel: TourPerson[] = [
  // REAL Â· Artist (from rider Â§6 + Â§12)
  tp('tp_elsa', 'p_elsa', 'Lead Vocals', 'grp_artist'),
  tp('tp_julian', 'p_julian', 'Guitar & Backing Vox', 'grp_artist'),
  tp('tp_juan', 'p_juan', 'Drums', 'grp_artist', [], { isPlaceholder: true }),
  tp('tp_daniel', 'p_daniel', 'Bass', 'grp_artist', [], { isPlaceholder: true }),
  // REAL Â· Production (from rider cover)
  tp('tp_manuel', 'p_manuel', 'Production Manager', 'grp_production'),
  // PLACEHOLDER Â· Mgmt (TM name TBD, like the other unfilled crew roles)
  tp('tp_lorenzo', 'p_lorenzo', 'Tour Manager', 'grp_mgmt', [], { isPlaceholder: true }),
  // PLACEHOLDERS Â· technical crew (rider Â§12)
  tp('tp_audio', 'p_audio', 'Audio Engineer (FOH + Monitors)', 'grp_audio', [], { isPlaceholder: true }),
  tp('tp_lighting', 'p_lighting', 'Lighting Designer', 'grp_lighting', [], { isPlaceholder: true }),
  tp('tp_vj', 'p_vj', 'VJ / Playback', 'grp_video', [], { isPlaceholder: true }),
  // PLACEHOLDERS Â· A Party (rider Â§12 â€” share a single room)
  tp('tp_mua', 'p_mua', 'Makeup Artist', 'grp_aparty', [], { isPlaceholder: true }),
  tp('tp_personal', 'p_personal', 'Personal Assistant', 'grp_aparty', [], { isPlaceholder: true }),
  // PLACEHOLDERS Â· Staff (rider Â§12 double room)
  tp('tp_staff1', 'p_staff1', 'Touring Staff', 'grp_staff', [], { isPlaceholder: true }),
  tp('tp_staff2', 'p_staff2', 'Touring Staff', 'grp_staff', [], { isPlaceholder: true }),
];

// ============================================================
// MOCK Â· Days (auto-generated from tour date range â€” the
// route, cities, and DayTypes are all mock because the rider
// contains no tour route.)
// ============================================================
// MOCK Â· In production every record carries audit columns (updated_at /
// updated_by). Days created at calendar build-out default to this stamp;
// the demo-zone days below override it with more recent edits.
const TOUR_SETUP_STAMP: UpdateStamp = { at: '2026-07-05T16:20', by: 'Tour Manager' };

type DaySeed = Omit<Day, 'id'> & { id?: string };
function makeDay(seed: DaySeed): Day {
  return {
    id: seed.id ?? `day_${seed.date}`,
    legId: seed.legId,
    date: seed.date,
    dayType: seed.dayType,
    city: seed.city,
    country: seed.country,
    venueId: seed.venueId,
    notes: seed.notes,
    weather: seed.weather,
    sunrise: seed.sunrise,
    sunset: seed.sunset,
    published: seed.published,
    lastUpdated: seed.lastUpdated ?? TOUR_SETUP_STAMP,
  };
}

const days: Day[] = [
  // ---- MOCK Leg 1: Mexico ---------------------------------
  makeDay({ date: '2026-09-22', dayType: 'travel', city: 'LAX â†’ CDMX', country: 'MX', published: false, legId: 'leg_mx', lastUpdated: { at: '2026-09-21T18:30', by: 'Tour Manager' } }),
  makeDay({ date: '2026-09-23', dayType: 'rehearsal', city: 'Mexico City', country: 'MX', published: false, legId: 'leg_mx', lastUpdated: { at: '2026-09-22T11:05', by: 'Manuel GonzÃ¡lez' } }),
  makeDay({ date: '2026-09-24', dayType: 'rehearsal', city: 'Mexico City', country: 'MX', published: false, legId: 'leg_mx', lastUpdated: { at: '2026-09-23T14:15', by: 'Manuel GonzÃ¡lez' } }),
  makeDay({ date: '2026-09-25', dayType: 'show', city: 'Mexico City', country: 'MX', venueId: 'v_auditorio_nacional', published: false, legId: 'leg_mx', weather: { high: 24, low: 13, conditions: 'Partly cloudy' }, lastUpdated: { at: '2026-09-24T19:40', by: 'Tour Manager' } }),
  makeDay({ date: '2026-09-26', dayType: 'off', city: 'Mexico City', country: 'MX', published: false, legId: 'leg_mx', lastUpdated: { at: '2026-09-19T10:00', by: 'Tour Manager' } }),
  makeDay({ date: '2026-09-27', dayType: 'travel', city: 'CDMX â†’ MTY', country: 'MX', published: false, legId: 'leg_mx', lastUpdated: { at: '2026-09-24T16:20', by: 'Manuel GonzÃ¡lez' } }),
  makeDay({ date: '2026-09-28', dayType: 'show', city: 'Monterrey', country: 'MX', venueId: 'v_auditorio_banamex', published: false, legId: 'leg_mx', lastUpdated: { at: '2026-09-23T09:30', by: 'Manuel GonzÃ¡lez' } }),
  makeDay({ date: '2026-09-29', dayType: 'travel', city: 'MTY â†’ GDL', country: 'MX', published: false, legId: 'leg_mx' }),
  makeDay({ date: '2026-09-30', dayType: 'show', city: 'Guadalajara', country: 'MX', venueId: 'v_auditorio_telmex', published: false, legId: 'leg_mx' }),
  makeDay({ date: '2026-10-01', dayType: 'off', city: 'Guadalajara', country: 'MX', published: false, legId: 'leg_mx' }),
  makeDay({ date: '2026-10-02', dayType: 'travel', city: 'GDL â†’ LAX', country: 'US', published: false, legId: 'leg_mx' }),

  // ---- MOCK Leg 2: USA -----------------------------------
  makeDay({ date: '2026-10-03', dayType: 'show', city: 'Los Angeles', country: 'US', venueId: 'v_greek', published: false, legId: 'leg_us', lastUpdated: { at: '2026-09-12T13:00', by: 'Tour Manager' } }),
  makeDay({ date: '2026-10-04', dayType: 'off', city: 'Los Angeles', country: 'US', published: false, legId: 'leg_us' }),
  makeDay({ date: '2026-10-05', dayType: 'promo', city: 'Los Angeles', country: 'US', published: false, legId: 'leg_us' }),
  makeDay({ date: '2026-10-06', dayType: 'travel', city: 'LA â†’ SF', country: 'US', published: false, legId: 'leg_us' }),
  makeDay({ date: '2026-10-07', dayType: 'show', city: 'Oakland', country: 'US', venueId: 'v_fox', published: false, legId: 'leg_us' }),
  makeDay({ date: '2026-10-08', dayType: 'travel', city: 'SFO â†’ MIA', country: 'US', published: false, legId: 'leg_us' }),
  makeDay({ date: '2026-10-09', dayType: 'show', city: 'Miami', country: 'US', venueId: 'v_knight', published: false, legId: 'leg_us' }),
  makeDay({ date: '2026-10-10', dayType: 'off', city: 'Miami', country: 'US', published: false, legId: 'leg_us' }),
  makeDay({ date: '2026-10-11', dayType: 'travel', city: 'MIA â†’ BOG', country: 'CO', published: false, legId: 'leg_us' }),

  // ---- MOCK Leg 3: South America -------------------------
  makeDay({ date: '2026-10-12', dayType: 'show', city: 'BogotÃ¡', country: 'CO', venueId: 'v_movistar_bog', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-13', dayType: 'off', city: 'BogotÃ¡', country: 'CO', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-14', dayType: 'travel', city: 'BOG â†’ LIM', country: 'PE', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-15', dayType: 'show', city: 'Lima', country: 'PE', venueId: 'v_anfiteatro_lim', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-16', dayType: 'off', city: 'Lima', country: 'PE', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-17', dayType: 'travel', city: 'LIM â†’ SCL', country: 'CL', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-18', dayType: 'show', city: 'Santiago', country: 'CL', venueId: 'v_movistar_scl', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-19', dayType: 'off', city: 'Santiago', country: 'CL', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-20', dayType: 'travel', city: 'SCL â†’ BUE', country: 'AR', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-21', dayType: 'show', city: 'Buenos Aires', country: 'AR', venueId: 'v_movistar_bue', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-22', dayType: 'off', city: 'Buenos Aires', country: 'AR', published: false, legId: 'leg_sa' }),
  makeDay({ date: '2026-10-23', dayType: 'travel', city: 'BUE â†’ LAX', country: 'US', published: false, legId: 'leg_sa' }),
];

const dayByDate = Object.fromEntries(days.map((d) => [d.date, d]));

// ============================================================
// MOCK Â· Schedule items
// The rider specifies "6 hours soundcheck minimum from load-in"
// and "closed-door soundcheck" â€” that's all the schedule data
// it contains. Specific times below are mock.
// ============================================================
const scheduleItems: ScheduleItem[] = [
  // --- Show day Â· Mexico City (Sep 25) â€” fully fleshed ---
  { id: 'si_0925_busc', dayId: dayByDate['2026-09-25'].id, type: 'bus_call', title: 'Bus call (hotel lobby)', startTime: '08:30', visibility: vis.everyone('sees') },
  { id: 'si_0925_load', dayId: dayByDate['2026-09-25'].id, type: 'load_in', title: 'Crew load-in', startTime: '09:00', endTime: '12:00', location: 'Auditorio Nacional Â· Stage door', visibility: vis.onlyGroups(['grp_production', 'grp_audio', 'grp_lighting', 'grp_video'], 'sees') },
  { id: 'si_0925_lunch', dayId: dayByDate['2026-09-25'].id, type: 'lunch', title: 'Crew lunch', startTime: '12:30', endTime: '13:30', location: 'Camerino 03 (Crew)', visibility: vis.everyone('sees') },
  { id: 'si_0925_sndchk', dayId: dayByDate['2026-09-25'].id, type: 'soundcheck', title: 'Soundcheck â€” closed door (6h min from load-in)', startTime: '15:30', endTime: '17:30', location: 'Auditorio Nacional Â· Stage', notes: 'Closed door per rider Â§10', visibility: { default: 'sees', groups: { grp_artist: 'sees', grp_audio: 'owns', grp_lighting: 'sees' } } },
  { id: 'si_0925_press', dayId: dayByDate['2026-09-25'].id, type: 'press', title: 'Press junket â€” Rolling Stone MÃ©xico', startTime: '16:00', endTime: '16:45', location: 'Camerino 01 (Elsa)', sensitive: true, visibility: { default: 'blocked', groups: { grp_aparty: 'sees', grp_mgmt: 'sees' } } },
  { id: 'si_0925_dinner', dayId: dayByDate['2026-09-25'].id, type: 'dinner', title: 'Band dinner', startTime: '18:00', endTime: '19:00', visibility: { default: 'sees', groups: { grp_artist: 'sees', grp_aparty: 'sees' } } },
  { id: 'si_0925_doors', dayId: dayByDate['2026-09-25'].id, type: 'doors', title: 'Doors', startTime: '20:00', visibility: vis.everyone('sees') },
  { id: 'si_0925_set', dayId: dayByDate['2026-09-25'].id, type: 'set', title: 'Elsa y Elmar â€” Full Band set', startTime: '21:30', endTime: '23:15', location: 'Auditorio Nacional Â· Stage', visibility: vis.everyone('sees') },
  { id: 'si_0925_curfew', dayId: dayByDate['2026-09-25'].id, type: 'curfew', title: 'Curfew', startTime: '23:30', visibility: vis.everyone('sees') },
  { id: 'si_0925_lout', dayId: dayByDate['2026-09-25'].id, type: 'load_out', title: 'Load-out', startTime: '23:45', endTime: '03:00', visibility: vis.onlyGroups(['grp_production', 'grp_audio', 'grp_lighting', 'grp_video'], 'sees') },

  // --- Show day Â· Los Angeles (Oct 3) â€” partial ---
  { id: 'si_1003_busc', dayId: dayByDate['2026-10-03'].id, type: 'bus_call', title: 'Bus call', startTime: '09:00', visibility: vis.everyone('sees') },
  { id: 'si_1003_load', dayId: dayByDate['2026-10-03'].id, type: 'load_in', title: 'Crew load-in', startTime: '09:30', endTime: '12:30', location: 'The Greek Â· Stage door', visibility: vis.onlyGroups(['grp_production', 'grp_audio', 'grp_lighting', 'grp_video'], 'sees') },
  { id: 'si_1003_sndchk', dayId: dayByDate['2026-10-03'].id, type: 'soundcheck', title: 'Soundcheck â€” closed door', startTime: '15:00', endTime: '16:30', visibility: { default: 'sees', groups: { grp_artist: 'sees', grp_audio: 'owns' } } },
  { id: 'si_1003_doors', dayId: dayByDate['2026-10-03'].id, type: 'doors', title: 'Doors', startTime: '19:00', visibility: vis.everyone('sees') },
  { id: 'si_1003_set', dayId: dayByDate['2026-10-03'].id, type: 'set', title: 'Elsa y Elmar â€” Full Band set', startTime: '20:30', endTime: '22:30', visibility: vis.everyone('sees') },

  // --- Promo day Â· LA (Oct 5) ---
  { id: 'si_1005_p1', dayId: dayByDate['2026-10-05'].id, type: 'press', title: 'NPR Alt.Latino interview', startTime: '10:00', endTime: '11:00', location: 'NPR West Â· Culver City', sensitive: true, visibility: { default: 'blocked', groups: { grp_aparty: 'sees', grp_mgmt: 'sees' } } },
  { id: 'si_1005_p2', dayId: dayByDate['2026-10-05'].id, type: 'press', title: 'Billboard photoshoot', startTime: '14:00', endTime: '16:30', location: 'Quixote Studios', sensitive: true, visibility: { default: 'blocked', groups: { grp_aparty: 'sees', grp_mgmt: 'sees' } } },
  { id: 'si_1005_meet', dayId: dayByDate['2026-10-05'].id, type: 'meet_greet', title: 'VIP meet & greet', startTime: '18:00', endTime: '19:00', visibility: { default: 'blocked', groups: { grp_aparty: 'sees', grp_mgmt: 'sees' } } },

  // --- Rehearsal day Â· CDMX (Sep 23) ---
  { id: 'si_0923_call', dayId: dayByDate['2026-09-23'].id, type: 'lobby_call', title: 'Hotel lobby call', startTime: '10:00', visibility: vis.everyone('sees') },
  { id: 'si_0923_reh', dayId: dayByDate['2026-09-23'].id, type: 'rehearsal', title: 'Production rehearsal', startTime: '11:00', endTime: '18:00', location: 'Foro Indie Rocks (rented)', visibility: vis.everyone('sees') },
];

// ============================================================
// MOCK Â· Travel (rider Â§11 specifies 2 vans + 1 cargo + 8
// flights but no specific flights/dates).
// ============================================================
const travel: Travel[] = [
  {
    id: 'tr_lax_cdmx',
    dayId: dayByDate['2026-09-22'].id,
    mode: 'flight',
    carrier: 'AeromÃ©xico',
    identifier: 'AM 19',
    from: 'LAX',
    to: 'MEX',
    departTime: '09:35',
    arriveTime: '15:20',
    recordLocator: 'ABCD12',
    passengers: [
      { tourPersonId: 'tp_elsa', seat: '2A' },
      { tourPersonId: 'tp_julian', seat: '2C' },
      { tourPersonId: 'tp_juan', seat: '3A' },
      { tourPersonId: 'tp_daniel', seat: '3C' },
      { tourPersonId: 'tp_lorenzo', seat: '4A' },
      { tourPersonId: 'tp_manuel', seat: '4C' },
      { tourPersonId: 'tp_audio', seat: '5A' },
      { tourPersonId: 'tp_mua', seat: '5C' },
    ],
    visibility: { default: 'sees', groups: { grp_aparty: 'sees', grp_mgmt: 'sees' } },
  },
  {
    id: 'tr_cdmx_mty',
    dayId: dayByDate['2026-09-27'].id,
    mode: 'flight',
    carrier: 'VivaAerobus',
    identifier: 'VB 1014',
    from: 'MEX',
    to: 'MTY',
    departTime: '11:00',
    arriveTime: '12:35',
    recordLocator: 'XYZ987',
    passengers: personnel.map((p) => ({ tourPersonId: p.id })),
    visibility: vis.everyone('sees'),
  },
  {
    id: 'tr_la_oak',
    dayId: dayByDate['2026-10-06'].id,
    mode: 'bus',
    carrier: 'Hemphill Brothers',
    identifier: 'Bus 1',
    from: 'Los Angeles',
    to: 'Oakland',
    departTime: '22:00',
    arriveTime: '08:00',
    passengers: personnel.filter((p) => ['grp_production', 'grp_audio', 'grp_lighting'].includes(p.groupId)).map((p) => ({ tourPersonId: p.id })),
    visibility: vis.everyone('sees'),
  },
];

// ============================================================
// MOCK Â· Hotels (rider Â§12 gives rooming list + room-type
// requirements but no specific hotel.)
// ============================================================
const hotels: Hotel[] = [
  {
    id: 'h_cdmx_st_regis',
    dayId: dayByDate['2026-09-23'].id,
    name: 'St. Regis Mexico City',
    address: 'Paseo de la Reforma 439, CuauhtÃ©moc, 06500 Ciudad de MÃ©xico',
    phone: '+52 55 5228 1818',
    checkIn: '15:00',
    checkOut: '12:00',
    nights: 3,
    occupants: [
      { tourPersonId: 'tp_elsa', roomNumber: '2104', roomType: 'Junior Suite' },
      { tourPersonId: 'tp_lorenzo', roomNumber: '2102', roomType: 'Single' },
      { tourPersonId: 'tp_manuel', roomNumber: '2106', roomType: 'Single' },
    ],
    sensitive: true,
    visibility: { default: 'blocked', groups: { grp_aparty: 'sees', grp_mgmt: 'sees' } },
  },
  {
    id: 'h_cdmx_nh',
    dayId: dayByDate['2026-09-23'].id,
    name: 'NH Collection Mexico City Reforma',
    address: 'Paseo de la Reforma 122, JuÃ¡rez, 06600',
    phone: '+52 55 5208 2222',
    checkIn: '15:00',
    checkOut: '12:00',
    nights: 3,
    occupants: [
      { tourPersonId: 'tp_julian', roomType: 'Single' },
      { tourPersonId: 'tp_juan', roomType: 'Single' },
      { tourPersonId: 'tp_daniel', roomType: 'Single' },
      { tourPersonId: 'tp_audio', roomType: 'Single' },
      // MUA + Personal Asst share a single room per rider Â§12
      { tourPersonId: 'tp_mua', roomNumber: '07', roomType: 'Single (shared)' },
      { tourPersonId: 'tp_personal', roomNumber: '07', roomType: 'Single (shared)' },
      { tourPersonId: 'tp_vj', roomType: 'Double' },
      { tourPersonId: 'tp_lighting', roomType: 'Double' },
      { tourPersonId: 'tp_staff1', roomType: 'Double' },
      { tourPersonId: 'tp_staff2', roomType: 'Double' },
    ],
    sensitive: false,
    visibility: vis.everyone('sees'),
  },
];

// ============================================================
// MOCK Â· Tasks
// ============================================================
const tasks: Task[] = [
  { id: 't_carnet', title: 'Confirm carnet status with customs broker before MX entry', dayId: dayByDate['2026-09-22'].id, ownerTourPersonId: 'tp_manuel', due: '2026-09-15T17:00', status: 'doing', visibility: vis.onlyGroups(['grp_production', 'grp_mgmt'], 'sees') },
  { id: 't_iems', title: 'Pick up 4 IEM packs returning from repair (Sennheiser SC)', ownerTourPersonId: 'tp_audio', due: '2026-09-20T17:00', status: 'todo', visibility: vis.onlyGroups(['grp_audio'], 'sees') },
  { id: 't_passes', title: 'Print pass laminates for all crew before LAX departure', dayId: dayByDate['2026-09-22'].id, ownerTourPersonId: 'tp_manuel', due: '2026-09-21T17:00', status: 'doing', visibility: vis.onlyGroups(['grp_production'], 'sees') },
];

// ============================================================
// REAL Â· Documents (the rider itself, with its revisions)
// Source: cover page says "Updated: September 2025". The
// "PLEASE IGNORE PREVIOUS VERSIONS" warning is captured.
// ============================================================
const documents: Document[] = [
  {
    id: 'doc_rider',
    kind: 'rider',
    title: 'Elsa y Elmar â€” Full Band 2025 Tech Rider',
    liveLink: 'https://tour-hub.example.com/r/eye-fb-2026',
    currentRevision: 2,
    revisions: [
      { id: 'rev_1', revision: 1, uploadedAt: '2026-07-03T14:22', uploadedBy: 'Manuel GonzÃ¡lez', sourceUrl: '#', sourceLanguage: 'es', pageCount: 27, notes: 'Original release (filename: 030725)' },
      { id: 'rev_2', revision: 2, uploadedAt: '2026-09-10T09:51', uploadedBy: 'Manuel GonzÃ¡lez', sourceUrl: '#', sourceLanguage: 'es', pageCount: 27, notes: 'September 2025 update â€” supersedes all previous versions' },
    ],
    visibility: vis.everyone('sees'),
  },
];

// ============================================================
// MOCK Â· Flight Imports (AI ingest queue) â€” kept for demoing
// the flight-ingest UI. Passenger names use real personnel.
// ============================================================
const flightImports: FlightImport[] = [
  {
    id: 'fi_lax_cdmx',
    filename: 'AM19_Group_LAX-MEX_2026-09-22.pdf',
    uploadedAt: '2026-09-01T11:24',
    status: 'imported',
    parsedFlights: [
      {
        airline: 'AeromÃ©xico',
        flightNumber: 'AM 19',
        departureAirport: 'LAX',
        arrivalAirport: 'MEX',
        departureTime: '2026-09-22T09:35',
        arrivalTime: '2026-09-22T15:20',
        recordLocator: 'ABCD12',
        passengers: [
          { name: 'Elsa Carvajal', seat: '2A', matchedTourPersonId: 'tp_elsa' },
          { name: 'Julian Bernal', seat: '2C', matchedTourPersonId: 'tp_julian' },
          { name: 'Juan', seat: '3A', matchedTourPersonId: 'tp_juan' },
          { name: 'Daniel', seat: '3C', matchedTourPersonId: 'tp_daniel' },
          { name: 'Tour Manager', seat: '4A', matchedTourPersonId: 'tp_lorenzo' },
          { name: 'Manuel GonzÃ¡lez', seat: '4C', matchedTourPersonId: 'tp_manuel' },
          { name: 'Audio Engineer', seat: '5A', matchedTourPersonId: 'tp_audio' },
          { name: 'MUA', seat: '5C', matchedTourPersonId: 'tp_mua' },
        ],
      },
    ],
    unmatchedNames: [],
  },
];

// ============================================================
// REAL Â· Rider Import â€” the 14 sections from the real PDF,
// extracted per the schemas in handoff-post-pdf-interpret.md.
// ============================================================

// --- Input list (Â§6) â€” 44 channels ---
const inputList44: NonNullable<RiderSection['inputList']> = [
  { channelNumber: 1, source: 'Kick In', micOrDi: 'Sennheiser e901', standType: 'none', phantom48v: true },
  { channelNumber: 2, source: 'Kick Out', micOrDi: 'Sennheiser e902', standType: 'mini_boom', phantom48v: false },
  { channelNumber: 3, source: 'Snare Top', micOrDi: 'Sennheiser e906', standType: 'clamp', phantom48v: false },
  { channelNumber: 4, source: 'Snare Bottom', micOrDi: 'Sennheiser e904', standType: 'clamp', phantom48v: false },
  { channelNumber: 5, source: 'Snare 2 Top', micOrDi: 'Sennheiser e906', standType: 'clamp', phantom48v: false },
  { channelNumber: 6, source: 'Snare 2 Bottom', micOrDi: 'Sennheiser e904', standType: 'clamp', phantom48v: false },
  { channelNumber: 7, source: 'Hi-Hat', micOrDi: 'Sennheiser e914', standType: 'tall_boom', phantom48v: true },
  { channelNumber: 8, source: 'Tom 1', micOrDi: 'Sennheiser e904', standType: 'clamp', phantom48v: false },
  { channelNumber: 9, source: 'Tom 2', micOrDi: 'Sennheiser e904', standType: 'clamp', phantom48v: false },
  { channelNumber: 10, source: 'Floor Tom', micOrDi: 'Sennheiser e904', standType: 'clamp', phantom48v: false },
  { channelNumber: 11, source: 'OH L', micOrDi: 'Sennheiser e914', standType: 'tall_boom', phantom48v: true },
  { channelNumber: 12, source: 'OH R', micOrDi: 'Sennheiser e914', standType: 'tall_boom', phantom48v: true },
  { channelNumber: 13, source: 'Roland SPD L', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  { channelNumber: 14, source: 'Roland SPD R', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  { channelNumber: 15, source: 'Playaudio Perc L', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false, notes: 'Playback' },
  { channelNumber: 16, source: 'Playaudio Perc R', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false, notes: 'Playback' },
  { channelNumber: 17, source: 'Playaudio Arm L', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false, notes: 'Playback' },
  { channelNumber: 18, source: 'Playaudio Arm R', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false, notes: 'Playback' },
  { channelNumber: 19, source: 'Playaudio BGV L', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false, notes: 'Playback' },
  { channelNumber: 20, source: 'Playaudio BGV R', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false, notes: 'Playback' },
  { channelNumber: 21, source: 'SMPTE', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false, notes: 'Timecode' },
  { channelNumber: 22, source: 'Click', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  { channelNumber: 23, source: 'Moog', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  {
    channelNumber: 24,
    source: '(missing)',
    micOrDi: 'Radial PRO DI',
    standType: 'none',
    phantom48v: false,
    extractionFlags: [{ level: 'warning', message: 'Source name blank in rider â€” DI assigned but channel role unclear. Confirm with FOH.' }],
  },
  { channelNumber: 25, source: 'Bass DI', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  {
    channelNumber: 26,
    source: 'GTR L',
    micOrDi: 'Shure SM57',
    standType: 'short_boom',
    phantom48v: false,
    extractionFlags: [{ level: 'warning', message: 'Same label as CH 27 â€” likely L/R pair with typo. Confirm.' }],
  },
  {
    channelNumber: 27,
    source: 'GTR L',
    micOrDi: 'Shure SM57',
    standType: 'short_boom',
    phantom48v: false,
    extractionFlags: [{ level: 'warning', message: 'Duplicate label with CH 26 â€” likely should be "GTR R".' }],
  },
  { channelNumber: 28, source: 'Mini Juno L', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  { channelNumber: 29, source: 'Mini Juno R', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  { channelNumber: 30, source: 'Nord L', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  { channelNumber: 31, source: 'Nord R', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  { channelNumber: 32, source: 'Acoustic GTR Elsa', micOrDi: 'Radial PRO RMP + PRO DI', standType: 'none', phantom48v: false, wireless: true, wirelessSystem: 'Sennheiser EW-DX' },
  { channelNumber: 33, source: 'Electric GTR Elsa', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false, wireless: true, wirelessSystem: 'Sennheiser EW-DX' },
  { channelNumber: 34, source: 'Vox Main ELSA', micOrDi: 'Sennheiser EW 500 G4 + e935', standType: 'straight', phantom48v: false, wireless: true, wirelessSystem: 'EW 500 G4', notes: '470-558 MHz' },
  { channelNumber: 35, source: 'Vox SPARE', micOrDi: 'Sennheiser EW 500 G4 + e935', standType: 'straight', phantom48v: false, wireless: true, wirelessSystem: 'EW 500 G4' },
  { channelNumber: 36, source: 'Vox JULIAN', micOrDi: 'Sennheiser e935', standType: 'boom', phantom48v: false, notes: 'Guitar mic position' },
  { channelNumber: 37, source: 'Talkback â€” Elsa', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 38, source: 'Talkback â€” Drums', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 39, source: 'Talkback â€” Bass', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 40, source: 'Talkback â€” GTR', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 41, source: 'Talkback â€” Stage L', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 42, source: 'Talkback â€” Stage R', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 43, source: 'Talkback â€” PROD', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 44, source: 'Talkback â€” Local FOH', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
];

// --- Monitor mixes (Â§6) â€” 8 stereo ---
const monitorMix8: NonNullable<RiderSection['monitorMix']> = [
  { outputs: '1-2', mixName: 'MAIN â€” ELSA', personName: 'Elsa', type: 'in_ear_stereo' },
  { outputs: '3-4', mixName: 'DRUM â€” JUAN', personName: 'Juan', type: 'in_ear_stereo' },
  { outputs: '5-6', mixName: 'BASS â€” DANIEL', personName: 'Daniel', type: 'in_ear_stereo' },
  { outputs: '7-8', mixName: 'GUITAR â€” JULIAN', personName: 'Julian', type: 'in_ear_stereo' },
  { outputs: '9-10', mixName: 'SPARE', type: 'in_ear_stereo' },
  { outputs: '11-12', mixName: 'STAFF', type: 'in_ear_stereo', bodypackCount: 4, notes: '4 bodypacks for crew on stage' },
  { outputs: '13-14', mixName: 'GUEST', type: 'in_ear_stereo' },
  { outputs: '15-16', mixName: 'CUE', type: 'in_ear_stereo', notes: 'Engineer cue feed' },
];

// --- FOH outputs (Â§6) â€” 8 ---
const fohOutputs8: NonNullable<RiderSection['fohOutputs']> = [
  { outputNumber: '1', source: 'SMPTE to Lighting & Video', notes: 'Timecode feed' },
  { outputNumber: '2', source: 'Talkback speaker' },
  { outputNumber: '3-4', source: 'Light & Video mix (wireless stereo IEM)', notes: '2 bodypacks' },
  { outputNumber: '5-6', source: 'Main L+R' },
  { outputNumber: '7', source: 'Sub' },
  { outputNumber: '8', source: 'Front Fill' },
];

// --- Backline (Â§9) ---
const backlineSpec: NonNullable<RiderSection['backline']> = {
  drums: {
    kitOptions: ['Gretsch Classic Maple', 'DW Collectors', 'Yamaha Hybrid Maple'],
    pieces: [
      { type: 'kick', size: '22"' },
      { type: 'rack_tom', size: '13"' },
      { type: 'floor_tom', size: '16"' },
      { type: 'floor_tom', size: '18"', notes: 'with legs' },
      { type: 'snare_main', size: '14Ã—6 or 14Ã—8', notes: 'Supraphonic, Black Magic, or similar' },
      { type: 'snare_2', size: '14Ã—6 Maple', notes: 'Gretsch Brooklyn USA or similar' },
      { type: 'snare_spare', size: '14Ã—6' },
    ],
    hardware: [
      { item: 'Snare stands', qty: 3, preferred: ['DW', 'Pearl'] },
      { item: 'Cymbal booms', qty: 4 },
      { item: 'Hi-hat stand', qty: 1, preferred: ['DW 5000'], excluded: ['Yamaha'], notes: 'NOT Yamaha' },
      { item: 'Kick pedal', qty: 1 },
      { item: 'Drum rug', qty: 1 },
      { item: 'Drum heads', qty: 1, preferred: ['Remo Ambassador Coated'] },
      { item: 'Drum throne', qty: 1, preferred: ['DW Airlift 9000'], excluded: ['motorcycle seat'], notes: '62cm round seat, no backrest. NOT motorcycle seat.' },
    ],
  },
  bass: {
    options: [
      { optionNumber: 1, head: 'Ampeg SVT-Classic', cab: 'Ampeg 8Ã—10' },
      { optionNumber: 2, head: 'Aguilar Tone Hammer 700', cab: 'Aguilar DB 810' },
      { optionNumber: 3, head: 'Aguilar DB 751', cab: 'Aguilar DB 810' },
    ],
  },
  guitar: [
    { item: 'Fender Twin Reverb 2Ã—12', qty: 1, notes: 'Main' },
    { item: 'Fender Hot Rod 2Ã—12', qty: 1 },
    { item: 'Fender Twin Reverb 2Ã—12 (spare)', qty: 1, notes: 'Spare' },
  ],
  miscellaneous: [
    { item: 'Hercules keyboard stands', qty: 4, brandPreferred: 'Hercules' },
    { item: 'Hercules instrument stands', qty: 6, brandPreferred: 'Hercules' },
    { item: '7-space guitar rack', qty: 2 },
    { item: 'Percussion tables', qty: 6 },
    { item: '1/4" 17ft cables', qty: 6 },
  ],
  risersRequired: false,
  videoScreen: {
    type: 'LED',
    dimensions: '12Ã—5m',
    aspectRatio: '16:9',
    resolutionPreferred: '1920Ã—1080',
    resolutionMin: '1280Ã—720',
  },
};

// --- Lodging (Â§12) ---
const lodgingSpec: NonNullable<RiderSection['lodging']> = {
  hotelRequirements: { artistPreApproval: true, amenitiesRequired: ['24h_room_service', 'breakfast', 'wifi'] },
  roomingList: [
    { roomNumber: 1, roomType: 'junior_suite', occupants: [{ name: 'Elsa Carvajal', role: 'artist' }] },
    { roomNumber: 2, roomType: 'single', occupants: [{ name: 'Julian Bernal', role: 'guitarist' }] },
    { roomNumber: 3, roomType: 'single', occupants: [{ name: 'Manuel GonzÃ¡lez', role: 'production_manager' }] },
    { roomNumber: 4, roomType: 'single', occupants: [{ name: 'Tour Manager', role: 'tour_manager' }] },
    { roomNumber: 5, roomType: 'single', occupants: [{ role: 'bassist' }] },
    { roomNumber: 6, roomType: 'single', occupants: [{ role: 'drummer' }] },
    { roomNumber: 7, roomType: 'single', occupants: [{ role: 'makeup_artist' }, { role: 'personal_assistant' }] },
    { roomNumber: 8, roomType: 'single', occupants: [{ role: 'audio_engineer' }] },
    { roomNumber: 9, roomType: 'double', occupants: [{ role: 'staff' }, { role: 'staff' }] },
    { roomNumber: 10, roomType: 'double', occupants: [{ role: 'vj' }, { role: 'lighting_engineer' }] },
  ],
  totalRooms: 10,
  totalOccupants: 13,
};

// --- Catering (Â§14) ---
const cateringSpec: NonNullable<RiderSection['catering']> = {
  menus: [
    {
      room: 'Camerino 03 (Crew)',
      menuTime: 'load_in',
      items: [
        { item: 'Agua sin gas', itemEn: 'Still water', qty: 16, unit: 'bottles' },
        { item: 'Agua mineral', itemEn: 'Sparkling water', qty: 8, unit: 'bottles' },
        { item: 'Coffee station', qty: 1 },
        { item: 'Sodas (variedad)', itemEn: 'Assorted sodas', qty: 12 },
        { item: 'Red Bull', qty: 6, unit: 'cans' },
        { item: 'Gatorade', qty: 6, unit: 'bottles' },
        { item: 'Electrolit', qty: 6, unit: 'bottles' },
        { item: 'Manzanas', itemEn: 'Apples', qty: 8 },
        { item: 'PlÃ¡tanos', itemEn: 'Bananas', qty: 8 },
        { item: 'Nature Valley bars', qty: 'assorted' },
        { item: 'Mixed berries', qty: 1, unit: 'tray' },
        { item: 'Toallas faciales negras', itemEn: 'Black face towels', qty: 8 },
        { item: 'Hielo', itemEn: 'Ice', qty: 1, unit: 'cooler' },
      ],
    },
    {
      room: 'Camerino 01 (Elsa)',
      menuTime: 'soundcheck',
      availableBy: '90 min before soundcheck',
      items: [
        { item: 'Agua Santa MarÃ­a', qty: 8, unit: 'bottles' },
        { item: 'Agua mineral', itemEn: 'Sparkling water', qty: 8, unit: 'bottles' },
        { item: 'Gatorade / Electrolit', qty: 8, unit: 'bottles' },
        { item: 'TÃ© negro', itemEn: 'Black tea', qty: 1, unit: 'box' },
        { item: 'TÃ© de jengibre', itemEn: 'Ginger tea', qty: 1, unit: 'box' },
        { item: 'CafÃ© regular y descafeinado', itemEn: 'Regular + decaf coffee', qty: 1, unit: 'station' },
        { item: 'French press + kettle', qty: 1 },
        { item: 'Jengibre fresco', itemEn: 'Fresh ginger', qty: 1, unit: 'piece' },
        { item: 'Limones', itemEn: 'Lemons', qty: 8 },
        { item: 'Crema', itemEn: 'Creamer', qty: 1, unit: 'pint' },
        { item: 'Leche de almendra sin azÃºcar', itemEn: 'Unsweetened almond milk', qty: 1, unit: 'carton', dietaryTags: ['no_sugar'] },
        { item: 'Yogurt griego sin azÃºcar', itemEn: 'Greek yogurt (unsweetened)', qty: 1, unit: 'cup', dietaryTags: ['no_sugar'] },
        { item: 'Frutos rojos', itemEn: 'Berries', qty: 1, unit: 'tray' },
        { item: 'Tabla de embutidos', itemEn: 'Charcuterie tray', qty: 1 },
        { item: 'Nueces mixtas', itemEn: 'Mixed nuts', qty: 1, unit: 'bowl' },
        { item: 'Slim Pop popcorn', qty: 3, unit: 'bags', notes: 'Cheddar / natural / sweet' },
      ],
    },
    {
      room: 'Camerino 01 (Elsa)',
      menuTime: 'show',
      items: [
        { item: '[Full soundcheck list]', qty: 1, notes: 'Same as soundcheck menu, plus:' },
        { item: 'Chocolate', qty: 2, unit: 'bars', brandPreferred: ['Valor', 'Lindt 70% dark'] },
        { item: 'Vegetable chips', qty: 1, unit: 'bag' },
        { item: 'Bowl de gomitas', itemEn: 'Gummy bowl', qty: 1 },
        { item: 'Tylenol', qty: 1, unit: 'pack' },
        { item: 'Cuchillo + tabla', itemEn: 'Knife + cutting board', qty: 1 },
        { item: 'Globos pequeÃ±os', itemEn: 'Small balloons', qty: 1, unit: 'pack', notes: 'Medium or small only' },
        { item: 'Platillos regionales mexicanos', itemEn: 'Regional Mexican dishes', qty: 1, notes: 'Vegetarian options. Confirm with TM.', dietaryTags: ['vegetarian_option_required'] },
      ],
    },
    {
      room: 'Camerino 02 (MÃºsicos)',
      menuTime: 'show',
      items: [
        { item: 'Agua Santa MarÃ­a', qty: 16, unit: 'bottles' },
        { item: 'Topo Chico (sparkling)', qty: 16, unit: 'bottles' },
        { item: 'Sports drinks', qty: 10, unit: 'bottles' },
        { item: 'Coca-Cola', qty: 6, unit: 'cans' },
        { item: 'Coca-Cola Zero', qty: 6, unit: 'cans' },
        { item: 'Limones', itemEn: 'Lemons', qty: 6 },
        { item: 'PlÃ¡tanos', itemEn: 'Bananas', qty: 8 },
        { item: 'Tabla de embutidos', itemEn: 'Charcuterie tray', qty: 1 },
        { item: 'Almendras', itemEn: 'Almonds', qty: 1, unit: 'bowl' },
        { item: 'Pistachos', itemEn: 'Pistachios', qty: 1, unit: 'bowl' },
        { item: 'Vasos biodegradables', itemEn: 'Biodegradable cups', qty: 1, unit: 'pack', dietaryTags: ['biodegradable'] },
      ],
    },
    {
      room: 'Camerino 03 (Crew)',
      menuTime: 'show',
      items: [
        { item: 'Agua', itemEn: 'Water', qty: 16, unit: 'bottles' },
        { item: 'Sandwich station', qty: 1, notes: 'Whole grain bread, ham, turkey ham, manchego, panela, tomato/onion/avocado, mayo, mustard, chipotle, jalapeÃ±o + electric press' },
        { item: 'Desechables biodegradables', itemEn: 'Biodegradable disposables', qty: 1, unit: 'set', dietaryTags: ['biodegradable'] },
      ],
    },
    {
      room: 'Camerino 02 (MÃºsicos)',
      menuTime: 'post_show',
      items: [
        { item: 'Vino blanco o rosado', itemEn: 'White or rosÃ© wine', qty: 1, unit: 'bottle' },
        { item: 'Cervezas frÃ­as', itemEn: 'Cold beers', qty: 15, brandExcluded: ['Sol', 'Corona'], notes: 'NOT Sol, NOT Corona' },
        { item: 'Mezcal', qty: 2, unit: 'bottles', brandPreferred: ['Amaras', 'UniÃ³n', '400 Conejos'], notes: 'Outside MX: local equivalents' },
        { item: 'Platillos regionales', itemEn: 'Regional dishes', qty: 1, dietaryTags: ['vegetarian_option_required'] },
      ],
    },
    {
      room: 'Camerino 03 (Crew)',
      menuTime: 'post_show',
      items: [
        { item: 'Cervezas frÃ­as', itemEn: 'Cold beers', qty: 10, brandExcluded: ['Sol', 'Corona'], notes: 'NOT Sol, NOT Corona' },
        { item: 'Ensaladas', itemEn: 'Salads', qty: 2, notes: 'Confirm with TM' },
        { item: 'Platillos regionales', itemEn: 'Regional dishes', qty: 1, dietaryTags: ['vegetarian_option_required'] },
      ],
    },
  ],
  generalRequirements: {
    biodegradableDisposables: true,
    foodDonationPlanRequired: true,
    other: ['Plan for leftover food donation to local charity or venue staff'],
  },
};

// --- Conflicts (derived from cross-section comparison) ---
const conflicts: Conflict[] = [
  {
    id: 'cf_generators',
    type: 'numeric_disagreement',
    severity: 'high',
    description: 'Generator count and capacity disagree between Â§4 stage specs and Â§8 lighting/power.',
    sectionsInvolved: ['stage_specs', 'lighting_equipment'],
    values: [
      { section: 'Â§4 Stage specs', value: '2 generators, 1800A across 3 phases at 110-125V/60Hz' },
      { section: 'Â§8 Lighting/power', value: '3 generators: Audio/Video 200kVA, Lighting 150kVA, Spare 200kVA' },
    ],
    suggestedResolution: 'Confirm with Manuel GonzÃ¡lez (PM) â€” Â§8 is the more recent and detailed spec. Likely Â§8 supersedes Â§4.',
  },
  {
    id: 'cf_ch24',
    type: 'missing_reference',
    severity: 'medium',
    description: 'Channel 24 has a DI assigned (Radial PRO DI) but no source name in the input list.',
    sectionsInvolved: ['input_list'],
    values: [{ section: 'Â§6 Input list', value: 'CH 24 source = (blank)' }],
    suggestedResolution: 'Confirm with FOH engineer â€” likely an additional keys or playback channel.',
  },
  {
    id: 'cf_gtr_dup',
    type: 'duplicate',
    severity: 'medium',
    description: 'Channels 26 and 27 are both labeled "GTR L" â€” likely an L/R typo.',
    sectionsInvolved: ['input_list'],
    values: [
      { section: 'Â§6 Input list', value: 'CH 26 = "GTR L"' },
      { section: 'Â§6 Input list', value: 'CH 27 = "GTR L"' },
    ],
    suggestedResolution: 'CH 27 should likely be "GTR R". Confirm with FOH.',
  },
  {
    id: 'cf_room_count',
    type: 'count_mismatch',
    severity: 'medium',
    description: 'Rider Â§12 header says 11 occupants but rooming-list rows total 13 (1 JR + 6 singles + 1 single with 2 sharing + 2 doubles).',
    sectionsInvolved: ['lodging'],
    values: [
      { section: 'Â§12 Lodging header', value: 'Stated: 11 occupants' },
      { section: 'Â§12 Lodging rooming list', value: 'Counted: 13 occupants' },
    ],
    suggestedResolution: 'Confirm with the TM. Room #7 is labeled "Single" but lists "MUA + Personal" â€” two people sharing a single room. Either the room type should be Double, or one of the two is unbooked.',
  },
  {
    id: 'cf_flight_count',
    type: 'count_mismatch',
    severity: 'medium',
    description: 'Air transport (Â§11) requests 8 tickets but rooming list (Â§12) totals 11-12 people.',
    sectionsInvolved: ['air_transport', 'lodging'],
    values: [
      { section: 'Â§11 Air transport', value: '8 tickets' },
      { section: 'Â§12 Lodging', value: '11-12 occupants' },
    ],
    suggestedResolution: 'Local hires (staff?) may not fly. Confirm with travel agent + TM.',
  },
];

// --- Rider sections assembled ---
const riderSections: RiderSection[] = [
  // Â§1 Cover & contacts
  {
    type: 'cover_and_contacts',
    pages: [1],
    status: 'approved',
    confidence: 0.98,
    language: 'es',
    freeText:
      'TECH RIDER | Full Band 2025. Updated: September 2025. FAVOR OMITIR VERSIONES ANTERIORES (please ignore previous versions). PM: Manuel GonzÃ¡lez Â· magcs81@gmail.com Â· +52 55 54 74 70 48',
    freeTextEn:
      'TECH RIDER | Full Band 2025. Updated: September 2025. PLEASE IGNORE PREVIOUS VERSIONS. PM: Manuel GonzÃ¡lez Â· magcs81@gmail.com Â· +52 55 54 74 70 48',
  },
  // Â§2 Production control â€” verbatim from rider p.3
  {
    type: 'production_control',
    pages: [3],
    status: 'approved',
    confidence: 0.96,
    language: 'es',
    freeText:
      '2- NOTAS\nCONTROL DE PRODUCCIÃ“N\nEl promotor/empresario acepta que la producciÃ³n de ELSA Y ELMAR tenga el control total y puede tomar decisiones sobre todos los temas relacionados con el show: horarios, escenario, vallas, acceso al venue, bandas abridoras, anuncios de cualquier tipo, publicidad en el venue, control de las luces de casa, aire acondicionado, calefacciÃ³n, fotÃ³grafos, video, circuito cerrado, acreditaciones, etc.',
    freeTextEn:
      '2 â€” NOTES\nPRODUCTION CONTROL\nThe promoter agrees that ELSA Y ELMAR\'s production team has full control and can make decisions on all matters related to the show: schedule, stage, barricades, venue access, opening acts, announcements of any kind, in-venue advertising, house-light control, A/C, heating, photographers, video, closed-circuit, credentials, etc.',
  },
  // Â§3 Permits â€” verbatim from rider p.3
  {
    type: 'permits',
    pages: [3],
    status: 'approved',
    confidence: 0.95,
    language: 'es',
    freeText:
      '3- PERMISOS\nPERMISOS, LICENCIAS Y CERTIFICADOS\nEn caso de ser necesario obtener y/o pagar cualquier tipo de licencias, permisos, seguros, certificados, visas y/o cualquier trÃ¡mite requerido por cualquier sindicato, autoridad local o nacional, sociedad de autores y/o similares que tengan jurisdicciÃ³n sobre las actuaciones, estos trÃ¡mites y cargos serÃ¡n responsabilidad del Promotor o Contratante.',
    freeTextEn:
      '3 â€” PERMITS\nPERMITS, LICENSES AND CERTIFICATES\nIf any licenses, permits, insurance, certificates, visas or any other paperwork is required by any union, local or national authority, performance-rights society or similar body with jurisdiction over the performances, the responsibility for obtaining and paying for them falls on the Promoter or Contractor.',
  },
  // Â§4 Stage specs
  {
    type: 'stage_specs',
    pages: [4],
    status: 'review',
    confidence: 0.92,
    language: 'es',
    freeText:
      'Ground support 12m Ã— 9m Ã— 10m, techado. Escenario 14m Ã— 10m a 1.50m de altura. Ãreas de trabajo: 3.66m Ã— 10m SL, 4.88m Ã— 6.10m SR. 6 ventiladores (1 guitarra, 1 bajo, 1 baterÃ­a, 3 frente). Negro o gris, liso, nivelado. 3 escaleras (USC, SL, SR). Mojo-type barricade reforzado. SIN risers. 2 generadores mÃ­nimo, 1800A en 3 fases a 110-125V/60Hz. Ambulancia desde load-in hasta load-out.',
    freeTextEn:
      'Ground support 12m Ã— 9m Ã— 10m, covered. Stage 14m Ã— 10m at 1.50m height. Work areas: 3.66m Ã— 10m SL, 4.88m Ã— 6.10m SR. 6 fans (1 guitar, 1 bass, 1 drums, 3 front). Black or grey, smooth, level. 3 staircases (USC, SL, SR). HEAVY Mojo-type barricade. NO risers. 2 generators minimum, 1800A across 3 phases at 110-125V/60Hz. Ambulance from load-in to load-out.',
  },
  // Â§5 Audio PA
  {
    type: 'audio_pa',
    pages: [5],
    status: 'review',
    confidence: 0.93,
    language: 'es',
    freeText:
      'PA estÃ©reo 4-way, 105-110 dB(C), mÃ­n 110dB SPL. Â±3dB de 25Hz-18kHz, 120dB headroom. L+R+Subs+Frontfill (NO mono). Marcas: L-Acoustics / Meyer / JBL VTX V. EspecÃ­ficos: D&B J8/J Â· L\'Acoustics V-DOSC/SB218 Â· Adamson Y18/T21 Â· Nexo GEOD/CD18. Front fill 4-6 cabinets misma marca. FOH centrado, nivel de suelo preferido, mÃ¡x 50cm riser, mÃ¡x 30m del escenario, cubierto, intercom a monitores. Consola FOH: tour trae propia. Alternativas: Yamaha CL5 / Avid S6L 32d / Waves LV1 (48ch). Monitores: 8Ã— Shure PSM 1000 IEM + 6 bodypacks extra, 8Ã— SE215, 2Ã— 8ch combiners, 2Ã— antenas helicoidales. Wireless mics tour trae: 2Ã— Sennheiser EW300 G4, vocal principal+spare Sennheiser 470-558 MHz. TÃ©cnico RF requerido desde load-in hasta fin del show. Local provee: 2Ã— cables Cat 6 96m FOH â†’ SL.',
    freeTextEn:
      '4-way stereo PA, 105-110 dB(C), min 110dB SPL. Â±3dB from 25Hz-18kHz, 120dB headroom. L+R+Subs+Frontfill (NOT mono). Brand options: L-Acoustics / Meyer / JBL VTX V. Specifics: D&B J8/J Â· L-Acoustics V-DOSC/SB218 Â· Adamson Y18/T21 Â· Nexo GEOD/CD18. Front fill 4-6 cabinets same brand. FOH centered, ground level preferred, max 50cm riser, max 30m from stage, covered, intercom to monitors. FOH console: tour brings own. Alternates: Yamaha CL5 / Avid S6L 32d / Waves LV1 (48ch). Monitors: 8Ã— Shure PSM 1000 IEM + 6 extra bodypacks, 8Ã— SE215, 2Ã— 8-ch combiners, 2Ã— helical antennas. Wireless mics tour-provided: 2Ã— Sennheiser EW300 G4, main+spare vocal Sennheiser 470-558 MHz. RF tech required load-in to end of show. Local provides: 2Ã— 96m Cat 6 cables FOH â†’ SL.',
  },
  // Â§6 Input list (44 ch)
  {
    type: 'input_list',
    pages: [6],
    status: 'review',
    confidence: 0.91,
    language: 'es',
    inputList: inputList44,
  },
  // Â§6 Monitor mix (8 stereo)
  {
    type: 'audio_monitors',
    pages: [6, 7],
    status: 'review',
    confidence: 0.94,
    language: 'es',
    monitorMix: monitorMix8,
  },
  // Â§6 FOH output patch
  {
    type: 'output_patch',
    pages: [7],
    status: 'review',
    confidence: 0.96,
    language: 'es',
    fohOutputs: fohOutputs8,
  },
  // Â§7 Stage plot
  {
    type: 'stage_plot',
    pages: [8],
    status: 'pending',
    confidence: 0.78,
    language: 'es',
    freeText: 'Diagrama del escenario â€” Elsa center, Julian SR, Daniel SL, Juan upstage center. 4 wedges + IEMs. Power drops marked.',
    freeTextEn: 'Stage diagram â€” Elsa downstage center, Julian SR, Daniel SL, Juan upstage center. 4 wedges + IEMs. Power drops marked.',
  },
  // Â§8 Lighting equipment
  {
    type: 'lighting_equipment',
    pages: [9, 10],
    status: 'review',
    confidence: 0.95,
    language: 'es',
    freeText:
      '43Ã— Robe MegaPointe Â· 10Ã— Color Strike M Â· 61Ã— Elation Chorus Line 16 Â· 8Ã— Robe Spider Â· 18Ã— motores 1-ton Â· Truss: 8Ã— Tomcat LD 12Ã—12 10ft, 4Ã— GT Tyler 10ft, 2Ã— sideboom 1.5m, 2Ã— sideboom 1m Â· 2Ã— GrandMA 3 Full Size Â· 6Ã— AM Haze Stadium o DF-50 Â· 2Ã— Low Fog Machine Â· Generadores: 3 (Audio/Video 200kVA, Lighting 150kVA, Spare 200kVA), 3 fases + neutro + tierra (varilla 2m) por generador. Cam-Lock. Edison 110-127V en escenario.',
    freeTextEn:
      '43Ã— Robe MegaPointe Â· 10Ã— Color Strike M Â· 61Ã— Elation Chorus Line 16 Â· 8Ã— Robe Spider Â· 18Ã— 1-ton hoist motors Â· Truss: 8Ã— Tomcat LD 12Ã—12 10ft, 4Ã— GT Tyler 10ft, 2Ã— sideboom 1.5m, 2Ã— sideboom 1m Â· 2Ã— GrandMA 3 Full Size Â· 6Ã— AM Haze Stadium or DF-50 Â· 2Ã— Low Fog Machine Â· 3 generators: Audio/Video 200kVA, Lighting 150kVA, Spare 200kVA. 3 phases + neutral + ground (2m rod) per generator. Cam-Lock. Edison 110-127V at stage.',
  },
  // Â§8 Lighting plot (CAD pages â€” stored, not extracted)
  {
    type: 'lighting_plot',
    pages: [11, 12, 13, 14, 15, 16, 17, 18],
    status: 'pending',
    confidence: 0.6,
    language: 'es',
    freeText: '8 pÃ¡ginas de planos CAD del lightplot. Almacenadas como referencia; v1 no extrae estructura de dibujos.',
    freeTextEn: '8 CAD pages of the light plot. Stored as reference attachments; v1 does not extract structure from drawings.',
  },
  // Â§9 Backline
  {
    type: 'backline',
    pages: [19, 20],
    status: 'review',
    confidence: 0.93,
    language: 'es',
    backline: backlineSpec,
  },
  // Â§10 Soundcheck
  {
    type: 'soundcheck',
    pages: [21],
    status: 'approved',
    confidence: 0.99,
    language: 'es',
    freeText: 'Soundcheck a puertas cerradas. MÃ­nimo 6 horas desde load-in.',
    freeTextEn: 'Closed-door soundcheck. Minimum 6 hours from load-in.',
  },
  // Â§11 Ground transport
  {
    type: 'ground_transport',
    pages: [22],
    status: 'approved',
    confidence: 0.95,
    language: 'es',
    freeText: '2Ã— Sprinter 20-pax + 1Ã— cargo van, mÃ­nimo modelo 2020.',
    freeTextEn: '2Ã— Sprinter 20-pax vans + 1Ã— cargo van, minimum 2020 model.',
  },
  // Â§11 Air transport
  {
    type: 'air_transport',
    pages: [22],
    status: 'review',
    confidence: 0.9,
    language: 'es',
    freeText:
      'Viajes >5h requieren vuelo. 8 boletos total: 2 AM Plus (primera fila econÃ³mica, asientos contiguos) + 6 econÃ³micos. Todos con maleta 25kg, 2 pasajeros con 2 maletas. Vuelos directos preferidos. AprobaciÃ³n del TM requerida.',
    freeTextEn:
      'Trips >5h require flying. 8 tickets total: 2 AM Plus (front-row economy, seated together) + 6 economy. All with 25kg bag, 2 passengers get 2 bags. Direct flights preferred. TM approval required.',
  },
  // Â§12 Lodging
  {
    type: 'lodging',
    pages: [23],
    status: 'review',
    confidence: 0.92,
    language: 'es',
    lodging: lodgingSpec,
  },
  // Â§13 Dressing rooms
  {
    type: 'dressing_rooms',
    pages: [24],
    status: 'review',
    confidence: 0.88,
    language: 'es',
    freeText:
      '3 camerinos, 5m Ã— 5m mÃ­n, con cerradura, sin humo, ventilados, sanitizados. Camerino 01 (Elsa): baÃ±o privado, 2 sillones, 4 sillas, espejo de cuerpo entero, perchero, 2 lÃ¡mparas de pie de luz cÃ¡lida, mesa de catering, 4 toallas faciales negras, multitomas con cargadores iPhone+Android + 6Ã— 110V, hielera, jarrÃ³n con flores (claveles o lirios â€” NO rosas, NO girasoles), vela aromÃ¡tica SIN encender, papelera. Camerino 02 (mÃºsicos): baÃ±o privado, 2 sillones, 4 sillas, espejo, perchero, 1 lÃ¡mpara de pie, mesa de catering, 8 toallas faciales negras, multitoma igual, hielera, papelera. Camerino 03 (crew): 2 sillones, mesa de trabajo, 6 sillas, mesa de catering, lÃ¡mpara de pie, multitoma igual, hielera, papelera.',
    freeTextEn:
      '3 dressing rooms, 5m Ã— 5m min, lockable, smoke-free, ventilated, sanitized. Camerino 01 (Elsa): private bath, 2 couches, 4 chairs, full mirror, coat rack, 2 floor lamps (warm light), catering table, 4 black face towels, multi-outlet w/ iPhone+Android chargers + 6Ã— 110V, cooler, flower vase (carnations or lilies â€” NO roses, NO sunflowers), unlit scented candle, trash can. Camerino 02 (musicians): private bath, 2 couches, 4 chairs, mirror, coat rack, 1 floor lamp, catering table, 8 black face towels, multi-outlet same, cooler, trash can. Camerino 03 (crew): 2 couches, work table, 6 chairs, catering table, floor lamp, multi-outlet same, cooler, trash can.',
  },
  // Â§14 Catering
  {
    type: 'catering',
    pages: [25, 26],
    status: 'review',
    confidence: 0.86,
    language: 'es',
    catering: cateringSpec,
  },
  // Conflicts (derived)
  {
    type: 'other',
    pages: [],
    status: 'review',
    confidence: 1.0,
    language: 'derived',
    conflicts,
  },
];

const riderImports: RiderImport[] = [
  {
    id: 'ri_001',
    filename: 'RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf',
    uploadedAt: '2026-09-10T10:14',
    uploadedBy: 'Tour Manager',
    sourceLanguage: 'es',
    pageCount: 27,
    status: 'review',
    revision: 2,
    artistName: 'Elsa y Elmar',
    revisionInfo: {
      version: 'September 2025',
      date: '2025-09',
      warning: 'PLEASE IGNORE PREVIOUS VERSIONS (Favor omitir versiones anteriores)',
    },
    productionManager: {
      name: 'Manuel GonzÃ¡lez',
      email: 'magcs81@gmail.com',
      phone: '+52 55 54 74 70 48',
    },
    partySize: { tourists: 11, rooms: 10, flightTickets: 8 }, // rider-stated; flagged in conflicts
    sections: riderSections,
  },
];

// ============================================================
// The Tour object (composed)
// ============================================================
export const mockTour: Tour = {
  id: tourId,
  organizationId: mockOrgId,
  name: 'Full Band 2025',
  artistName: 'Elsa y Elmar',
  status: 'in_progress',
  startDate: TOUR_START,
  endDate: TOUR_END,
  legs: [
    { id: 'leg_mx', name: 'Mexico Leg', startDate: '2026-09-22', endDate: '2026-10-02' },
    { id: 'leg_us', name: 'USA Leg', startDate: '2026-10-03', endDate: '2026-10-11' },
    { id: 'leg_sa', name: 'South America Leg', startDate: '2026-10-12', endDate: '2026-10-23' },
  ],
  groups,
  groupTags,
  personnel,
  days,
  scheduleItems,
  travel,
  hotels,
  tasks,
  documents,
  flightImports,
  riderImports,
};

// Tour query helpers (getDay, getScheduleItemsForDay, â€¦) previously lived here
// and read mockTour directly. They moved to lib/tourQueries.ts as pure
// functions over an explicit `tour`, and are re-exposed (bound to the active
// tour) from state/AppState.tsx â€” call them via useApp().
