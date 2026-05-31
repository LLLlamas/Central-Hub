// Hotel fixtures for scratch mode.
//
// One fixture per hotel — mirrors the real-world shape where a TM receives one
// booking confirmation per hotel (not a single bundled block document). On
// upload, occupant names are matched against the current scratch personnel
// (same name-matching as the flight import). Each hotel import also lays down
// a few hotel-advance tasks so the Day Sheet's Tasks panel has real content.

import { vis } from '@/lib/visibility';
import type { Hotel, Task, TourPerson } from '@/types';

interface RawHotelBlock {
  fixtureId: string; // matches a Fixture id in lib/fixtureMatcher.ts
  id: string;
  /** Day the block is keyed to — the check-in day (`day_${date}`). */
  dayId: string;
  name: string;
  address: string;
  phone: string;
  checkIn: string;  // HH:MM
  checkOut: string; // HH:MM
  nights: number;
  /** Nightly rate per room — matches the rate printed on the source PDF. */
  nightlyRate: number;
  currency: string;
  taxRate: number;
  /** Source confirmation filename so the cost row can open the original PDF. */
  sourceFilename: string;
  /** Rooming list — `name` is matched against personnel by name. */
  rooms: { name: string; roomNumber: string; roomType: string }[];
  /** Hotel-advance tasks that get added alongside this hotel. */
  tasks: { id: string; dayId: string; title: string; status: Task['status'] }[];
}

const CDMX_ROOMS = [
  { name: 'Elsa Carvajal', roomNumber: '1204', roomType: 'King Suite' },
  { name: 'Julian Bernal', roomNumber: '1108', roomType: 'King' },
  { name: 'Juan', roomNumber: '1110', roomType: 'Double' },
  { name: 'Daniel', roomNumber: '1112', roomType: 'Double' },
  { name: 'Tour Manager', roomNumber: '1106', roomType: 'King' },
  { name: 'Manuel González', roomNumber: '1102', roomType: 'King' },
  { name: 'Audio Engineer', roomNumber: '1009', roomType: 'Double' },
  { name: 'MUA', roomNumber: '1011', roomType: 'Double' },
];

const MTY_ROOMS = [
  { name: 'Elsa Carvajal', roomNumber: '808', roomType: 'King Suite' },
  { name: 'Julian Bernal', roomNumber: '810', roomType: 'King' },
  { name: 'Juan', roomNumber: '812', roomType: 'Double' },
  { name: 'Daniel', roomNumber: '814', roomType: 'Double' },
  { name: 'Tour Manager', roomNumber: '806', roomType: 'King' },
  { name: 'Manuel González', roomNumber: '804', roomType: 'King' },
  { name: 'Audio Engineer', roomNumber: '709', roomType: 'Double' },
  { name: 'MUA', roomNumber: '711', roomType: 'Double' },
];

const RAW_BLOCKS: RawHotelBlock[] = [
  {
    fixtureId: 'hotel_cdmx_nh_reforma',
    id: 'ho_cdmx',
    dayId: 'day_2026-09-22',
    name: 'NH Collection Mexico City Reforma',
    address: 'Paseo de la Reforma 122, Juárez, 06600 Ciudad de México',
    phone: '+52 55 1167 1900',
    checkIn: '15:00',
    checkOut: '12:00',
    nights: 5,
    nightlyRate: 218,
    currency: 'USD',
    taxRate: 0.16,
    sourceFilename: 'Hotel_CDMX_NH_Reforma_2026-09-22.pdf',
    rooms: CDMX_ROOMS,
    tasks: [
      {
        id: 'tk_hotel_rooming_cdmx',
        dayId: 'day_2026-09-22',
        title: 'Send the final rooming list to NH Collection Reforma',
        status: 'done',
      },
      {
        id: 'tk_hotel_checkout',
        dayId: 'day_2026-09-25',
        title: 'Confirm the 12:00 checkout for the Monterrey travel day',
        status: 'todo',
      },
    ],
  },
  {
    fixtureId: 'hotel_mty_fiesta_americana',
    id: 'ho_mty',
    dayId: 'day_2026-09-27',
    name: 'Fiesta Americana Monterrey Valle',
    address: 'Av. Lázaro Cárdenas 2305, Valle Oriente, 66260 Monterrey',
    phone: '+52 81 8133 8000',
    checkIn: '15:00',
    checkOut: '12:00',
    nights: 1,
    nightlyRate: 196,
    currency: 'USD',
    taxRate: 0.16,
    sourceFilename: 'Hotel_MTY_Fiesta_Americana_2026-09-27.pdf',
    rooms: MTY_ROOMS,
    tasks: [
      {
        id: 'tk_hotel_rooming_mty',
        dayId: 'day_2026-09-27',
        title: 'Email the rooming list to Fiesta Americana Monterrey',
        status: 'todo',
      },
    ],
  },
];

export interface ScratchHotelImport {
  hotels: Hotel[];
  tasks: Task[];
}

function buildBlock(b: RawHotelBlock, personnel: TourPerson[]): ScratchHotelImport {
  const byName = new Map(personnel.map((p) => [p.person.name.trim().toLowerCase(), p.id]));
  const hotel: Hotel = {
    id: b.id,
    dayId: b.dayId,
    name: b.name,
    address: b.address,
    phone: b.phone,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    nightlyRate: b.nightlyRate,
    currency: b.currency,
    taxRate: b.taxRate,
    sourceFilename: b.sourceFilename,
    occupants: b.rooms
      .map((r) => ({
        tourPersonId: byName.get(r.name.trim().toLowerCase()),
        roomNumber: r.roomNumber,
        roomType: r.roomType,
      }))
      .filter((o): o is { tourPersonId: string; roomNumber: string; roomType: string } =>
        Boolean(o.tourPersonId),
      ),
    visibility: vis.everyone('sees'),
    sensitive: false,
  };
  const tasks: Task[] = b.tasks.map((t) => ({
    id: t.id,
    dayId: t.dayId,
    title: t.title,
    status: t.status,
    visibility: vis.everyone('sees'),
  }));
  return { hotels: [hotel], tasks };
}

/**
 * Build the hotels + hotel-advance tasks for a single hotel fixture, matching
 * rooming-list names against the supplied personnel. Returns null for an
 * unknown fixture.
 */
export function buildScratchHotelImport(
  fixtureId: string,
  personnel: TourPerson[],
): ScratchHotelImport | null {
  const block = RAW_BLOCKS.find((b) => b.fixtureId === fixtureId);
  if (!block) return null;
  return buildBlock(block, personnel);
}

/**
 * Convenience for tests / programmatic seeding — every known hotel fixture
 * merged into one import. Not used by the upload flow (each PDF imports its
 * own hotel).
 */
export function buildAllScratchHotels(personnel: TourPerson[]): ScratchHotelImport {
  const merged: ScratchHotelImport = { hotels: [], tasks: [] };
  for (const b of RAW_BLOCKS) {
    const { hotels, tasks } = buildBlock(b, personnel);
    merged.hotels.push(...hotels);
    merged.tasks.push(...tasks);
  }
  return merged;
}
