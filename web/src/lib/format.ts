import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { DayType, ScheduleItemType, TravelMode } from '@/types';

export function fmtDate(d: string, pattern = 'MMM d'): string {
  return format(parseISO(d), pattern);
}
export function fmtFullDate(d: string): string {
  return format(parseISO(d), 'EEE, MMM d, yyyy');
}
export function fmtDow(d: string): string {
  return format(parseISO(d), 'EEE');
}
export function fmtDayNum(d: string): string {
  return format(parseISO(d), 'd');
}
export function fmtMonth(d: string): string {
  return format(parseISO(d), 'MMM');
}
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

export function dayTypeLabel(t: DayType): string {
  switch (t) {
    case 'show':
      return 'Show';
    case 'off':
      return 'Day Off';
    case 'travel':
      return 'Travel';
    case 'rehearsal':
      return 'Rehearsal';
    case 'promo':
      return 'Promo';
    case 'hold':
      return 'Hold';
  }
}

export function dayTypeColor(t: DayType): string {
  switch (t) {
    case 'show':
      return 'var(--color-day-show)';
    case 'off':
      return 'var(--color-day-off)';
    case 'travel':
      return 'var(--color-day-travel)';
    case 'rehearsal':
      return 'var(--color-day-rehearsal)';
    case 'promo':
      return 'var(--color-day-promo)';
    case 'hold':
      return 'var(--color-day-hold)';
  }
}

export function scheduleItemLabel(t: ScheduleItemType): string {
  return (
    {
      load_in: 'Load-In',
      soundcheck: 'Soundcheck',
      doors: 'Doors',
      set: 'Set',
      changeover: 'Changeover',
      curfew: 'Curfew',
      load_out: 'Load-Out',
      bus_call: 'Bus Call',
      lobby_call: 'Lobby Call',
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      press: 'Press',
      meet_greet: 'Meet & Greet',
      rehearsal: 'Rehearsal',
      other: 'Other',
    } as const
  )[t];
}

export function travelModeLabel(m: TravelMode): string {
  return (
    {
      flight: 'Flight',
      drive: 'Drive',
      bus: 'Bus',
      train: 'Train',
      ferry: 'Ferry',
    } as const
  )[m];
}

export function travelModeIcon(m: TravelMode): string {
  return (
    {
      flight: '✈',
      drive: '⌒',
      bus: '◫',
      train: '═',
      ferry: '◐',
    } as const
  )[m];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export function shortTime(t?: string): string {
  if (!t) return '';
  return t; // 24h "16:00" already short
}
