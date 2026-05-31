// Travel-grid CSV ingest — the bulk path for flights.
//
// Real tours typically get all flights from the travel agent as a single grid
// (one row per passenger × leg). This parser turns that CSV into one or more
// `FlightImport`s — one per (airline, flightNumber, date) — so each leg goes
// through the same review surface as a boarding-pass upload.

import { getNowIso } from '@/lib/today';
import type { FlightImport, ParsedFlight, TourPerson } from '@/types';

export interface TravelGridRow {
  passenger: string;
  confirmation: string;
  ticket: string;
  date: string;     // YYYY-MM-DD
  airline: string;
  flight: string;   // e.g. "AM 19"
  from: string;
  to: string;
  depart: string;   // HH:MM
  arrive: string;
  seat: string;
  travelClass: string;
  cost: string;
  notes: string;
}

const HEADER_ALIASES: Record<keyof TravelGridRow, string[]> = {
  passenger: ['passenger', 'passenger name', 'name'],
  confirmation: ['confirmation', 'confirmation #', 'pnr', 'record locator'],
  ticket: ['ticket', 'ticket #', 'ticket number'],
  date: ['date'],
  airline: ['airline', 'carrier'],
  flight: ['flight', 'flight #', 'flight number'],
  from: ['from', 'origin', 'depart airport'],
  to: ['to', 'destination', 'arrive airport'],
  depart: ['depart', 'departure', 'depart time'],
  arrive: ['arrive', 'arrival', 'arrive time'],
  seat: ['seat'],
  travelClass: ['class', 'cabin'],
  cost: ['cost', 'fare', 'price'],
  notes: ['notes', 'note', 'remarks'],
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseTravelGridCsv(csv: string): TravelGridRow[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const colIdx: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    colIdx[field] = idx;
  }
  return lines
    .slice(1)
    .map((line) => {
      const cells = splitCsvLine(line);
      const get = (k: keyof TravelGridRow) =>
        colIdx[k] >= 0 ? cells[colIdx[k]] ?? '' : '';
      return {
        passenger: get('passenger'),
        confirmation: get('confirmation'),
        ticket: get('ticket'),
        date: get('date'),
        airline: get('airline'),
        flight: get('flight'),
        from: get('from'),
        to: get('to'),
        depart: get('depart'),
        arrive: get('arrive'),
        seat: get('seat'),
        travelClass: get('travelClass'),
        cost: get('cost'),
        notes: get('notes'),
      } satisfies TravelGridRow;
    })
    .filter((r) => r.passenger && r.flight && r.date);
}

/**
 * Build one FlightImport per distinct (airline, flightNumber, date) in the grid.
 * Names are matched against personnel as a best-effort *hint* — unmatched rows
 * still ride along so a reviewing TM can see exactly what the agent sent.
 */
export function buildFlightImportsFromGrid(
  csv: string,
  filename: string,
  personnel: TourPerson[],
): FlightImport[] {
  const rows = parseTravelGridCsv(csv);
  if (rows.length === 0) return [];

  const byName = new Map(
    personnel.map((p) => [p.person.name.trim().toLowerCase(), p.id]),
  );

  const groups = new Map<string, TravelGridRow[]>();
  for (const r of rows) {
    const key = `${r.airline}|${r.flight}|${r.date}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  return [...groups.entries()].map(([key, legRows]) => {
    const first = legRows[0];
    const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const passengers: ParsedFlight['passengers'] = legRows.map((r) => ({
      name: r.passenger,
      seat: r.seat,
      matchedTourPersonId: byName.get(r.passenger.trim().toLowerCase()),
    }));
    const parsed: ParsedFlight = {
      airline: first.airline,
      flightNumber: first.flight,
      departureAirport: first.from,
      arrivalAirport: first.to,
      departureTime: `${first.date}T${first.depart}`,
      arrivalTime: `${first.date}T${first.arrive}`,
      recordLocator: first.confirmation,
      passengers,
    };
    return {
      id: `fi_grid_${slug}`,
      filename,
      uploadedAt: getNowIso(),
      status: 'review',
      parsedFlights: [parsed],
      unmatchedNames: passengers.filter((p) => !p.matchedTourPersonId).map((p) => p.name),
    };
  });
}
