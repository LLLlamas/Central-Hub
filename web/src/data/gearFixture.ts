// Gear & supplies fixture — items seeded from the Elsa y Elmar rider.
// Derived from: §6 Input-Output, §9 Backline, §13 Camerinos, §14 Catering.
// Call buildRiderGearItems() to get a fresh list; each call returns new IDs.

import type { GearItem, GearCategory, RiderSectionType } from '@/types';

type ItemSpec = Omit<GearItem, 'id'>;

function spec(
  name: string,
  quantity: number,
  category: GearCategory,
  opts: Partial<Omit<ItemSpec, 'name' | 'quantity' | 'category'>> = {},
): ItemSpec {
  return {
    name,
    quantity,
    category,
    status: 'needed',
    fromRider: true,
    ...opts,
  };
}

// ── §6 Mics & DI (Input List channels) ─────────────────────────────────────
const MIC_SPECS: ItemSpec[] = [
  spec('Kick drum mic — AKG D112 / Beta 52A', 1, 'audio_mics', { riderSection: 'input_list', riderPage: 7, estimatedCost: 15 }),
  spec('Snare top mic — Shure SM57', 2, 'audio_mics', { riderSection: 'input_list', riderPage: 7, estimatedCost: 12 }),
  spec('Hi-hat mic — Neumann KM184', 1, 'audio_mics', { riderSection: 'input_list', riderPage: 7, estimatedCost: 25 }),
  spec('Tom mics — Sennheiser e604', 3, 'audio_mics', { unit: 'each', riderSection: 'input_list', riderPage: 7, estimatedCost: 18 }),
  spec('Overhead mics — Neumann KM184 (pair)', 1, 'audio_mics', { unit: 'pair', riderSection: 'input_list', riderPage: 7, estimatedCost: 50 }),
  spec('Ride mic — Neumann KM184', 1, 'audio_mics', { riderSection: 'input_list', riderPage: 7, estimatedCost: 25 }),
  spec('Bass DI — Radial J48 or BSS AR-133', 1, 'audio_mics', { riderSection: 'input_list', riderPage: 8, estimatedCost: 20 }),
  spec('Guitar cab mic — Shure SM57', 2, 'audio_mics', { riderSection: 'input_list', riderPage: 8, estimatedCost: 12 }),
  spec('Keys DI — Radial J48 stereo', 2, 'audio_mics', { riderSection: 'input_list', riderPage: 8, estimatedCost: 20 }),
  spec('Lead vocal mic — Shure Beta87A or SM58', 1, 'audio_mics', { riderSection: 'input_list', riderPage: 9, estimatedCost: 20 }),
  spec('BG vocal mics — Shure SM58', 3, 'audio_mics', { riderSection: 'input_list', riderPage: 9, estimatedCost: 12 }),
  spec('Boom mic stands', 16, 'audio_mics', { unit: 'each', riderSection: 'input_list', riderPage: 7, estimatedCost: 8 }),
  spec('Short mic stands', 4, 'audio_mics', { unit: 'each', riderSection: 'input_list', riderPage: 7, estimatedCost: 5 }),
  spec('XLR cables — 10ft', 20, 'audio_mics', { unit: 'each', riderSection: 'input_list', riderPage: 7, estimatedCost: 5 }),
  spec('XLR cables — 25ft', 10, 'audio_mics', { unit: 'each', riderSection: 'input_list', riderPage: 7, estimatedCost: 7 }),
];

// ── §6 Monitors & IEMs ───────────────────────────────────────────────────────
const MONITOR_SPECS: ItemSpec[] = [
  spec('IEM system — Sennheiser G4 / Shure PSM300', 5, 'audio_monitors', { unit: 'systems', riderSection: 'audio_monitors', riderPage: 9, estimatedCost: 120, notes: 'One per artist + MD' }),
  spec('IEM earpieces', 5, 'audio_monitors', { unit: 'sets', riderSection: 'audio_monitors', riderPage: 9, estimatedCost: 30 }),
  spec('Monitor wedge — d&b M2 or equivalent', 4, 'audio_monitors', { riderSection: 'audio_monitors', riderPage: 9, estimatedCost: 80, notes: 'Front fill / side fill' }),
  spec('Drum fill speaker', 1, 'audio_monitors', { riderSection: 'audio_monitors', riderPage: 9, estimatedCost: 100 }),
  spec('Monitor amplifier', 2, 'audio_monitors', { riderSection: 'audio_monitors', riderPage: 9, estimatedCost: 60 }),
];

// ── §9 Backline — Drums ───────────────────────────────────────────────────────
const DRUM_SPECS: ItemSpec[] = [
  spec('Drum kit — Gretsch Classic Maple / DW Collectors / Yamaha Hybrid Maple', 1, 'backline_drums', {
    riderSection: 'backline', riderPage: 18, estimatedCost: 350,
    notes: '22" kick · 13" rack tom · 16" + 18" floor toms (with legs)',
  }),
  spec('Snare main — 14×6 or 14×8 (Supraphonic / Black Magic)', 1, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 40 }),
  spec('Snare 2 — 14×6 Maple (Gretsch Brooklyn USA)', 1, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 40 }),
  spec('Snare spare — 14×6', 1, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 25 }),
  spec('Snare stands', 3, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 15, notes: 'DW or Pearl preferred' }),
  spec('Cymbal booms', 4, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 12 }),
  spec('Hi-hat stand — DW 5000', 1, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 20, notes: 'NOT Yamaha' }),
  spec('Kick pedal', 1, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 20 }),
  spec('Drum rug', 1, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 15 }),
  spec('Drum heads — Remo Ambassador Coated', 1, 'backline_drums', { unit: 'set', riderSection: 'backline', riderPage: 18, estimatedCost: 60 }),
  spec('Drum throne — DW Airlift 9000, 62cm round seat', 1, 'backline_drums', { riderSection: 'backline', riderPage: 18, estimatedCost: 25, notes: 'NOT motorcycle seat' }),
];

// ── §9 Backline — Bass ────────────────────────────────────────────────────────
const BASS_SPECS: ItemSpec[] = [
  spec('Bass amp head — Ampeg SVT-Classic / Aguilar TH700', 1, 'backline_bass', {
    riderSection: 'backline', riderPage: 18, estimatedCost: 150,
    notes: 'Options: SVT-Classic · Aguilar TH700 · Aguilar DB751',
  }),
  spec('Bass cab — Ampeg 8×10 / Aguilar DB810', 1, 'backline_bass', { riderSection: 'backline', riderPage: 18, estimatedCost: 120 }),
];

// ── §9 Backline — Guitar ──────────────────────────────────────────────────────
const GUITAR_SPECS: ItemSpec[] = [
  spec('Guitar amp — Fender Twin Reverb 2×12 (main)', 1, 'backline_guitar', { riderSection: 'backline', riderPage: 18, estimatedCost: 130 }),
  spec('Guitar amp — Fender Hot Rod 2×12', 1, 'backline_guitar', { riderSection: 'backline', riderPage: 18, estimatedCost: 110 }),
  spec('Guitar amp — Fender Twin Reverb 2×12 (spare)', 1, 'backline_guitar', { riderSection: 'backline', riderPage: 18, estimatedCost: 130, notes: 'Spare' }),
];

// ── §9 Backline — Keys & misc ─────────────────────────────────────────────────
const KEYS_MISC_SPECS: ItemSpec[] = [
  spec('Hercules keyboard stands', 4, 'backline_keys', { riderSection: 'backline', riderPage: 18, estimatedCost: 30, notes: 'Hercules brand preferred' }),
  spec('Hercules instrument stands', 6, 'backline_other', { riderSection: 'backline', riderPage: 18, estimatedCost: 20, notes: 'Hercules brand preferred' }),
  spec('7-space guitar rack', 2, 'backline_other', { riderSection: 'backline', riderPage: 18, estimatedCost: 40 }),
  spec('Percussion tables', 6, 'backline_other', { riderSection: 'backline', riderPage: 18, estimatedCost: 20 }),
  spec('1/4" 17ft instrument cables', 6, 'backline_other', { unit: 'each', riderSection: 'backline', riderPage: 18, estimatedCost: 8 }),
];

// ── §8 Video screen ───────────────────────────────────────────────────────────
const VIDEO_SPECS: ItemSpec[] = [
  spec('LED video screen — 12×5m, 16:9, 1080p preferred', 1, 'video', {
    riderSection: 'video', riderPage: 12, estimatedCost: 3500,
    notes: 'Min resolution 1280×720. Confirm with VJ.',
  }),
];

// ── §13 Dressing rooms ────────────────────────────────────────────────────────
const DRESSING_ROOM_SPECS: ItemSpec[] = [
  spec('Full-length mirror', 2, 'dressing_room', { riderSection: 'dressing_rooms', riderPage: 21 }),
  spec('Clothing rack with hangers', 2, 'dressing_room', { riderSection: 'dressing_rooms', riderPage: 21 }),
  spec('Iron + ironing board', 1, 'dressing_room', { riderSection: 'dressing_rooms', riderPage: 21 }),
  spec('Large black towels', 15, 'dressing_room', { unit: 'each', riderSection: 'dressing_rooms', riderPage: 21, estimatedCost: 5 }),
  spec('Mini-fridge or cooler per room', 2, 'dressing_room', { riderSection: 'dressing_rooms', riderPage: 21 }),
  spec('Wi-fi access (separate network)', 1, 'dressing_room', { riderSection: 'dressing_rooms', riderPage: 21, notes: 'Separate from venue public network' }),
  spec('Power strips — 6-outlet', 4, 'dressing_room', { riderSection: 'dressing_rooms', riderPage: 21, estimatedCost: 15 }),
  spec('Biodegradable trash bags', 10, 'dressing_room', { unit: 'each', riderSection: 'dressing_rooms', riderPage: 21, estimatedCost: 1 }),
];

// ── §14 Catering ──────────────────────────────────────────────────────────────
const CATERING_SPECS: ItemSpec[] = [
  // Load-in / crew
  spec('Still water — 500ml', 32, 'catering', { unit: 'bottles', riderSection: 'catering', riderPage: 22, estimatedCost: 1 }),
  spec('Sparkling water — 500ml', 16, 'catering', { unit: 'bottles', riderSection: 'catering', riderPage: 22, estimatedCost: 1.5 }),
  spec('Coffee station', 1, 'catering', { riderSection: 'catering', riderPage: 22, estimatedCost: 40, notes: 'Load-in through post-show' }),
  spec('Assorted sodas', 12, 'catering', { unit: 'cans', riderSection: 'catering', riderPage: 22, estimatedCost: 2 }),
  spec('Red Bull', 6, 'catering', { unit: 'cans', riderSection: 'catering', riderPage: 22, estimatedCost: 3 }),
  spec('Gatorade / Electrolit', 14, 'catering', { unit: 'bottles', riderSection: 'catering', riderPage: 22, estimatedCost: 2 }),
  spec('Fresh fruit assortment', 1, 'catering', { unit: 'assortment', riderSection: 'catering', riderPage: 22, estimatedCost: 30 }),
  spec('Snack bars (Nature Valley)', 1, 'catering', { unit: 'assorted', riderSection: 'catering', riderPage: 22, estimatedCost: 20 }),
  spec('Ice — large cooler', 2, 'catering', { unit: 'coolers', riderSection: 'catering', riderPage: 22, estimatedCost: 15 }),
  // Artist room
  spec('Black + ginger tea bags', 2, 'catering', { unit: 'boxes', riderSection: 'catering', riderPage: 23, estimatedCost: 8, notes: 'Artist room pre-show' }),
  spec('French press + electric kettle', 1, 'catering', { riderSection: 'catering', riderPage: 23, estimatedCost: 40 }),
  spec('Fresh ginger + lemons', 1, 'catering', { unit: 'set', riderSection: 'catering', riderPage: 23, estimatedCost: 10 }),
  spec('Unsweetened almond milk', 1, 'catering', { unit: 'carton', riderSection: 'catering', riderPage: 23, estimatedCost: 4 }),
  spec('Charcuterie / deli tray', 2, 'catering', { unit: 'trays', riderSection: 'catering', riderPage: 23, estimatedCost: 45, notes: 'One artist, one band' }),
  spec('Mixed nuts (almonds + pistachios)', 2, 'catering', { unit: 'bowls', riderSection: 'catering', riderPage: 23, estimatedCost: 15 }),
  spec('Slim Pop popcorn — 3 flavors', 3, 'catering', { unit: 'bags', riderSection: 'catering', riderPage: 23, estimatedCost: 5, notes: 'Cheddar / natural / sweet' }),
  // Band room
  spec('Topo Chico sparkling water', 16, 'catering', { unit: 'bottles', riderSection: 'catering', riderPage: 24, estimatedCost: 2 }),
  spec('Coca-Cola + Coca-Cola Zero', 12, 'catering', { unit: 'cans', riderSection: 'catering', riderPage: 24, estimatedCost: 1.5 }),
  spec('Biodegradable cups + plates', 2, 'catering', { unit: 'packs', riderSection: 'catering', riderPage: 24, estimatedCost: 12, notes: 'Per rider eco requirement' }),
  // Post-show
  spec('White or rosé wine', 1, 'catering', { unit: 'bottle', riderSection: 'catering', riderPage: 25, estimatedCost: 25, notes: 'Post-show — band room' }),
  spec('Cold beers (NOT Sol, NOT Corona)', 25, 'catering', { unit: 'bottles', riderSection: 'catering', riderPage: 25, estimatedCost: 3, notes: '15 band + 10 crew' }),
  spec('Mezcal — Amaras / Unión / 400 Conejos', 2, 'catering', { unit: 'bottles', riderSection: 'catering', riderPage: 25, estimatedCost: 45, notes: 'Outside MX: local equivalent OK' }),
  spec('Hot meal — regional dishes', 3, 'catering', { unit: 'orders', riderSection: 'catering', riderPage: 26, estimatedCost: 25, notes: 'Vegetarian options required. Confirm with TM.' }),
  spec('Sandwich station — crew', 1, 'catering', { riderSection: 'catering', riderPage: 25, estimatedCost: 60, notes: 'Whole grain, deli meats, cheese, condiments, electric press' }),
  spec('Dark chocolate — Valor / Lindt 70%', 2, 'catering', { unit: 'bars', riderSection: 'catering', riderPage: 23, estimatedCost: 6 }),
  spec('Leftover food donation plan', 1, 'catering', { riderSection: 'catering', riderPage: 27, estimatedCost: 0, notes: 'Coordinate donation to local charity or venue staff' }),
];

const ALL_SPECS: ItemSpec[] = [
  ...MIC_SPECS,
  ...MONITOR_SPECS,
  ...DRUM_SPECS,
  ...BASS_SPECS,
  ...GUITAR_SPECS,
  ...KEYS_MISC_SPECS,
  ...VIDEO_SPECS,
  ...DRESSING_ROOM_SPECS,
  ...CATERING_SPECS,
];

/** Build a fresh gear item list from the rider. Each call produces new IDs. */
export function buildRiderGearItems(): GearItem[] {
  return ALL_SPECS.map((s, i) => ({
    ...s,
    id: `gear_rider_${i + 1}`,
  }));
}

/** Smart-merge a fresh rider build with the user's current gear list.
 *  - Manual items (fromRider: false): always kept unchanged.
 *  - Rider items in current: keep user edits (status/cost/notes), update quantity from fresh.
 *  - Rider items not in current: appended with 'needed' status.
 *  - Rider items missing from the new build: kept as-is (user may have notes/sourcing). */
export function mergeGearItems(current: GearItem[], fresh: GearItem[]): GearItem[] {
  const freshByName = new Map(fresh.map((f) => [f.name.trim().toLowerCase(), f]));
  const seen = new Set<string>();
  const result: GearItem[] = [];

  for (const cur of current) {
    const key = cur.name.trim().toLowerCase();
    seen.add(key);
    if (!cur.fromRider) {
      result.push(cur);
      continue;
    }
    const match = freshByName.get(key);
    result.push(match ? { ...cur, quantity: match.quantity } : cur);
  }

  for (const [key, item] of freshByName) {
    if (!seen.has(key)) result.push(item);
  }

  return result;
}
