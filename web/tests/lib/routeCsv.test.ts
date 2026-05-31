import { describe, it, expect } from 'vitest';
import { parseRouteCsv } from '@/lib/routeCsv';

// Mirrors web/public/mock-tour-route-mexico-7day.csv â€” the rehearsal/show rows
// carry quoted addresses containing commas, which the parser must respect.
const CSV = `date,leg,day_type,city,country,venue,venue_address,capacity,guarantee_usd,doors_local,set_time_local,curfew_local,promoter,promoter_rep,notes
2026-09-22,leg_mx,travel,LAX â†’ CDMX,MX,,,,,,,,,,Tour kickoff. Group flight AM 19.
2026-09-23,leg_mx,rehearsal,Mexico City,MX,Foro Indie Rocks (rented),"Calle Zacatecas 39, Roma Norte, 06700 CDMX",,,,,,Self,,Production rehearsal.
2026-09-24,leg_mx,rehearsal,Mexico City,MX,Foro Indie Rocks (rented),"Calle Zacatecas 39, Roma Norte, 06700 CDMX",,,,,,Self,,Production rehearsal.
2026-09-25,leg_mx,show,Mexico City,MX,Auditorio Nacional,"Paseo de la Reforma 50, Bosque de Chapultepec I Secc, 11580 CDMX",9683,65000,20:00,21:30,23:30,OCESA,Pablo Espinosa,Tier A.
2026-09-26,leg_mx,off,Mexico City,MX,,,,,,,,,,Day off.
2026-09-27,leg_mx,travel,CDMX â†’ MTY,MX,,,,,,,,,,VivaAerobus VB 1014.
2026-09-28,leg_mx,show,Monterrey,MX,Auditorio Banamex,"Av. Fundadores S/N, La Estanzuela, 64988 Monterrey",8500,45000,20:00,21:30,23:30,OCESA,Pablo Espinosa,`;

describe('parseRouteCsv', () => {
  const route = parseRouteCsv(CSV);

  it('produces one day per data row', () => {
    expect(route.days).toHaveLength(7);
  });

  it('reads each day type in order', () => {
    expect(route.days.map((d) => d.dayType)).toEqual([
      'travel',
      'rehearsal',
      'rehearsal',
      'show',
      'off',
      'travel',
      'show',
    ]);
  });

  it('sets tour start/end from the date span', () => {
    expect(route.startDate).toBe('2026-09-22');
    expect(route.endDate).toBe('2026-09-28');
  });

  it('builds one leg covering the routed dates', () => {
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0].id).toBe('leg_mx');
    expect(route.legs[0].name).toBe('Mexico Leg');
    expect(route.legs[0].startDate).toBe('2026-09-22');
    expect(route.legs[0].endDate).toBe('2026-09-28');
  });

  it('handles quoted address fields with embedded commas', () => {
    const rehearsal = route.days.find((d) => d.date === '2026-09-23');
    expect(rehearsal?.city).toBe('Mexico City');
    expect(rehearsal?.notes).toBe('Production rehearsal.');
  });

  it('attaches a slugged venueId to show days only', () => {
    expect(route.days.find((d) => d.date === '2026-09-25')?.venueId).toBe('v_auditorio_nacional');
    expect(route.days.find((d) => d.date === '2026-09-28')?.venueId).toBe('v_auditorio_banamex');
    expect(route.days.find((d) => d.date === '2026-09-23')?.venueId).toBeUndefined();
  });

  it('seeds a schedule skeleton for every day type', () => {
    const countFor = (date: string) =>
      route.scheduleItems.filter((s) => s.dayId === `day_${date}`).length;
    expect(countFor('2026-09-22')).toBe(3); // travel
    expect(countFor('2026-09-23')).toBe(5); // rehearsal
    expect(countFor('2026-09-25')).toBe(9); // show
    expect(countFor('2026-09-26')).toBe(2); // off
    expect(route.scheduleItems).toHaveLength(36);
  });

  it('builds a full show-day skeleton', () => {
    const cdmx = route.scheduleItems.filter((s) => s.dayId === 'day_2026-09-25');
    expect(cdmx.map((s) => s.type).sort()).toEqual(
      [
        'bus_call', 'curfew', 'dinner', 'doors', 'load_in',
        'load_out', 'lunch', 'set', 'soundcheck',
      ].sort(),
    );
  });

  it('assigns a unique id to every schedule item', () => {
    const ids = route.scheduleItems.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts soundcheck exactly 6 hours after load-in (rider Â§10 minimum)', () => {
    const cdmx = route.scheduleItems.filter((s) => s.dayId === 'day_2026-09-25');
    const loadIn = cdmx.find((s) => s.type === 'load_in');
    const soundcheck = cdmx.find((s) => s.type === 'soundcheck');
    expect(loadIn?.startTime).toBe('09:00');
    expect(soundcheck?.startTime).toBe('15:00');
  });

  it('carries doors/set/curfew times from the CSV', () => {
    const cdmx = route.scheduleItems.filter((s) => s.dayId === 'day_2026-09-25');
    expect(cdmx.find((s) => s.type === 'doors')?.startTime).toBe('20:00');
    expect(cdmx.find((s) => s.type === 'set')?.startTime).toBe('21:30');
    expect(cdmx.find((s) => s.type === 'curfew')?.startTime).toBe('23:30');
  });

  it('returns an empty route for an empty or header-only CSV', () => {
    expect(parseRouteCsv('').days).toEqual([]);
    expect(parseRouteCsv('date,leg,day_type\n').days).toEqual([]);
  });
});
