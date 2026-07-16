import { describe, it, expect } from 'vitest';
import { getTimezoneOffsetMinutes, formatTimezoneDelta, resolveCityTimezone } from '@/lib/timezone';

describe('getTimezoneOffsetMinutes', () => {
  it('returns 0 for UTC', () => {
    expect(getTimezoneOffsetMinutes('UTC', '2026-07-15T12:00:00')).toBe(0);
  });

  it('returns a negative offset for a western tz', () => {
    expect(getTimezoneOffsetMinutes('America/Los_Angeles', '2026-01-15T12:00:00')).toBe(-8 * 60);
  });
});

describe('formatTimezoneDelta', () => {
  it('is empty for the same timezone', () => {
    expect(formatTimezoneDelta('America/Mexico_City', 'America/Mexico_City', '2026-09-22T12:00:00')).toBe('');
  });

  it('is empty when both tz agree at this instant even if named differently', () => {
    expect(formatTimezoneDelta('America/Mexico_City', 'America/Monterrey', '2026-09-22T12:00:00')).toBe('');
  });

  it('formats a positive delta (destination ahead)', () => {
    expect(formatTimezoneDelta('America/Los_Angeles', 'America/New_York', '2026-01-15T12:00:00')).toBe('+3h');
  });

  it('formats a negative delta (destination behind)', () => {
    expect(formatTimezoneDelta('America/New_York', 'America/Los_Angeles', '2026-01-15T12:00:00')).toBe('−3h');
  });

  it('resolves the per-instant DST offset, not a static table', () => {
    // Arizona never observes DST; LA does. In January both are PST/MST (-8/-7): -1h.
    // In July LA is on PDT (-7), matching Phoenix's MST (-7): no delta.
    const winter = formatTimezoneDelta('America/Los_Angeles', 'America/Phoenix', '2026-01-15T12:00:00');
    const summer = formatTimezoneDelta('America/Los_Angeles', 'America/Phoenix', '2026-07-15T12:00:00');
    expect(winter).toBe('+1h');
    expect(summer).toBe('');
  });
});

describe('resolveCityTimezone', () => {
  it('resolves an IATA airport code', () => {
    expect(resolveCityTimezone('LAX')).toBe('America/Los_Angeles');
    expect(resolveCityTimezone('MEX')).toBe('America/Mexico_City');
  });

  it('resolves a bare city name, accent/case-insensitively', () => {
    expect(resolveCityTimezone('Monterrey')).toBe('America/Monterrey');
    expect(resolveCityTimezone('ciudad de méxico')).toBe('America/Mexico_City');
  });

  it('strips a trailing state/country suffix before matching', () => {
    expect(resolveCityTimezone('Los Angeles, CA')).toBe('America/Los_Angeles');
  });

  it('returns undefined for an unrecognized place', () => {
    expect(resolveCityTimezone('Nowhereville')).toBeUndefined();
    expect(resolveCityTimezone(undefined)).toBeUndefined();
  });
});
