// Parser for the booking-agent tour-route CSV.
//
// In scratch mode the user uploads a routing spreadsheet (the kind a booking
// agent sends with a deal memo). This turns its rows into the tour skeleton:
// legs, days, and a show-day schedule skeleton so the schedule/visibility
// surfaces have something to work with.

import type { Day, DayType, Leg, ScheduleItem } from '@/types';
import { vis } from '@/lib/visibility';
import { defaultVisibilityForType } from '@/lib/visibilityDefaults';

export interface ParsedRoute {
  legs: Leg[];
  days: Day[];
  scheduleItems: ScheduleItem[];
  startDate: string;
  endDate: string;
}

const DAY_TYPES: DayType[] = ['show', 'off', 'travel', 'rehearsal', 'promo', 'hold'];

// Country code → leg name fragment, for naming legs from their `leg_xx` id.
const LEG_REGION: Record<string, string> = {
  mx: 'Mexico',
  us: 'USA',
  sa: 'South America',
  co: 'Colombia',
  pe: 'Peru',
  cl: 'Chile',
  ar: 'Argentina',
};

// Split one CSV line, honoring double-quoted fields (addresses contain commas).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function slugVenueId(name: string): string {
  return 'v_' + name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function legName(legId: string): string {
  const code = legId.replace(/^leg_/, '').toLowerCase();
  return `${LEG_REGION[code] ?? code.toUpperCase()} Leg`;
}

// addMinutes('09:00', 360) -> '15:00'
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Load-in / soundcheck defaults. Soundcheck is load-in + 6h, the rider §10
// minimum — the LobbyCallLadder checks this exact gap.
const LOAD_IN = '09:00';
const SOUNDCHECK = addMinutes(LOAD_IN, 360);
const CREW_GROUPS = ['grp_production', 'grp_audio', 'grp_lighting', 'grp_video'];

interface RouteRow {
  city: string;
  venue: string;
  doors_local: string;
  set_time_local: string;
  curfew_local: string;
}

// Build a mock schedule skeleton for one day, shaped by its day type. Times
// are mock — a realistic shape so the schedule/day surfaces have something to
// show before the TM fills in the real plan.
function daySchedule(day: Day, row: RouteRow): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const mk = (
    type: ScheduleItem['type'],
    title: string,
    startTime: string,
    extra: Partial<ScheduleItem> = {},
  ): void => {
    items.push({
      id: `si_${day.date}_${type}_${items.length}`,
      dayId: day.id,
      type,
      title,
      startTime,
      visibility: defaultVisibilityForType(type),
      ...extra,
    });
  };

  if (day.dayType === 'show') {
    const venueDoor = row.venue ? `${row.venue} · Stage door` : undefined;
    const venueStage = row.venue ? `${row.venue} · Stage` : undefined;
    mk('bus_call', 'Bus call (hotel lobby)', '08:30');
    mk('load_in', 'Crew load-in', LOAD_IN, {
      endTime: '12:00',
      location: venueDoor,
      visibility: vis.onlyGroups(CREW_GROUPS, 'sees'),
    });
    mk('lunch', 'Crew lunch', '12:30', { visibility: vis.onlyGroups(CREW_GROUPS, 'sees') });
    mk('soundcheck', 'Soundcheck — closed door (6h min from load-in)', SOUNDCHECK, {
      location: venueStage,
      notes: 'Closed door per rider §10',
    });
    mk('dinner', 'Band dinner', '18:00');
    if (row.doors_local) mk('doors', 'Doors', row.doors_local, { location: venueStage });
    if (row.set_time_local) mk('set', 'Headline set', row.set_time_local, { location: venueStage });
    if (row.curfew_local) mk('curfew', 'Curfew', row.curfew_local);
    mk('load_out', 'Load-out', row.curfew_local ? addMinutes(row.curfew_local, 15) : '23:45', {
      location: venueDoor,
      visibility: vis.onlyGroups(CREW_GROUPS, 'sees'),
    });
  } else if (day.dayType === 'rehearsal') {
    const venue = row.venue || undefined;
    mk('lobby_call', 'Lobby call', '10:00');
    mk('rehearsal', 'Production rehearsal — load in & line check', '11:00', {
      endTime: '13:00',
      location: venue,
    });
    mk('lunch', 'Lunch break', '13:00');
    mk('rehearsal', 'Full set run-through', '14:00', { endTime: '18:00', location: venue });
    mk('dinner', 'Group dinner', '19:00');
  } else if (day.dayType === 'travel') {
    mk('lobby_call', 'Hotel checkout & lobby call', '09:00');
    mk('bus_call', 'Bus to airport', '09:30');
    const dest = row.city.split(/→|->/).pop()?.trim();
    mk('other', dest ? `Hotel check-in — ${dest}` : 'Hotel check-in', '17:00', {
      notes: 'Time approximate — confirm against flight arrival.',
    });
  } else if (day.dayType === 'off') {
    mk('breakfast', 'Hotel breakfast', '09:00', { endTime: '11:00' });
    mk('dinner', 'Optional group dinner', '20:00');
  } else if (day.dayType === 'promo') {
    mk('lobby_call', 'Lobby call', '10:00');
    mk('press', 'Press & promo block', '11:00', { endTime: '16:00' });
    mk('dinner', 'Group dinner', '19:00');
  }
  // 'hold' days intentionally get no skeleton.

  return items;
}

/** Parse a tour-route CSV into legs, days and a show-day schedule skeleton. */
export function parseRouteCsv(text: string): ParsedRoute {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { legs: [], days: [], scheduleItems: [], startDate: '', endDate: '' };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const col = {
    date: idx('date'),
    leg: idx('leg'),
    dayType: idx('day_type'),
    city: idx('city'),
    country: idx('country'),
    venue: idx('venue'),
    doors: idx('doors_local'),
    set: idx('set_time_local'),
    curfew: idx('curfew_local'),
    notes: idx('notes'),
  };

  const days: Day[] = [];
  const scheduleItems: ScheduleItem[] = [];
  const legBounds = new Map<string, { start: string; end: string }>();

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const date = cells[col.date];
    if (!date) continue;
    const rawType = (cells[col.dayType] ?? '').toLowerCase();
    const dayType: DayType = DAY_TYPES.includes(rawType as DayType)
      ? (rawType as DayType)
      : 'hold';
    const legId = cells[col.leg] || 'leg_1';
    const venueName = col.venue >= 0 ? cells[col.venue] : '';

    const day: Day = {
      id: `day_${date}`,
      date,
      legId,
      dayType,
      city: cells[col.city] || undefined,
      country: cells[col.country] || undefined,
      venueId: dayType === 'show' && venueName ? slugVenueId(venueName) : undefined,
      notes: col.notes >= 0 ? cells[col.notes] || undefined : undefined,
      published: false,
    };
    days.push(day);

    const bounds = legBounds.get(legId);
    if (!bounds) legBounds.set(legId, { start: date, end: date });
    else legBounds.set(legId, { start: bounds.start < date ? bounds.start : date, end: bounds.end > date ? bounds.end : date });

    scheduleItems.push(
      ...daySchedule(day, {
        city: cells[col.city] || '',
        venue: venueName,
        doors_local: col.doors >= 0 ? cells[col.doors] : '',
        set_time_local: col.set >= 0 ? cells[col.set] : '',
        curfew_local: col.curfew >= 0 ? cells[col.curfew] : '',
      }),
    );
  }

  const legs: Leg[] = [...legBounds.entries()].map(([id, b]) => ({
    id,
    name: legName(id),
    startDate: b.start,
    endDate: b.end,
  }));
  const dates = days.map((d) => d.date).sort();

  return {
    legs,
    days,
    scheduleItems,
    startDate: dates[0] ?? '',
    endDate: dates[dates.length - 1] ?? '',
  };
}
