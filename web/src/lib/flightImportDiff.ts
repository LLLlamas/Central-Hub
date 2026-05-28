// Diff two FlightImports of the same leg, so the reviewer can see what
// changed when a new upload (boarding pass) supersedes an earlier one (grid).
//
// Names are normalized (trimmed, lowercased) for matching — so "L. Llamas" and
// "Lorenzo Llamas" still won't auto-match here (that's the resolution modal's
// job at commit-time, not the dedupe layer). For dedupe purposes we report
// "added" / "removed" by name and "changed" when a same-name passenger has a
// different seat.

import type { FlightImport, ParsedFlight } from '@/types';

export interface SeatChange {
  name: string;
  fromSeat?: string;
  toSeat?: string;
}

export interface FlightImportDiff {
  /** Passengers in `candidate` but not in `existing` (matched by name). */
  added: { name: string; seat?: string }[];
  /** Passengers in `existing` but not in `candidate`. */
  removed: { name: string; seat?: string }[];
  /** Same-name passengers whose seat (or other fields) differ. */
  changed: SeatChange[];
  /** True if the parsed flight metadata (time, PNR, airports) differs. */
  metadataChanged: boolean;
}

function passengerMap(pf: ParsedFlight | undefined) {
  const m = new Map<string, { name: string; seat?: string }>();
  if (!pf) return m;
  for (const p of pf.passengers) {
    m.set(p.name.trim().toLowerCase(), { name: p.name, seat: p.seat });
  }
  return m;
}

export function diffFlightImports(existing: FlightImport, candidate: FlightImport): FlightImportDiff {
  const a = passengerMap(existing.parsedFlights[0]);
  const b = passengerMap(candidate.parsedFlights[0]);

  const added: { name: string; seat?: string }[] = [];
  const removed: { name: string; seat?: string }[] = [];
  const changed: SeatChange[] = [];

  for (const [key, p] of b) {
    if (!a.has(key)) added.push(p);
  }
  for (const [key, p] of a) {
    if (!b.has(key)) removed.push(p);
  }
  for (const [key, pA] of a) {
    const pB = b.get(key);
    if (!pB) continue;
    if ((pA.seat ?? '') !== (pB.seat ?? '')) {
      changed.push({ name: pB.name, fromSeat: pA.seat, toSeat: pB.seat });
    }
  }

  const af = existing.parsedFlights[0];
  const bf = candidate.parsedFlights[0];
  const metadataChanged = !!(
    af && bf &&
    (af.departureTime !== bf.departureTime ||
      af.arrivalTime !== bf.arrivalTime ||
      af.recordLocator !== bf.recordLocator ||
      af.departureAirport !== bf.departureAirport ||
      af.arrivalAirport !== bf.arrivalAirport)
  );

  return { added, removed, changed, metadataChanged };
}

/** True if the diff is empty (the two imports describe the same data). */
export function diffIsEmpty(d: FlightImportDiff): boolean {
  return d.added.length === 0 && d.removed.length === 0 && d.changed.length === 0 && !d.metadataChanged;
}
