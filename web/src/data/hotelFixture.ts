// Hotel fixture for scratch mode.
//
// Raw hotel-block data for the hotel-confirmation PDF in web/public/. On
// upload, occupant names are matched against the current scratch personnel
// (same name-matching as the flight import). The import also lays down a few
// hotel-advance tasks so the Day Sheet's Tasks panel has real content.

import { vis } from '@/lib/visibility';
import type { Hotel, Task, TourPerson } from '@/types';

interface RawHotelBlock {
  id: string;
  /** Day the block is keyed to — the check-in day (`day_${date}`). */
  dayId: string;
  name: string;
  address: string;
  phone: string;
  checkIn: string;  // HH:MM
  checkOut: string; // HH:MM
  nights: number;
  /** Rooming list — `name` is matched against personnel by name. */
  rooms: { name: string; roomNumber: string; roomType: string }[];
}

const CDMX_ROOMS = [
  { name: 'Elsa Carvajal', roomNumber: '1204', roomType: 'King suite' },
  { name: 'Julian Bernal', roomNumber: '1108', roomType: 'King' },
  { name: 'Juan', roomNumber: '1110', roomType: 'Double' },
  { name: 'Daniel', roomNumber: '1112', roomType: 'Double' },
  { name: 'Tour Manager', roomNumber: '1106', roomType: 'King' },
  { name: 'Manuel González', roomNumber: '1102', roomType: 'King' },
  { name: 'Audio Engineer', roomNumber: '1009', roomType: 'Double' },
  { name: 'MUA', roomNumber: '1011', roomType: 'Double' },
];

const MTY_ROOMS = [
  { name: 'Elsa Carvajal', roomNumber: '808', roomType: 'King suite' },
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
    id: 'ho_cdmx',
    dayId: 'day_2025-09-22',
    name: 'NH Collection Mexico City Reforma',
    address: 'Paseo de la Reforma 122, Juárez, 06600 Ciudad de México',
    phone: '+52 55 1167 1900',
    checkIn: '15:00',
    checkOut: '12:00',
    nights: 5,
    rooms: CDMX_ROOMS,
  },
  {
    id: 'ho_mty',
    dayId: 'day_2025-09-27',
    name: 'Fiesta Americana Monterrey Valle',
    address: 'Av. Lázaro Cárdenas 2305, Valle Oriente, 66260 Monterrey',
    phone: '+52 81 8133 8000',
    checkIn: '15:00',
    checkOut: '12:00',
    nights: 1,
    rooms: MTY_ROOMS,
  },
];

// Hotel-advance tasks the booking confirmation kicks off — tied to the days
// they belong to so they surface in the Day Sheet / Day Detail Tasks panels.
const RAW_TASKS: { id: string; dayId: string; title: string; status: Task['status'] }[] = [
  {
    id: 'tk_hotel_rooming_cdmx',
    dayId: 'day_2025-09-22',
    title: 'Send the final rooming list to NH Collection Reforma',
    status: 'done',
  },
  {
    id: 'tk_hotel_checkout',
    dayId: 'day_2025-09-25',
    title: 'Confirm the 12:00 checkout for the Monterrey travel day',
    status: 'todo',
  },
  {
    id: 'tk_hotel_rooming_mty',
    dayId: 'day_2025-09-27',
    title: 'Email the rooming list to Fiesta Americana Monterrey',
    status: 'todo',
  },
];

export interface ScratchHotelImport {
  hotels: Hotel[];
  tasks: Task[];
}

/**
 * Build the hotels + hotel-advance tasks for the scratch tour, matching
 * rooming-list names against the supplied personnel. Occupants whose name
 * has no match are dropped (the roster uses placeholder names).
 */
export function buildScratchHotelImport(personnel: TourPerson[]): ScratchHotelImport {
  const byName = new Map(personnel.map((p) => [p.person.name.trim().toLowerCase(), p.id]));

  const hotels: Hotel[] = RAW_BLOCKS.map((b) => ({
    id: b.id,
    dayId: b.dayId,
    name: b.name,
    address: b.address,
    phone: b.phone,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
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
  }));

  const tasks: Task[] = RAW_TASKS.map((t) => ({
    id: t.id,
    dayId: t.dayId,
    title: t.title,
    status: t.status,
    visibility: vis.everyone('sees'),
  }));

  return { hotels, tasks };
}
