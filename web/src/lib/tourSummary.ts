// Pure derivation helpers for TourSummary — the "My Tours" multi-tour switcher.
// No storage I/O, no React. Callers pass in `todayIso` / `updatedAt` explicitly
// so this stays testable and never reaches for `new Date()` itself.

import type { Day, ISODate, ISODateTime, Tour, TourSummary, TourSummaryStatus } from '@/types';
import { getTodayIso } from '@/lib/today';

// Plain-English label per status — single source of truth shared by every
// "My Tours" surface (list cards, map legend) so a copy change can't drift
// between them.
export const TOUR_STATUS_LABEL: Record<TourSummaryStatus, string> = {
  draft: 'Draft',
  upcoming: 'Upcoming',
  on_tour: 'On tour',
  completed: 'Completed',
};

function minMaxDates(days: Pick<Day, 'date'>[]): { minDate: ISODate; maxDate: ISODate } | null {
  if (days.length === 0) return null;
  return days.reduce(
    (acc, d) => ({
      minDate: d.date < acc.minDate ? d.date : acc.minDate,
      maxDate: d.date > acc.maxDate ? d.date : acc.maxDate,
    }),
    { minDate: days[0].date, maxDate: days[0].date }
  );
}

export function deriveTourStatus(tour: Pick<Tour, 'days'>, todayIso: string): TourSummaryStatus {
  if (tour.days.length === 0) return 'draft';
  const range = minMaxDates(tour.days);
  if (!range) return 'draft';
  const { minDate, maxDate } = range;
  if (todayIso < minDate) return 'upcoming';
  if (todayIso > maxDate) return 'completed';
  return 'on_tour';
}

export function summarizeTour(tour: Tour, updatedAt: ISODateTime): TourSummary {
  const range = minMaxDates(tour.days);
  const showDays = tour.days.filter((d) => d.dayType === 'show');
  const primaryCity = showDays[0]?.city ?? tour.days[0]?.city ?? null;

  return {
    id: tour.id,
    name: tour.name,
    artistName: tour.artistName ?? '',
    status: deriveTourStatus(tour, getTodayIso()),
    startDate: range?.minDate ?? null,
    endDate: range?.maxDate ?? null,
    dayCount: tour.days.length,
    showCount: showDays.length,
    primaryCity,
    updatedAt,
  };
}
