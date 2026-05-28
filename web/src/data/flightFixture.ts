// Flight fixtures for scratch mode.
//
// Raw flight data for the two flight-confirmation PDFs in web/public/. On
// upload, passenger names are matched against the current scratch personnel —
// names that don't match (e.g. a touring name not yet on the roster) surface
// as "unmatched", exactly as a real AI ingest would.

import { MOCK_NOW } from '@/lib/today';
import type { FlightImport, ParsedFlight, TourPerson } from '@/types';

interface RawFlight {
  fixtureId: string;     // matches a Fixture id in lib/fixtureMatcher.ts
  importId: string;
  filename: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string; // ISO datetime
  arrivalTime: string;
  recordLocator: string;
  passengers: { name: string; seat: string }[];
}

// Same 8-passenger group books both intra-Mexico flights.
const GROUP = [
  { name: 'Elsa Carvajal', seat: '2A' },
  { name: 'Julian Bernal', seat: '2C' },
  { name: 'Juan', seat: '3A' },
  { name: 'Daniel', seat: '3C' },
  { name: 'Tour Manager', seat: '4A' },
  { name: 'Manuel González', seat: '4C' },
  { name: 'Audio Engineer', seat: '5A' },
  { name: 'MUA', seat: '5C' },
];

const RAW_FLIGHTS: RawFlight[] = [
  {
    fixtureId: 'flight_am19',
    importId: 'fi_am19',
    filename: 'AM19_Group_LAX-MEX_2025-09-22.pdf',
    airline: 'Aeroméxico',
    flightNumber: 'AM 19',
    departureAirport: 'LAX',
    arrivalAirport: 'MEX',
    departureTime: '2025-09-22T09:35',
    arrivalTime: '2025-09-22T15:20',
    recordLocator: 'ABCD12',
    passengers: GROUP,
  },
  {
    fixtureId: 'flight_vb1014',
    importId: 'fi_vb1014',
    filename: 'VB1014_Group_MEX-MTY_2025-09-27.pdf',
    airline: 'VivaAerobus',
    flightNumber: 'VB 1014',
    departureAirport: 'MEX',
    arrivalAirport: 'MTY',
    departureTime: '2025-09-27T11:00',
    arrivalTime: '2025-09-27T12:35',
    recordLocator: 'XYZ987',
    passengers: GROUP,
  },
];

/**
 * Build a review-ready FlightImport for the given fixture, matching passenger
 * names against the supplied personnel. Returns null for an unknown fixture.
 */
export function buildScratchFlightImport(
  fixtureId: string,
  personnel: TourPerson[],
): FlightImport | null {
  const raw = RAW_FLIGHTS.find((r) => r.fixtureId === fixtureId);
  if (!raw) return null;

  const byName = new Map(personnel.map((p) => [p.person.name.trim().toLowerCase(), p.id]));
  const passengers: ParsedFlight['passengers'] = raw.passengers.map((p) => ({
    name: p.name,
    seat: p.seat,
    matchedTourPersonId: byName.get(p.name.trim().toLowerCase()),
  }));
  const unmatchedNames = passengers.filter((p) => !p.matchedTourPersonId).map((p) => p.name);

  const parsedFlight: ParsedFlight = {
    airline: raw.airline,
    flightNumber: raw.flightNumber,
    departureAirport: raw.departureAirport,
    arrivalAirport: raw.arrivalAirport,
    departureTime: raw.departureTime,
    arrivalTime: raw.arrivalTime,
    recordLocator: raw.recordLocator,
    passengers,
  };

  return {
    id: raw.importId,
    filename: raw.filename,
    uploadedAt: MOCK_NOW,
    status: 'review',
    parsedFlights: [parsedFlight],
    unmatchedNames,
  };
}
