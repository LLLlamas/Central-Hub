import { describe, it, expect } from 'vitest';
import { buildTourSeed, suggestTourName, type TmEvent } from '@/lib/ticketmaster';

const ev = (over: Partial<TmEvent>): TmEvent => ({
  name: 'Phish',
  localDate: '2026-08-10',
  localTime: '19:00',
  venueName: 'Red Rocks Amphitheatre',
  address: '18300 W Alameda Pkwy',
  city: 'Morrison',
  state: 'CO',
  country: 'US',
  timezone: 'America/Denver',
  ...over,
});

describe('buildTourSeed', () => {
  it('maps events to sorted unique show days with one leg spanning the run', () => {
    const seed = buildTourSeed('Phish', [
      ev({ localDate: '2026-09-01', city: 'Austin', state: 'TX', venueName: 'Moody Center' }),
      ev({ localDate: '2026-08-10' }),
      ev({ localDate: '2026-08-14', city: 'Chicago', state: 'IL', venueName: 'United Center' }),
    ]);

    expect(seed.days.map((d) => d.date)).toEqual(['2026-08-10', '2026-08-14', '2026-09-01']);
    expect(seed.days.every((d) => d.dayType === 'show' && !d.published)).toBe(true);
    expect(seed.days[0]).toMatchObject({
      id: 'day_2026-08-10',
      city: 'Morrison, CO',
      country: 'US',
      venueId: 'v_red_rocks_amphitheatre',
      legId: 'leg_tm',
    });
    expect(seed.startDate).toBe('2026-08-10');
    expect(seed.endDate).toBe('2026-09-01');
    expect(seed.legs).toEqual([
      { id: 'leg_tm', name: 'Phish Tour', startDate: '2026-08-10', endDate: '2026-09-01' },
    ]);
    expect(seed.suggestedName).toBe('Phish — 2026 Tour');
  });

  it('collapses duplicate same-day events to one day (first wins)', () => {
    const seed = buildTourSeed('Phish', [
      ev({ localDate: '2026-08-10', venueName: 'Venue A' }),
      ev({ localDate: '2026-08-10', venueName: 'Venue B' }),
    ]);
    expect(seed.days).toHaveLength(1);
    expect(seed.days[0].venueId).toBe('v_venue_a');
    expect(Object.keys(seed.venues)).toEqual(['v_venue_a']);
  });

  it('tolerates missing venue/time/city fields', () => {
    const seed = buildTourSeed('Phish', [
      ev({
        localDate: '2026-08-10',
        localTime: undefined,
        venueName: undefined,
        address: undefined,
        city: undefined,
        state: undefined,
        country: undefined,
        timezone: undefined,
      }),
    ]);
    expect(seed.days[0]).toMatchObject({ date: '2026-08-10', dayType: 'show' });
    expect(seed.days[0].venueId).toBeUndefined();
    expect(seed.days[0].city).toBeUndefined();
    expect(seed.scheduleItems).toEqual([]);
    expect(seed.venues).toEqual({});
  });

  it('threads venue timezone into the per-tour venue override', () => {
    const seed = buildTourSeed('Phish', [ev({})]);
    expect(seed.venues['v_red_rocks_amphitheatre']).toMatchObject({
      name: 'Red Rocks Amphitheatre',
      city: 'Morrison, CO',
      country: 'US',
      timezone: 'America/Denver',
    });
  });

  it('emits a set schedule item when the event has a local time', () => {
    const seed = buildTourSeed('Phish', [ev({ localTime: '20:30' })]);
    expect(seed.scheduleItems).toHaveLength(1);
    expect(seed.scheduleItems[0]).toMatchObject({
      dayId: 'day_2026-08-10',
      type: 'set',
      startTime: '20:30',
      location: 'Red Rocks Amphitheatre',
    });
  });

  it('handles zero events with an empty seed', () => {
    const seed = buildTourSeed('Phish', []);
    expect(seed.days).toEqual([]);
    expect(seed.legs).toEqual([]);
    expect(seed.suggestedName).toBe('Phish Tour');
  });
});

describe('suggestTourName', () => {
  it('spans years when the run crosses a year boundary', () => {
    expect(suggestTourName('Phish', '2026-12-30', '2027-01-04')).toBe('Phish — 2026–2027 Tour');
  });
});
