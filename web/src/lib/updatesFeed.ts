// Derived "what changed recently" feed — folds together every edit-history
// overlay AppState already tracks (schedule, rider, visibility, day locks,
// resolved conflicts, venue advance/negotiation) into one flat, sorted list.
// Pure functions only: no React, no storage I/O. AppState owns the actual
// Maps; this module just reads them and describes what happened in plain
// English, per the provenance-copy voice documented in CLAUDE.md.

import type {
  ID,
  ScheduleItemEditRecord,
  SectionEditRecord,
  VisibilityEditRecord,
  DayLockRecord,
  ShowAdvance,
  ShowRiderStatus,
  NegotiationThread,
  NegotiationEntry,
  VenueItemAnswer,
  ReconcileAction,
} from '@/types';
import type { ConflictResolution } from '@/state/AppState';

export const DEFAULT_UPDATES_FEED_LIMIT = 20;

export type FeedSurface = 'schedule' | 'rider' | 'visibility' | 'locks' | 'conflicts' | 'advance';

export interface FeedEntry {
  /** ISO timestamp — the sort key. */
  at: string;
  /** Display name of whoever made the change. */
  by: string;
  surface: FeedSurface;
  /** Short plain-English description of what happened. */
  label: string;
  /** Relative in-app path (no leading slash), only set when cleanly derivable. */
  href?: string;
}

/** All the overlay collections this feed folds together, exactly as AppState
 *  holds them. Pass the live Maps straight through — no conversion needed. */
export interface UpdatesFeedSources {
  scheduleItemEditHistory: ReadonlyMap<ID, ScheduleItemEditRecord[]>;
  sectionEditHistory: ReadonlyMap<string, SectionEditRecord[]>;
  visibilityEditHistory: ReadonlyMap<ID, VisibilityEditRecord[]>;
  dayLockHistory: ReadonlyMap<ID, DayLockRecord[]>;
  resolvedConflicts: ReadonlyMap<ID, ConflictResolution>;
  negotiations: ReadonlyMap<string, NegotiationThread>;
  showAdvances: ReadonlyMap<ID, ShowAdvance>;
}

// ---- schedule ---------------------------------------------------------

const SCHEDULE_FIELD_LABELS: Record<string, string> = {
  startTime: 'start time',
  endTime: 'end time',
  title: 'title',
  location: 'location',
  notes: 'notes',
  type: 'type',
};

function labelForScheduleRecord(record: ScheduleItemEditRecord): string {
  const first = record.changes[0];
  const rowLabel = first?.rowLabel ?? 'a schedule item';
  if (record.status === 'created') return `Added "${rowLabel}" to the schedule`;
  if (record.status === 'deleted') return `Removed "${rowLabel}" from the schedule`;
  if (record.changes.length === 1) {
    const fieldLabel = SCHEDULE_FIELD_LABELS[first.field] ?? first.field;
    return `Updated the ${fieldLabel} for "${rowLabel}"`;
  }
  return `Updated "${rowLabel}" (${record.changes.length} changes)`;
}

// ---- rider sections -----------------------------------------------------

function labelForSectionRecord(record: SectionEditRecord): string {
  const first = record.changes[0];
  const rowLabel = first?.rowLabel ?? 'a section';
  if (record.status === 'created') return `Added a new "${rowLabel}" section to the rider`;
  if (record.status === 'deleted') return `Removed the "${rowLabel}" section from the rider`;
  if (first?.field === 'title') return `Renamed "${first.before}" to "${first.after}"`;
  if (first?.field === 'tocIndex') return `Reordered the "${rowLabel}" section`;
  const extra = record.changes.length > 1 ? ` and ${record.changes.length - 1} more change${record.changes.length > 2 ? 's' : ''}` : '';
  if (record.status === 'approved') return `Approved a correction to "${rowLabel}"${extra}`;
  if (record.status === 'rejected') return `Rejected a proposed correction to "${rowLabel}"${extra}`;
  return `Updated "${rowLabel}"${extra}`;
}

// ---- visibility -----------------------------------------------------------

function labelForVisibilityRecord(record: VisibilityEditRecord): string {
  if (record.status === 'approved') return 'Approved a change to who can see an item';
  if (record.status === 'rejected') return 'Rejected a proposed change to who can see an item';
  return 'Updated who can see an item';
}

// ---- day locks --------------------------------------------------------

function labelForLockRecord(record: DayLockRecord): string {
  const base = record.locked ? 'Locked the day' : 'Unlocked the day';
  return record.reason ? `${base} — ${record.reason}` : base;
}

/** `Day.id` is always `day_${isoDate}` (see lib/routeCsv.ts) — strip the
 *  prefix to build a calendar link. Falls back to no link if the key ever
 *  doesn't follow that shape, rather than guessing at a wrong path. */
function calendarHrefForDayId(dayId: string): string | undefined {
  const date = dayId.startsWith('day_') ? dayId.slice('day_'.length) : undefined;
  return date ? `calendar/${date}` : undefined;
}

// ---- resolved conflicts -------------------------------------------------

function labelForConflictResolution(res: ConflictResolution): string {
  return `Resolved a conflict — decided on "${res.chosenValue}"`;
}

// ---- venue advance + negotiation -----------------------------------------

const ADVANCE_STATUS_LABELS: Record<ShowRiderStatus, string> = {
  draft: 'Started preparing the venue advance',
  sent: 'Sent the rider to the venue',
  in_negotiation: 'Started negotiating with the venue',
  confirmed: 'Confirmed everything with the venue',
};

function labelForAdvanceHistoryEntry(entry: { status: ShowRiderStatus; note?: string }): string {
  const base = ADVANCE_STATUS_LABELS[entry.status] ?? 'Updated the venue advance';
  return entry.note ? `${base} — ${entry.note}` : base;
}

const ANSWER_LABELS: Record<VenueItemAnswer, string> = {
  have: 'confirmed they have it',
  partial: 'said they only have some of it',
  dont_have: "said they don't have it",
  acknowledged: 'acknowledged the request',
  issue: 'flagged an issue with it',
};

const RECONCILE_LABELS: Record<ReconcileAction, string> = {
  accept_venue: "Accepted the venue's offer",
  band_brings: 'Decided the band will bring it instead',
  substitute: 'Substituted the item with something else',
  drop: 'Dropped the item',
};

function labelForNegotiationEntry(entry: NegotiationEntry): string {
  let base: string;
  if (entry.kind === 'venue_response') {
    base = `Venue ${entry.answer ? ANSWER_LABELS[entry.answer] : 'responded'} on a rider item`;
  } else if (entry.kind === 'tm_reconcile') {
    base =
      entry.action === 'substitute' && entry.substitution
        ? `Substituted "${entry.substitution}" for a rider item`
        : entry.action
          ? RECONCILE_LABELS[entry.action]
          : 'Reconciled a rider item with the venue';
  } else if (entry.kind === 'note') {
    base = entry.note ? `Left a note: "${entry.note}"` : 'Left a note on a rider item';
    return base; // note text already folded in above — skip the generic suffix below
  } else {
    base = 'Reopened an item for renegotiation';
  }
  return entry.note ? `${base} — ${entry.note}` : base;
}

// ---- fold + sort ----------------------------------------------------------

/**
 * Fold every tracked edit-history source into one flat list, sorted by
 * recency (most recent first), truncated to `limit`. Sorts the full combined
 * set before truncating so no single noisy source can crowd out the rest.
 */
export function collectRecentUpdates(
  sources: UpdatesFeedSources,
  limit: number = DEFAULT_UPDATES_FEED_LIMIT,
): FeedEntry[] {
  const entries: FeedEntry[] = [];

  for (const records of sources.scheduleItemEditHistory.values()) {
    for (const record of records) {
      entries.push({
        at: record.resolvedAt.at,
        by: record.resolvedAt.by,
        surface: 'schedule',
        label: labelForScheduleRecord(record),
      });
    }
  }

  for (const records of sources.sectionEditHistory.values()) {
    for (const record of records) {
      entries.push({
        at: record.resolvedAt.at,
        by: record.resolvedAt.by,
        surface: 'rider',
        label: labelForSectionRecord(record),
        href: 'rider',
      });
    }
  }

  for (const records of sources.visibilityEditHistory.values()) {
    for (const record of records) {
      entries.push({
        at: record.resolvedAt.at,
        by: record.resolvedAt.by,
        surface: 'visibility',
        label: labelForVisibilityRecord(record),
      });
    }
  }

  for (const [dayId, records] of sources.dayLockHistory.entries()) {
    const href = calendarHrefForDayId(dayId);
    for (const record of records) {
      entries.push({
        at: record.stamp.at,
        by: record.stamp.by,
        surface: 'locks',
        label: labelForLockRecord(record),
        ...(href ? { href } : {}),
      });
    }
  }

  for (const res of sources.resolvedConflicts.values()) {
    entries.push({
      at: res.resolvedAt,
      by: res.resolvedBy,
      surface: 'conflicts',
      label: labelForConflictResolution(res),
    });
  }

  for (const advance of sources.showAdvances.values()) {
    const href = `advance/${advance.showDayId}`;
    for (const h of advance.history) {
      entries.push({
        at: h.stamp.at,
        by: h.stamp.by,
        surface: 'advance',
        label: labelForAdvanceHistoryEntry(h),
        href,
      });
    }
  }

  for (const thread of sources.negotiations.values()) {
    const href = `advance/${thread.showDayId}`;
    for (const entry of thread.entries) {
      entries.push({
        at: entry.stamp.at,
        by: entry.stamp.by,
        surface: 'advance',
        label: labelForNegotiationEntry(entry),
        href,
      });
    }
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return entries.slice(0, limit);
}
