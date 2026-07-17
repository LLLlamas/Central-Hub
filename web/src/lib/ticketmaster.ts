// Ticketmaster Discovery API v2 — artist search + upcoming-event fetch for
// the "+ New tour" seeded-tour flow, plus the PURE mapping from those events
// to the tour-seeding shape (days/legs/venue overrides). Fetch wrappers and
// mapping are deliberately separate so the mapping is testable offline.

import type { Day, Leg, ScheduleItem, Venue } from '@/types';
import { defaultVisibilityForType } from '@/lib/visibilityDefaults';

const BASE = 'https://app.ticketmaster.com/discovery/v2';

export function getTicketmasterApiKey(): string | undefined {
  const key = import.meta.env.VITE_TICKETMASTER_API_KEY as string | undefined;
  return key?.trim() ? key.trim() : undefined;
}

// ---------- narrow typed shapes (not raw API blobs) ----------

export interface TmAttraction {
  id: string;
  name: string;
  imageUrl?: string;
  upcomingEventCount?: number;
}

export interface TmEvent {
  name: string;
  localDate: string; // YYYY-MM-DD
  localTime?: string; // HH:MM
  venueName?: string;
  address?: string;
  city?: string;
  state?: string; // stateCode, e.g. "TX"
  country?: string; // countryCode, e.g. "US"
  timezone?: string; // IANA, e.g. "America/New_York"
}

// ---------- fetch wrappers ----------

async function tmGet(path: string, params: Record<string, string>): Promise<unknown> {
  const key = getTicketmasterApiKey();
  if (!key) throw new Error('No Ticketmaster API key configured (VITE_TICKETMASTER_API_KEY).');
  const qs = new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`Ticketmaster request failed (${res.status})`);
  return res.json();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function searchAttractions(keyword: string): Promise<TmAttraction[]> {
  const data = (await tmGet('/attractions.json', { keyword, size: '8' })) as any;
  const rows: any[] = data?._embedded?.attractions ?? [];
  return rows.map((a) => ({
    id: String(a.id),
    name: String(a.name ?? ''),
    // Smallest 16:9 rendition is plenty for a list thumbnail.
    imageUrl: pickThumb(a.images),
    upcomingEventCount: a.upcomingEvents?._total,
  }));
}

export async function fetchAttractionEvents(attractionId: string): Promise<TmEvent[]> {
  const data = (await tmGet('/events.json', {
    attractionId,
    sort: 'date,asc',
    size: '100',
  })) as any;
  const rows: any[] = data?._embedded?.events ?? [];
  return rows
    .map((e) => {
      const v = e?._embedded?.venues?.[0];
      return {
        name: String(e?.name ?? ''),
        localDate: String(e?.dates?.start?.localDate ?? ''),
        localTime: trimTime(e?.dates?.start?.localTime),
        venueName: v?.name || undefined,
        address: v?.address?.line1 || undefined,
        city: v?.city?.name || undefined,
        state: v?.state?.stateCode || undefined,
        country: v?.country?.countryCode || undefined,
        timezone: v?.timezone || e?.dates?.timezone || undefined,
      } satisfies TmEvent;
    })
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.localDate));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function pickThumb(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const rated = images.filter((i) => typeof i?.url === 'string' && typeof i?.width === 'number');
  rated.sort((a, b) => a.width - b.width);
  return (rated.find((i) => i.width >= 100) ?? rated[0])?.url;
}

// "19:00:00" -> "19:00"
function trimTime(t: unknown): string | undefined {
  if (typeof t !== 'string') return undefined;
  const m = t.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : undefined;
}

// ---------- pure mapping: events -> tour seed ----------

export interface TourSeed {
  suggestedName: string;
  artistName: string;
  startDate: string;
  endDate: string;
  days: Day[];
  legs: Leg[];
  scheduleItems: ScheduleItem[];
  venues: Record<string, Venue>;
}

function slugVenueId(name: string): string {
  return 'v_' + name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function cityLabel(e: TmEvent): string | undefined {
  if (!e.city) return undefined;
  return e.state ? `${e.city}, ${e.state}` : e.city;
}

/** Map an artist's upcoming events to the tour-seeding shape: one show day per
 *  unique date (first event wins on a same-day duplicate), one leg spanning
 *  the run, per-tour venue overrides carrying the Ticketmaster timezone, and
 *  a `set` schedule item when the event has a local start time. Off/travel
 *  days between shows are deliberately not fabricated. */
export function buildTourSeed(artistName: string, events: TmEvent[]): TourSeed {
  const byDate = new Map<string, TmEvent>();
  for (const e of [...events].sort((a, b) => a.localDate.localeCompare(b.localDate))) {
    if (!byDate.has(e.localDate)) byDate.set(e.localDate, e);
  }

  const days: Day[] = [];
  const scheduleItems: ScheduleItem[] = [];
  const venues: Record<string, Venue> = {};

  for (const [date, e] of byDate) {
    const venueId = e.venueName ? slugVenueId(e.venueName) : undefined;
    const day: Day = {
      id: `day_${date}`,
      date,
      legId: 'leg_tm',
      dayType: 'show',
      city: cityLabel(e),
      country: e.country,
      venueId,
      published: false,
    };
    days.push(day);

    if (venueId && e.venueName && !venues[venueId]) {
      venues[venueId] = {
        name: e.venueName,
        address: e.address ?? '',
        city: cityLabel(e) ?? '',
        country: e.country ?? '',
        timezone: e.timezone,
      };
    }

    if (e.localTime) {
      scheduleItems.push({
        id: `si_${date}_set_0`,
        dayId: day.id,
        type: 'set',
        title: 'Headline set',
        startTime: e.localTime,
        location: e.venueName,
        visibility: defaultVisibilityForType('set'),
      });
    }
  }

  const startDate = days[0]?.date ?? '';
  const endDate = days[days.length - 1]?.date ?? '';
  const legs: Leg[] =
    days.length > 0
      ? [{ id: 'leg_tm', name: `${artistName} Tour`, startDate, endDate }]
      : [];

  return {
    suggestedName: suggestTourName(artistName, startDate, endDate),
    artistName,
    startDate,
    endDate,
    days,
    legs,
    scheduleItems,
    venues,
  };
}

/** "{Artist} — {year} Tour", or "{y1}–{y2}" when the run crosses a year. */
export function suggestTourName(artistName: string, startDate: string, endDate: string): string {
  const y1 = startDate.slice(0, 4);
  const y2 = endDate.slice(0, 4);
  if (!y1) return `${artistName} Tour`;
  return `${artistName} — ${y1 === y2 ? y1 : `${y1}–${y2}`} Tour`;
}
