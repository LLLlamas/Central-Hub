// Timezone-delta helpers — pure, Intl-only (no date-fns-tz dependency).
// Offsets are computed per-instant (not a static UTC-offset table) so DST
// transitions resolve correctly for whichever date a leg actually falls on.

import { normalizeName } from '@/lib/format';

/** Minutes east of UTC for `tz` at the instant `atIso` names. Works by
 *  rendering that instant's wall-clock time in `tz`, then diffing against
 *  the same instant's UTC millis — the standard Intl offset trick. */
export function getTimezoneOffsetMinutes(tz: string, atIso: string): number {
  const date = new Date(atIso);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfUtc - date.getTime()) / 60000);
}

/** "+2h" / "−3h" / "+5h30m" — empty string when both tz's agree at this instant. */
export function formatTimezoneDelta(fromTz: string, toTz: string, atIso: string): string {
  if (!fromTz || !toTz || fromTz === toTz) return '';
  const diff = getTimezoneOffsetMinutes(toTz, atIso) - getTimezoneOffsetMinutes(fromTz, atIso);
  if (diff === 0) return '';
  const sign = diff > 0 ? '+' : '−';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h${m}m`;
}

// City/airport → IANA timezone, for surfaces (Travel records) that only
// carry a free-text city or IATA code, not a venueId to resolve via
// `getVenueForTour`. Keys are matched case/accent-insensitively via
// `normalizeName`; IATA codes are matched as-is (uppercase 3-letter).
const CITY_TIMEZONES: Record<string, string> = {
  'mexico city': 'America/Mexico_City',
  'ciudad de mexico': 'America/Mexico_City',
  monterrey: 'America/Monterrey',
  guadalajara: 'America/Mexico_City',
  'los angeles': 'America/Los_Angeles',
  oakland: 'America/Los_Angeles',
};

const AIRPORT_TIMEZONES: Record<string, string> = {
  MEX: 'America/Mexico_City',
  MTY: 'America/Monterrey',
  GDL: 'America/Mexico_City',
  LAX: 'America/Los_Angeles',
  OAK: 'America/Los_Angeles',
  SFO: 'America/Los_Angeles',
  JFK: 'America/New_York',
};

/** Best-effort city/IATA → IANA timezone lookup for a `Travel.from`/`.to`
 *  string. Strips a trailing ", ST"/", Country" suffix before matching a
 *  bare city name. Returns undefined for anything unrecognized — callers
 *  should hide the delta badge rather than guess. */
export function resolveCityTimezone(place?: string): string | undefined {
  if (!place) return undefined;
  const trimmed = place.trim();
  if (/^[A-Z]{3}$/.test(trimmed)) return AIRPORT_TIMEZONES[trimmed];
  const bareCity = trimmed.split(',')[0];
  return CITY_TIMEZONES[normalizeName(bareCity)];
}
