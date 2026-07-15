import { describe, it, expect } from 'vitest';
import { deriveTourStatus, summarizeTour } from '@/lib/tourSummary';
import { createScratchTour } from '@/data/scratchTour';
import type { Day, Tour } from '@/types';

function makeDay(id: string, date: string, dayType: Day['dayType'], city?: string): Day {
  return { id, date, dayType, city, published: false };
}

function makeTour(days: Day[]): Tour {
  const t = createScratchTour('tour_test-1');
  t.days = days;
  return t;
}

describe('deriveTourStatus', () => {
  it('is draft when there are no days', () => {
    expect(deriveTourStatus({ days: [] }, '2026-09-24')).toBe('draft');
  });

  it('is upcoming when today is before every day', () => {
    const days = [makeDay('d1', '2026-09-22', 'travel'), makeDay('d2', '2026-09-28', 'show')];
    expect(deriveTourStatus({ days }, '2026-09-01')).toBe('upcoming');
  });

  it('is on_tour when today falls within the range', () => {
    const days = [makeDay('d1', '2026-09-22', 'travel'), makeDay('d2', '2026-09-28', 'show')];
    expect(deriveTourStatus({ days }, '2026-09-25')).toBe('on_tour');
  });

  it('is completed when today is after every day', () => {
    const days = [makeDay('d1', '2026-09-22', 'travel'), makeDay('d2', '2026-09-28', 'show')];
    expect(deriveTourStatus({ days }, '2026-10-01')).toBe('completed');
  });

  it('does not assume days are sorted chronologically', () => {
    const days = [
      makeDay('d1', '2026-09-28', 'show'),
      makeDay('d2', '2026-09-22', 'travel'),
      makeDay('d3', '2026-09-25', 'show'),
    ];
    expect(deriveTourStatus({ days }, '2026-09-24')).toBe('on_tour');
    expect(deriveTourStatus({ days }, '2026-09-01')).toBe('upcoming');
    expect(deriveTourStatus({ days }, '2026-10-01')).toBe('completed');
  });

  it('handles a single-day tour without crashing', () => {
    const days = [makeDay('d1', '2026-09-25', 'show')];
    expect(deriveTourStatus({ days }, '2026-09-25')).toBe('on_tour');
    expect(deriveTourStatus({ days }, '2026-09-01')).toBe('upcoming');
    expect(deriveTourStatus({ days }, '2026-10-01')).toBe('completed');
  });
});

describe('summarizeTour', () => {
  it('summarizes an empty scratch tour without crashing', () => {
    const tour = makeTour([]);
    const summary = summarizeTour(tour, '2026-07-14T12:00');
    expect(summary.status).toBe('draft');
    expect(summary.dayCount).toBe(0);
    expect(summary.showCount).toBe(0);
    expect(summary.startDate).toBeNull();
    expect(summary.endDate).toBeNull();
    expect(summary.primaryCity).toBeNull();
    expect(summary.updatedAt).toBe('2026-07-14T12:00');
    expect(summary.id).toBe(tour.id);
    expect(summary.name).toBe(tour.name);
  });

  it('picks min/max dates, counts shows, and prefers show-day city', () => {
    const days = [
      makeDay('d1', '2026-09-28', 'show', 'Monterrey'),
      makeDay('d2', '2026-09-22', 'travel', 'Mexico City'),
      makeDay('d3', '2026-09-25', 'show', 'Guadalajara'),
    ];
    const tour = makeTour(days);
    tour.artistName = 'Test Artist';
    const summary = summarizeTour(tour, '2026-07-14T12:00');
    expect(summary.startDate).toBe('2026-09-22');
    expect(summary.endDate).toBe('2026-09-28');
    expect(summary.dayCount).toBe(3);
    expect(summary.showCount).toBe(2);
    // primaryCity is the first show day in array order (not date-sorted) — d1 is Monterrey
    expect(summary.primaryCity).toBe('Monterrey');
    expect(summary.artistName).toBe('Test Artist');
    expect(summary.status).toBe('upcoming');
  });

  it('falls back to the first day city when there are no show days', () => {
    const days = [makeDay('d1', '2026-09-22', 'travel', 'Mexico City')];
    const tour = makeTour(days);
    const summary = summarizeTour(tour, '2026-07-14T12:00');
    expect(summary.primaryCity).toBe('Mexico City');
  });

  it('handles a single-day tour without crashing', () => {
    const tour = makeTour([makeDay('d1', '2026-09-25', 'show', 'CDMX')]);
    const summary = summarizeTour(tour, '2026-07-14T12:00');
    expect(summary.dayCount).toBe(1);
    expect(summary.showCount).toBe(1);
    expect(summary.startDate).toBe('2026-09-25');
    expect(summary.endDate).toBe('2026-09-25');
  });
});
