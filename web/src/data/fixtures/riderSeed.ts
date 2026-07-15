/* ============================================================
 * RIDER SEED — Elsa y Elmar · Full Band 2025
 * ------------------------------------------------------------
 * The content extracted from the project's canonical rider PDF
 * (`RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf`,
 * per docs/handoff-post-pdf-interpret.md) plus the personnel it
 * names. `data/riderFixture.ts` clones `riderSeedImport` /
 * `riderSeedPersonnel` into a fresh RiderImport + TourPerson list
 * when a user's upload matches this rider (see
 * `lib/fixtureMatcher.ts`) and the live PDF parser can't be used —
 * the extraction fallback, not the primary authoring path.
 *
 * Extracted straight from the rider:
 *   - Artist name, production manager contact, band roster
 *   - Input list (44 channels) + monitor mixes (8) + FOH outputs (8)
 *   - Audio PA, stage specs, lighting equipment, backline,
 *     soundcheck rules, transport spec, rooming list, dressing
 *     rooms, catering menus, conflicts
 *
 * A few crew roles the rider names by role but not by name (Audio
 * Engineer, Lighting Engineer, VJ, MUA, Personal Assistant, Staff)
 * are placeholders (`isPlaceholder: true`) awaiting real names —
 * see CLAUDE.md "Pending user-blocked items".
 * ============================================================
 */

import type { Person, TourPerson, RiderSection, RiderImport, Conflict } from '@/types';

// ============================================================
// Personnel named (or role-placeholder'd) in the rider
// ============================================================
const persons: Person[] = [
  // --- Named in rider §6/§12
  { id: 'p_elsa', name: 'Elsa Carvajal' },
  { id: 'p_julian', name: 'Julian Bernal' },
  // --- First name only (rider §6 monitor mix); last name unknown
  { id: 'p_juan', name: 'Juan' },
  { id: 'p_daniel', name: 'Daniel' },
  // --- Named on rider cover page
  { id: 'p_manuel', name: 'Manuel González', email: 'magcs81@gmail.com', phone: '+52 55 54 74 70 48' },
  // --- Placeholder · Tour Manager (real name TBD)
  { id: 'p_lorenzo', name: 'Tour Manager' },
  // --- Placeholders for roles named in rider §12 but without names.
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

// Default membership span for the seeded personnel below.
const MEMBERSHIP_START = '2026-09-22';
const MEMBERSHIP_END = '2026-10-23';

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
    startDate: opts.startDate ?? MEMBERSHIP_START,
    endDate: opts.endDate ?? MEMBERSHIP_END,
    isPlaceholder: opts.isPlaceholder,
  };
}

/** The band + crew the rider identifies (by name or by role). */
export const riderSeedPersonnel: TourPerson[] = [
  // Artist (from rider §6 + §12)
  tp('tp_elsa', 'p_elsa', 'Lead Vocals', 'grp_artist'),
  tp('tp_julian', 'p_julian', 'Guitar & Backing Vox', 'grp_artist'),
  tp('tp_juan', 'p_juan', 'Drums', 'grp_artist', [], { isPlaceholder: true }),
  tp('tp_daniel', 'p_daniel', 'Bass', 'grp_artist', [], { isPlaceholder: true }),
  // Production (from rider cover page)
  tp('tp_manuel', 'p_manuel', 'Production Manager', 'grp_production'),
  // Placeholder · Mgmt (TM name TBD, like the other unfilled crew roles)
  tp('tp_lorenzo', 'p_lorenzo', 'Tour Manager', 'grp_mgmt', [], { isPlaceholder: true }),
  // Placeholders · technical crew (rider §12)
  tp('tp_audio', 'p_audio', 'Audio Engineer (FOH + Monitors)', 'grp_audio', [], { isPlaceholder: true }),
  tp('tp_lighting', 'p_lighting', 'Lighting Designer', 'grp_lighting', [], { isPlaceholder: true }),
  tp('tp_vj', 'p_vj', 'VJ / Playback', 'grp_video', [], { isPlaceholder: true }),
  // Placeholders · A Party (rider §12 — share a single room)
  tp('tp_mua', 'p_mua', 'Makeup Artist', 'grp_aparty', [], { isPlaceholder: true }),
  tp('tp_personal', 'p_personal', 'Personal Assistant', 'grp_aparty', [], { isPlaceholder: true }),
  // Placeholders · Staff (rider §12 double room)
  tp('tp_staff1', 'p_staff1', 'Touring Staff', 'grp_staff', [], { isPlaceholder: true }),
  tp('tp_staff2', 'p_staff2', 'Touring Staff', 'grp_staff', [], { isPlaceholder: true }),
];

// ============================================================
// Rider Import — the 14 sections from the real PDF, extracted
// per the schemas in docs/handoff-post-pdf-interpret.md.
// ============================================================

// --- Input list (§6) — 44 channels ---
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
    extractionFlags: [{ level: 'warning', message: 'Source name blank in rider — DI assigned but channel role unclear. Confirm with FOH.' }],
  },
  { channelNumber: 25, source: 'Bass DI', micOrDi: 'Radial PRO DI', standType: 'none', phantom48v: false },
  {
    channelNumber: 26,
    source: 'GTR L',
    micOrDi: 'Shure SM57',
    standType: 'short_boom',
    phantom48v: false,
    extractionFlags: [{ level: 'warning', message: 'Same label as CH 27 — likely L/R pair with typo. Confirm.' }],
  },
  {
    channelNumber: 27,
    source: 'GTR L',
    micOrDi: 'Shure SM57',
    standType: 'short_boom',
    phantom48v: false,
    extractionFlags: [{ level: 'warning', message: 'Duplicate label with CH 26 — likely should be "GTR R".' }],
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
  { channelNumber: 37, source: 'Talkback — Elsa', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 38, source: 'Talkback — Drums', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 39, source: 'Talkback — Bass', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 40, source: 'Talkback — GTR', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 41, source: 'Talkback — Stage L', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 42, source: 'Talkback — Stage R', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 43, source: 'Talkback — PROD', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
  { channelNumber: 44, source: 'Talkback — Local FOH', micOrDi: 'Shure SM58', standType: 'short_boom', phantom48v: false },
];

// --- Monitor mixes (§6) — 8 stereo ---
const monitorMix8: NonNullable<RiderSection['monitorMix']> = [
  { outputs: '1-2', mixName: 'MAIN — ELSA', personName: 'Elsa', type: 'in_ear_stereo' },
  { outputs: '3-4', mixName: 'DRUM — JUAN', personName: 'Juan', type: 'in_ear_stereo' },
  { outputs: '5-6', mixName: 'BASS — DANIEL', personName: 'Daniel', type: 'in_ear_stereo' },
  { outputs: '7-8', mixName: 'GUITAR — JULIAN', personName: 'Julian', type: 'in_ear_stereo' },
  { outputs: '9-10', mixName: 'SPARE', type: 'in_ear_stereo' },
  { outputs: '11-12', mixName: 'STAFF', type: 'in_ear_stereo', bodypackCount: 4, notes: '4 bodypacks for crew on stage' },
  { outputs: '13-14', mixName: 'GUEST', type: 'in_ear_stereo' },
  { outputs: '15-16', mixName: 'CUE', type: 'in_ear_stereo', notes: 'Engineer cue feed' },
];

// --- FOH outputs (§6) — 8 ---
const fohOutputs8: NonNullable<RiderSection['fohOutputs']> = [
  { outputNumber: '1', source: 'SMPTE to Lighting & Video', notes: 'Timecode feed' },
  { outputNumber: '2', source: 'Talkback speaker' },
  { outputNumber: '3-4', source: 'Light & Video mix (wireless stereo IEM)', notes: '2 bodypacks' },
  { outputNumber: '5-6', source: 'Main L+R' },
  { outputNumber: '7', source: 'Sub' },
  { outputNumber: '8', source: 'Front Fill' },
];

// --- Backline (§9) ---
const backlineSpec: NonNullable<RiderSection['backline']> = {
  drums: {
    kitOptions: ['Gretsch Classic Maple', 'DW Collectors', 'Yamaha Hybrid Maple'],
    pieces: [
      { type: 'kick', size: '22"' },
      { type: 'rack_tom', size: '13"' },
      { type: 'floor_tom', size: '16"' },
      { type: 'floor_tom', size: '18"', notes: 'with legs' },
      { type: 'snare_main', size: '14×6 or 14×8', notes: 'Supraphonic, Black Magic, or similar' },
      { type: 'snare_2', size: '14×6 Maple', notes: 'Gretsch Brooklyn USA or similar' },
      { type: 'snare_spare', size: '14×6' },
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
      { optionNumber: 1, head: 'Ampeg SVT-Classic', cab: 'Ampeg 8×10' },
      { optionNumber: 2, head: 'Aguilar Tone Hammer 700', cab: 'Aguilar DB 810' },
      { optionNumber: 3, head: 'Aguilar DB 751', cab: 'Aguilar DB 810' },
    ],
  },
  guitar: [
    { item: 'Fender Twin Reverb 2×12', qty: 1, notes: 'Main' },
    { item: 'Fender Hot Rod 2×12', qty: 1 },
    { item: 'Fender Twin Reverb 2×12 (spare)', qty: 1, notes: 'Spare' },
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
    dimensions: '12×5m',
    aspectRatio: '16:9',
    resolutionPreferred: '1920×1080',
    resolutionMin: '1280×720',
  },
};

// --- Lodging (§12) ---
const lodgingSpec: NonNullable<RiderSection['lodging']> = {
  hotelRequirements: { artistPreApproval: true, amenitiesRequired: ['24h_room_service', 'breakfast', 'wifi'] },
  roomingList: [
    { roomNumber: 1, roomType: 'junior_suite', occupants: [{ name: 'Elsa Carvajal', role: 'artist' }] },
    { roomNumber: 2, roomType: 'single', occupants: [{ name: 'Julian Bernal', role: 'guitarist' }] },
    { roomNumber: 3, roomType: 'single', occupants: [{ name: 'Manuel González', role: 'production_manager' }] },
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

// --- Catering (§14) ---
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
        { item: 'Plátanos', itemEn: 'Bananas', qty: 8 },
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
        { item: 'Agua Santa María', qty: 8, unit: 'bottles' },
        { item: 'Agua mineral', itemEn: 'Sparkling water', qty: 8, unit: 'bottles' },
        { item: 'Gatorade / Electrolit', qty: 8, unit: 'bottles' },
        { item: 'Té negro', itemEn: 'Black tea', qty: 1, unit: 'box' },
        { item: 'Té de jengibre', itemEn: 'Ginger tea', qty: 1, unit: 'box' },
        { item: 'Café regular y descafeinado', itemEn: 'Regular + decaf coffee', qty: 1, unit: 'station' },
        { item: 'French press + kettle', qty: 1 },
        { item: 'Jengibre fresco', itemEn: 'Fresh ginger', qty: 1, unit: 'piece' },
        { item: 'Limones', itemEn: 'Lemons', qty: 8 },
        { item: 'Crema', itemEn: 'Creamer', qty: 1, unit: 'pint' },
        { item: 'Leche de almendra sin azúcar', itemEn: 'Unsweetened almond milk', qty: 1, unit: 'carton', dietaryTags: ['no_sugar'] },
        { item: 'Yogurt griego sin azúcar', itemEn: 'Greek yogurt (unsweetened)', qty: 1, unit: 'cup', dietaryTags: ['no_sugar'] },
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
        { item: 'Globos pequeños', itemEn: 'Small balloons', qty: 1, unit: 'pack', notes: 'Medium or small only' },
        { item: 'Platillos regionales mexicanos', itemEn: 'Regional Mexican dishes', qty: 1, notes: 'Vegetarian options. Confirm with TM.', dietaryTags: ['vegetarian_option_required'] },
      ],
    },
    {
      room: 'Camerino 02 (Músicos)',
      menuTime: 'show',
      items: [
        { item: 'Agua Santa María', qty: 16, unit: 'bottles' },
        { item: 'Topo Chico (sparkling)', qty: 16, unit: 'bottles' },
        { item: 'Sports drinks', qty: 10, unit: 'bottles' },
        { item: 'Coca-Cola', qty: 6, unit: 'cans' },
        { item: 'Coca-Cola Zero', qty: 6, unit: 'cans' },
        { item: 'Limones', itemEn: 'Lemons', qty: 6 },
        { item: 'Plátanos', itemEn: 'Bananas', qty: 8 },
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
        { item: 'Sandwich station', qty: 1, notes: 'Whole grain bread, ham, turkey ham, manchego, panela, tomato/onion/avocado, mayo, mustard, chipotle, jalapeño + electric press' },
        { item: 'Desechables biodegradables', itemEn: 'Biodegradable disposables', qty: 1, unit: 'set', dietaryTags: ['biodegradable'] },
      ],
    },
    {
      room: 'Camerino 02 (Músicos)',
      menuTime: 'post_show',
      items: [
        { item: 'Vino blanco o rosado', itemEn: 'White or rosé wine', qty: 1, unit: 'bottle' },
        { item: 'Cervezas frías', itemEn: 'Cold beers', qty: 15, brandExcluded: ['Sol', 'Corona'], notes: 'NOT Sol, NOT Corona' },
        { item: 'Mezcal', qty: 2, unit: 'bottles', brandPreferred: ['Amaras', 'Unión', '400 Conejos'], notes: 'Outside MX: local equivalents' },
        { item: 'Platillos regionales', itemEn: 'Regional dishes', qty: 1, dietaryTags: ['vegetarian_option_required'] },
      ],
    },
    {
      room: 'Camerino 03 (Crew)',
      menuTime: 'post_show',
      items: [
        { item: 'Cervezas frías', itemEn: 'Cold beers', qty: 10, brandExcluded: ['Sol', 'Corona'], notes: 'NOT Sol, NOT Corona' },
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
    description: 'Generator count and capacity disagree between §4 stage specs and §8 lighting/power.',
    sectionsInvolved: ['stage_specs', 'lighting_equipment'],
    values: [
      { section: '§4 Stage specs', value: '2 generators, 1800A across 3 phases at 110-125V/60Hz' },
      { section: '§8 Lighting/power', value: '3 generators: Audio/Video 200kVA, Lighting 150kVA, Spare 200kVA' },
    ],
    suggestedResolution: 'Confirm with Manuel González (PM) — §8 is the more recent and detailed spec. Likely §8 supersedes §4.',
  },
  {
    id: 'cf_ch24',
    type: 'missing_reference',
    severity: 'medium',
    description: 'Channel 24 has a DI assigned (Radial PRO DI) but no source name in the input list.',
    sectionsInvolved: ['input_list'],
    values: [{ section: '§6 Input list', value: 'CH 24 source = (blank)' }],
    suggestedResolution: 'Confirm with FOH engineer — likely an additional keys or playback channel.',
  },
  {
    id: 'cf_gtr_dup',
    type: 'duplicate',
    severity: 'medium',
    description: 'Channels 26 and 27 are both labeled "GTR L" — likely an L/R typo.',
    sectionsInvolved: ['input_list'],
    values: [
      { section: '§6 Input list', value: 'CH 26 = "GTR L"' },
      { section: '§6 Input list', value: 'CH 27 = "GTR L"' },
    ],
    suggestedResolution: 'CH 27 should likely be "GTR R". Confirm with FOH.',
  },
  {
    id: 'cf_room_count',
    type: 'count_mismatch',
    severity: 'medium',
    description: 'Rider §12 header says 11 occupants but rooming-list rows total 13 (1 JR + 6 singles + 1 single with 2 sharing + 2 doubles).',
    sectionsInvolved: ['lodging'],
    values: [
      { section: '§12 Lodging header', value: 'Stated: 11 occupants' },
      { section: '§12 Lodging rooming list', value: 'Counted: 13 occupants' },
    ],
    suggestedResolution: 'Confirm with the TM. Room #7 is labeled "Single" but lists "MUA + Personal" — two people sharing a single room. Either the room type should be Double, or one of the two is unbooked.',
  },
  {
    id: 'cf_flight_count',
    type: 'count_mismatch',
    severity: 'medium',
    description: 'Air transport (§11) requests 8 tickets but rooming list (§12) totals 11-12 people.',
    sectionsInvolved: ['air_transport', 'lodging'],
    values: [
      { section: '§11 Air transport', value: '8 tickets' },
      { section: '§12 Lodging', value: '11-12 occupants' },
    ],
    suggestedResolution: 'Local hires (staff?) may not fly. Confirm with travel agent + TM.',
  },
];

// --- Rider sections assembled ---
const riderSections: RiderSection[] = [
  // §1 Cover & contacts
  {
    id: 'sec_cover_and_contacts',
    type: 'cover_and_contacts',
    pages: [1],
    status: 'approved',
    confidence: 0.98,
    language: 'es',
    freeText:
      'TECH RIDER | Full Band 2025. Updated: September 2025. FAVOR OMITIR VERSIONES ANTERIORES (please ignore previous versions). PM: Manuel González · magcs81@gmail.com · +52 55 54 74 70 48',
    freeTextEn:
      'TECH RIDER | Full Band 2025. Updated: September 2025. PLEASE IGNORE PREVIOUS VERSIONS. PM: Manuel González · magcs81@gmail.com · +52 55 54 74 70 48',
  },
  // §2 Production control — verbatim from rider p.3
  {
    id: 'sec_production_control',
    type: 'production_control',
    pages: [3],
    status: 'approved',
    confidence: 0.96,
    language: 'es',
    freeText:
      '2- NOTAS\nCONTROL DE PRODUCCIÓN\nEl promotor/empresario acepta que la producción de ELSA Y ELMAR tenga el control total y puede tomar decisiones sobre todos los temas relacionados con el show: horarios, escenario, vallas, acceso al venue, bandas abridoras, anuncios de cualquier tipo, publicidad en el venue, control de las luces de casa, aire acondicionado, calefacción, fotógrafos, video, circuito cerrado, acreditaciones, etc.',
    freeTextEn:
      '2 — NOTES\nPRODUCTION CONTROL\nThe promoter agrees that ELSA Y ELMAR\'s production team has full control and can make decisions on all matters related to the show: schedule, stage, barricades, venue access, opening acts, announcements of any kind, in-venue advertising, house-light control, A/C, heating, photographers, video, closed-circuit, credentials, etc.',
  },
  // §3 Permits — verbatim from rider p.3
  {
    id: 'sec_permits',
    type: 'permits',
    pages: [3],
    status: 'approved',
    confidence: 0.95,
    language: 'es',
    freeText:
      '3- PERMISOS\nPERMISOS, LICENCIAS Y CERTIFICADOS\nEn caso de ser necesario obtener y/o pagar cualquier tipo de licencias, permisos, seguros, certificados, visas y/o cualquier trámite requerido por cualquier sindicato, autoridad local o nacional, sociedad de autores y/o similares que tengan jurisdicción sobre las actuaciones, estos trámites y cargos serán responsabilidad del Promotor o Contratante.',
    freeTextEn:
      '3 — PERMITS\nPERMITS, LICENSES AND CERTIFICATES\nIf any licenses, permits, insurance, certificates, visas or any other paperwork is required by any union, local or national authority, performance-rights society or similar body with jurisdiction over the performances, the responsibility for obtaining and paying for them falls on the Promoter or Contractor.',
  },
  // §4 Stage specs
  {
    id: 'sec_stage_specs',
    type: 'stage_specs',
    pages: [4],
    status: 'review',
    confidence: 0.92,
    language: 'es',
    freeText:
      'Ground support 12m × 9m × 10m, techado. Escenario 14m × 10m a 1.50m de altura. Áreas de trabajo: 3.66m × 10m SL, 4.88m × 6.10m SR. 6 ventiladores (1 guitarra, 1 bajo, 1 batería, 3 frente). Negro o gris, liso, nivelado. 3 escaleras (USC, SL, SR). Mojo-type barricade reforzado. SIN risers. 2 generadores mínimo, 1800A en 3 fases a 110-125V/60Hz. Ambulancia desde load-in hasta load-out.',
    freeTextEn:
      'Ground support 12m × 9m × 10m, covered. Stage 14m × 10m at 1.50m height. Work areas: 3.66m × 10m SL, 4.88m × 6.10m SR. 6 fans (1 guitar, 1 bass, 1 drums, 3 front). Black or grey, smooth, level. 3 staircases (USC, SL, SR). HEAVY Mojo-type barricade. NO risers. 2 generators minimum, 1800A across 3 phases at 110-125V/60Hz. Ambulance from load-in to load-out.',
  },
  // §5 Audio PA
  {
    id: 'sec_audio_pa',
    type: 'audio_pa',
    pages: [5],
    status: 'review',
    confidence: 0.93,
    language: 'es',
    freeText:
      'PA estéreo 4-way, 105-110 dB(C), mín 110dB SPL. ±3dB de 25Hz-18kHz, 120dB headroom. L+R+Subs+Frontfill (NO mono). Marcas: L-Acoustics / Meyer / JBL VTX V. Específicos: D&B J8/J · L\'Acoustics V-DOSC/SB218 · Adamson Y18/T21 · Nexo GEOD/CD18. Front fill 4-6 cabinets misma marca. FOH centrado, nivel de suelo preferido, máx 50cm riser, máx 30m del escenario, cubierto, intercom a monitores. Consola FOH: tour trae propia. Alternativas: Yamaha CL5 / Avid S6L 32d / Waves LV1 (48ch). Monitores: 8× Shure PSM 1000 IEM + 6 bodypacks extra, 8× SE215, 2× 8ch combiners, 2× antenas helicoidales. Wireless mics tour trae: 2× Sennheiser EW300 G4, vocal principal+spare Sennheiser 470-558 MHz. Técnico RF requerido desde load-in hasta fin del show. Local provee: 2× cables Cat 6 96m FOH → SL.',
    freeTextEn:
      '4-way stereo PA, 105-110 dB(C), min 110dB SPL. ±3dB from 25Hz-18kHz, 120dB headroom. L+R+Subs+Frontfill (NOT mono). Brand options: L-Acoustics / Meyer / JBL VTX V. Specifics: D&B J8/J · L-Acoustics V-DOSC/SB218 · Adamson Y18/T21 · Nexo GEOD/CD18. Front fill 4-6 cabinets same brand. FOH centered, ground level preferred, max 50cm riser, max 30m from stage, covered, intercom to monitors. FOH console: tour brings own. Alternates: Yamaha CL5 / Avid S6L 32d / Waves LV1 (48ch). Monitors: 8× Shure PSM 1000 IEM + 6 extra bodypacks, 8× SE215, 2× 8-ch combiners, 2× helical antennas. Wireless mics tour-provided: 2× Sennheiser EW300 G4, main+spare vocal Sennheiser 470-558 MHz. RF tech required load-in to end of show. Local provides: 2× 96m Cat 6 cables FOH → SL.',
  },
  // §6 Input list (44 ch)
  {
    id: 'sec_input_list',
    type: 'input_list',
    pages: [6],
    status: 'review',
    confidence: 0.91,
    language: 'es',
    inputList: inputList44,
  },
  // §6 Monitor mix (8 stereo)
  {
    id: 'sec_audio_monitors',
    type: 'audio_monitors',
    pages: [6, 7],
    status: 'review',
    confidence: 0.94,
    language: 'es',
    monitorMix: monitorMix8,
  },
  // §6 FOH output patch
  {
    id: 'sec_output_patch',
    type: 'output_patch',
    pages: [7],
    status: 'review',
    confidence: 0.96,
    language: 'es',
    fohOutputs: fohOutputs8,
  },
  // §7 Stage plot
  {
    id: 'sec_stage_plot',
    type: 'stage_plot',
    pages: [8],
    status: 'pending',
    confidence: 0.78,
    language: 'es',
    freeText: 'Diagrama del escenario — Elsa center, Julian SR, Daniel SL, Juan upstage center. 4 wedges + IEMs. Power drops marked.',
    freeTextEn: 'Stage diagram — Elsa downstage center, Julian SR, Daniel SL, Juan upstage center. 4 wedges + IEMs. Power drops marked.',
  },
  // §8 Lighting equipment
  {
    id: 'sec_lighting_equipment',
    type: 'lighting_equipment',
    pages: [9, 10],
    status: 'review',
    confidence: 0.95,
    language: 'es',
    freeText:
      '43× Robe MegaPointe · 10× Color Strike M · 61× Elation Chorus Line 16 · 8× Robe Spider · 18× motores 1-ton · Truss: 8× Tomcat LD 12×12 10ft, 4× GT Tyler 10ft, 2× sideboom 1.5m, 2× sideboom 1m · 2× GrandMA 3 Full Size · 6× AM Haze Stadium o DF-50 · 2× Low Fog Machine · Generadores: 3 (Audio/Video 200kVA, Lighting 150kVA, Spare 200kVA), 3 fases + neutro + tierra (varilla 2m) por generador. Cam-Lock. Edison 110-127V en escenario.',
    freeTextEn:
      '43× Robe MegaPointe · 10× Color Strike M · 61× Elation Chorus Line 16 · 8× Robe Spider · 18× 1-ton hoist motors · Truss: 8× Tomcat LD 12×12 10ft, 4× GT Tyler 10ft, 2× sideboom 1.5m, 2× sideboom 1m · 2× GrandMA 3 Full Size · 6× AM Haze Stadium or DF-50 · 2× Low Fog Machine · 3 generators: Audio/Video 200kVA, Lighting 150kVA, Spare 200kVA. 3 phases + neutral + ground (2m rod) per generator. Cam-Lock. Edison 110-127V at stage.',
  },
  // §8 Lighting plot (CAD pages — stored, not extracted)
  {
    id: 'sec_lighting_plot',
    type: 'lighting_plot',
    pages: [11, 12, 13, 14, 15, 16, 17, 18],
    status: 'pending',
    confidence: 0.6,
    language: 'es',
    freeText: '8 páginas de planos CAD del lightplot. Almacenadas como referencia; v1 no extrae estructura de dibujos.',
    freeTextEn: '8 CAD pages of the light plot. Stored as reference attachments; v1 does not extract structure from drawings.',
  },
  // §9 Backline
  {
    id: 'sec_backline',
    type: 'backline',
    pages: [19, 20],
    status: 'review',
    confidence: 0.93,
    language: 'es',
    backline: backlineSpec,
  },
  // §10 Soundcheck
  {
    id: 'sec_soundcheck',
    type: 'soundcheck',
    pages: [21],
    status: 'approved',
    confidence: 0.99,
    language: 'es',
    freeText: 'Soundcheck a puertas cerradas. Mínimo 6 horas desde load-in.',
    freeTextEn: 'Closed-door soundcheck. Minimum 6 hours from load-in.',
  },
  // §11 Ground transport
  {
    id: 'sec_ground_transport',
    type: 'ground_transport',
    pages: [22],
    status: 'approved',
    confidence: 0.95,
    language: 'es',
    freeText: '2× Sprinter 20-pax + 1× cargo van, mínimo modelo 2020.',
    freeTextEn: '2× Sprinter 20-pax vans + 1× cargo van, minimum 2020 model.',
  },
  // §11 Air transport
  {
    id: 'sec_air_transport',
    type: 'air_transport',
    pages: [22],
    status: 'review',
    confidence: 0.9,
    language: 'es',
    freeText:
      'Viajes >5h requieren vuelo. 8 boletos total: 2 AM Plus (primera fila económica, asientos contiguos) + 6 económicos. Todos con maleta 25kg, 2 pasajeros con 2 maletas. Vuelos directos preferidos. Aprobación del TM requerida.',
    freeTextEn:
      'Trips >5h require flying. 8 tickets total: 2 AM Plus (front-row economy, seated together) + 6 economy. All with 25kg bag, 2 passengers get 2 bags. Direct flights preferred. TM approval required.',
  },
  // §12 Lodging
  {
    id: 'sec_lodging',
    type: 'lodging',
    pages: [23],
    status: 'review',
    confidence: 0.92,
    language: 'es',
    lodging: lodgingSpec,
  },
  // §13 Dressing rooms
  {
    id: 'sec_dressing_rooms',
    type: 'dressing_rooms',
    pages: [24],
    status: 'review',
    confidence: 0.88,
    language: 'es',
    freeText:
      '3 camerinos, 5m × 5m mín, con cerradura, sin humo, ventilados, sanitizados. Camerino 01 (Elsa): baño privado, 2 sillones, 4 sillas, espejo de cuerpo entero, perchero, 2 lámparas de pie de luz cálida, mesa de catering, 4 toallas faciales negras, multitomas con cargadores iPhone+Android + 6× 110V, hielera, jarrón con flores (claveles o lirios — NO rosas, NO girasoles), vela aromática SIN encender, papelera. Camerino 02 (músicos): baño privado, 2 sillones, 4 sillas, espejo, perchero, 1 lámpara de pie, mesa de catering, 8 toallas faciales negras, multitoma igual, hielera, papelera. Camerino 03 (crew): 2 sillones, mesa de trabajo, 6 sillas, mesa de catering, lámpara de pie, multitoma igual, hielera, papelera.',
    freeTextEn:
      '3 dressing rooms, 5m × 5m min, lockable, smoke-free, ventilated, sanitized. Camerino 01 (Elsa): private bath, 2 couches, 4 chairs, full mirror, coat rack, 2 floor lamps (warm light), catering table, 4 black face towels, multi-outlet w/ iPhone+Android chargers + 6× 110V, cooler, flower vase (carnations or lilies — NO roses, NO sunflowers), unlit scented candle, trash can. Camerino 02 (musicians): private bath, 2 couches, 4 chairs, mirror, coat rack, 1 floor lamp, catering table, 8 black face towels, multi-outlet same, cooler, trash can. Camerino 03 (crew): 2 couches, work table, 6 chairs, catering table, floor lamp, multi-outlet same, cooler, trash can.',
  },
  // §14 Catering
  {
    id: 'sec_catering',
    type: 'catering',
    pages: [25, 26],
    status: 'review',
    confidence: 0.86,
    language: 'es',
    catering: cateringSpec,
  },
  // Conflicts (derived)
  {
    id: 'sec_other',
    type: 'other',
    pages: [],
    status: 'review',
    confidence: 1.0,
    language: 'derived',
    conflicts,
  },
];

/** The extracted rider content, ready to clone into a fresh RiderImport. */
export const riderSeedImport: RiderImport = {
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
    name: 'Manuel González',
    email: 'magcs81@gmail.com',
    phone: '+52 55 54 74 70 48',
  },
  partySize: { tourists: 11, rooms: 10, flightTickets: 8 }, // rider-stated; flagged in conflicts
  sections: riderSections,
};
