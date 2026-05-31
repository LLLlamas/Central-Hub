import { describe, it, expect } from 'vitest';
import { matchFixture, fixturesOfKind, nonMatchNote, FIXTURES } from '@/lib/fixtureMatcher';

describe('matchFixture', () => {
  it('matches a known fixture by exact filename', () => {
    expect(matchFixture('AM19_Group_LAX-MEX_2026-09-22.pdf')?.kind).toBe('flight');
    expect(matchFixture('mock-tour-route-mexico-7day.csv')?.kind).toBe('route');
  });

  it('is case-insensitive', () => {
    expect(matchFixture('am19_group_lax-mex_2026-09-22.PDF')?.id).toBe('flight_am19');
  });

  it("tolerates the browser's duplicate-download suffix", () => {
    expect(matchFixture('AM19_Group_LAX-MEX_2026-09-22 (1).pdf')?.id).toBe('flight_am19');
    expect(matchFixture('mock-tour-route-mexico-7day (2).csv')?.kind).toBe('route');
  });

  it('returns null for an unknown file', () => {
    expect(matchFixture('some-random-document.pdf')).toBeNull();
    expect(matchFixture('')).toBeNull();
  });
});

describe('fixturesOfKind', () => {
  it('returns only fixtures of the requested kind', () => {
    const flights = fixturesOfKind('flight');
    expect(flights.length).toBeGreaterThan(0);
    expect(flights.every((f) => f.kind === 'flight')).toBe(true);
  });

  it('every registered fixture carries an extracts blurb', () => {
    expect(FIXTURES.every((f) => f.extracts.length > 0)).toBe(true);
  });
});

describe('nonMatchNote', () => {
  const file = (name: string) => ({ name }) as File;

  it('flags a known fixture meant for another step', () => {
    const route = fixturesOfKind('route')[0];
    const note = nonMatchNote(file('x.csv'), route, 'a flight PDF', 'sample.pdf');
    expect(note.tone).toBe('warning');
    expect(note.title).toBe('That file belongs to another step');
    expect(note.detail).toContain('route file');
    expect(note.detail).toContain('a flight PDF');
  });

  it('flags an unrecognized file and suggests the sample', () => {
    const note = nonMatchNote(file('random.pdf'), null, 'a CSV', 'sample.csv');
    expect(note.title).toBe('Sample only');
    expect(note.detail).toContain('sample.csv');
  });
});
