import { describe, it, expect } from 'vitest';
import { diffFlightImports, diffIsEmpty } from '@/lib/flightImportDiff';
import type { FlightImport, ParsedFlight } from '@/types';

function fi(id: string, passengers: { name: string; seat?: string }[], pfPatch: Partial<ParsedFlight> = {}): FlightImport {
  return {
    id,
    filename: `${id}.csv`,
    uploadedAt: '2026-09-25T09:00',
    status: 'review',
    parsedFlights: [{
      airline: 'AeromÃ©xico',
      flightNumber: 'AM 19',
      departureAirport: 'LAX',
      arrivalAirport: 'MEX',
      departureTime: '2026-09-22T09:35',
      arrivalTime: '2026-09-22T15:20',
      recordLocator: 'ABCD12',
      passengers,
      ...pfPatch,
    }],
    unmatchedNames: [],
  };
}

describe('diffFlightImports', () => {
  it('reports no changes for identical passenger lists', () => {
    const a = fi('a', [{ name: 'Elsa', seat: '2A' }, { name: 'Julian', seat: '2C' }]);
    const b = fi('b', [{ name: 'Elsa', seat: '2A' }, { name: 'Julian', seat: '2C' }]);
    expect(diffIsEmpty(diffFlightImports(a, b))).toBe(true);
  });

  it('detects added passengers', () => {
    const a = fi('a', [{ name: 'Elsa', seat: '2A' }]);
    const b = fi('b', [{ name: 'Elsa', seat: '2A' }, { name: 'Julian', seat: '2C' }]);
    const d = diffFlightImports(a, b);
    expect(d.added.map((p) => p.name)).toEqual(['Julian']);
    expect(d.removed).toEqual([]);
    expect(d.changed).toEqual([]);
  });

  it('detects removed passengers', () => {
    const a = fi('a', [{ name: 'Elsa', seat: '2A' }, { name: 'Julian', seat: '2C' }]);
    const b = fi('b', [{ name: 'Elsa', seat: '2A' }]);
    expect(diffFlightImports(a, b).removed.map((p) => p.name)).toEqual(['Julian']);
  });

  it('detects seat changes', () => {
    const a = fi('a', [{ name: 'Elsa', seat: '2A' }]);
    const b = fi('b', [{ name: 'Elsa', seat: '4C' }]);
    const d = diffFlightImports(a, b);
    expect(d.changed).toEqual([{ name: 'Elsa', fromSeat: '2A', toSeat: '4C' }]);
  });

  it('flags metadata changes', () => {
    const a = fi('a', [{ name: 'Elsa' }]);
    const b = fi('b', [{ name: 'Elsa' }], { departureTime: '2026-09-22T10:00' });
    expect(diffFlightImports(a, b).metadataChanged).toBe(true);
  });

  it('matches names case-insensitively + trimmed', () => {
    const a = fi('a', [{ name: 'Elsa Carvajal', seat: '2A' }]);
    const b = fi('b', [{ name: '  elsa carvajal ', seat: '4C' }]);
    const d = diffFlightImports(a, b);
    expect(d.added).toEqual([]);
    expect(d.changed).toHaveLength(1);
  });
});
