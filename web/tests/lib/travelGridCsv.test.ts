import { describe, it, expect } from 'vitest';
import { parseTravelGridCsv, buildFlightImportsFromGrid } from '@/lib/travelGridCsv';
import type { TourPerson } from '@/types';

const CSV = `Passenger,Confirmation,Ticket,Date,Airline,Flight,From,To,Depart,Arrive,Seat,Class,Cost,Notes
Elsa Carvajal,ABCD12,T-1,2026-09-22,AeromÃ©xico,AM 19,LAX,MEX,09:35,15:20,2A,Economy,420 USD,Group
Julian Bernal,ABCD12,T-2,2026-09-22,AeromÃ©xico,AM 19,LAX,MEX,09:35,15:20,2C,Economy,420 USD,Group
Elsa Carvajal,XYZ987,T-3,2026-09-27,VivaAerobus,VB 1014,MEX,MTY,11:00,12:35,2A,Economy,138 USD,Group
Julian Bernal,XYZ987,T-4,2026-09-27,VivaAerobus,VB 1014,MEX,MTY,11:00,12:35,2C,Economy,138 USD,Group
`;

const personnel: TourPerson[] = [
  {
    id: 'tp_elsa',
    personId: 'p_elsa',
    person: { id: 'p_elsa', name: 'Elsa Carvajal' },
    role: 'Artist',
    groupId: 'grp_band',
    tagIds: [],
    startDate: '',
    endDate: '',
  },
];

describe('parseTravelGridCsv', () => {
  it('parses every row', () => {
    expect(parseTravelGridCsv(CSV)).toHaveLength(4);
  });
  it('drops rows with missing required fields', () => {
    expect(parseTravelGridCsv('Passenger,Date,Flight\n,,\n')).toHaveLength(0);
  });
  it('returns empty array for empty input', () => {
    expect(parseTravelGridCsv('')).toEqual([]);
  });
});

describe('buildFlightImportsFromGrid', () => {
  it('groups by (airline, flight, date) into one FlightImport per leg', () => {
    const imports = buildFlightImportsFromGrid(CSV, 'grid.csv', personnel);
    expect(imports).toHaveLength(2);
    expect(imports[0].parsedFlights[0].flightNumber).toBe('AM 19');
    expect(imports[1].parsedFlights[0].flightNumber).toBe('VB 1014');
  });
  it('keeps all passengers per leg', () => {
    const [am19] = buildFlightImportsFromGrid(CSV, 'grid.csv', personnel);
    expect(am19.parsedFlights[0].passengers).toHaveLength(2);
  });
  it('matches roster names and flags the rest as unmatched', () => {
    const [am19] = buildFlightImportsFromGrid(CSV, 'grid.csv', personnel);
    const elsa = am19.parsedFlights[0].passengers.find((p) => p.name === 'Elsa Carvajal');
    const julian = am19.parsedFlights[0].passengers.find((p) => p.name === 'Julian Bernal');
    expect(elsa?.matchedTourPersonId).toBe('tp_elsa');
    expect(julian?.matchedTourPersonId).toBeUndefined();
    expect(am19.unmatchedNames).toEqual(['Julian Bernal']);
  });
});
