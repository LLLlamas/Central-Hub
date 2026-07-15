import { describe, it, expect } from 'vitest';
import { collectRecentUpdates } from '@/lib/updatesFeed';
import type {
  ScheduleItemEditRecord,
  SectionEditRecord,
  VisibilityEditRecord,
  DayLockRecord,
  ShowAdvance,
  NegotiationThread,
} from '@/types';
import type { ConflictResolution } from '@/state/AppState';

// Mutable counterpart of `UpdatesFeedSources` (whose fields are ReadonlyMap)
// so tests can `.set(...)` while building fixtures — a plain Map is a valid
// ReadonlyMap when passed into `collectRecentUpdates`.
interface MutableSources {
  scheduleItemEditHistory: Map<string, ScheduleItemEditRecord[]>;
  sectionEditHistory: Map<string, SectionEditRecord[]>;
  visibilityEditHistory: Map<string, VisibilityEditRecord[]>;
  dayLockHistory: Map<string, DayLockRecord[]>;
  resolvedConflicts: Map<string, ConflictResolution>;
  negotiations: Map<string, NegotiationThread>;
  showAdvances: Map<string, ShowAdvance>;
}

function emptySources(): MutableSources {
  return {
    scheduleItemEditHistory: new Map(),
    sectionEditHistory: new Map(),
    visibilityEditHistory: new Map(),
    dayLockHistory: new Map(),
    resolvedConflicts: new Map(),
    negotiations: new Map(),
    showAdvances: new Map(),
  };
}

describe('collectRecentUpdates', () => {
  it('returns an empty array when every source is empty', () => {
    expect(collectRecentUpdates(emptySources())).toEqual([]);
  });

  it('folds entries from multiple source types into one list sorted by recency', () => {
    const sources = emptySources();

    const scheduleRecord: ScheduleItemEditRecord = {
      patch: { startTime: '18:00' },
      changes: [{ rowLabel: 'Soundcheck', field: 'startTime', before: '17:00', after: '18:00' }],
      status: 'direct',
      resolvedAt: { at: '2026-09-20T09:00', by: 'Tour Manager' },
    };
    sources.scheduleItemEditHistory.set('si_1', [scheduleRecord]);

    const sectionRecord: SectionEditRecord = {
      patch: {},
      changes: [{ rowLabel: 'Backline', field: 'created', before: '', after: 'Backline' }],
      status: 'created',
      resolvedAt: { at: '2026-09-22T12:00', by: 'Production Manager' },
    };
    sources.sectionEditHistory.set('sec_1', [sectionRecord]);

    const lockRecord: DayLockRecord = {
      locked: true,
      reason: 'Schedule confirmed',
      stamp: { at: '2026-09-21T08:00', by: 'Tour Manager' },
    };
    sources.dayLockHistory.set('day_2026-09-22', [lockRecord]);

    const conflictResolution: ConflictResolution = {
      resolvedAt: '2026-09-23T15:00',
      resolvedBy: 'Tour Manager',
      chosenValue: '44 channels',
    };
    sources.resolvedConflicts.set('conflict_1', conflictResolution);

    const result = collectRecentUpdates(sources);

    // Most recent first, across all four source types.
    expect(result.map((e) => e.at)).toEqual([
      '2026-09-23T15:00',
      '2026-09-22T12:00',
      '2026-09-21T08:00',
      '2026-09-20T09:00',
    ]);
    expect(result.map((e) => e.surface)).toEqual(['conflicts', 'rider', 'locks', 'schedule']);

    const conflictEntry = result.find((e) => e.surface === 'conflicts');
    expect(conflictEntry?.by).toBe('Tour Manager');
    expect(conflictEntry?.label).toContain('44 channels');
    expect(conflictEntry?.href).toBeUndefined();

    const riderEntry = result.find((e) => e.surface === 'rider');
    expect(riderEntry?.href).toBe('rider');
    expect(riderEntry?.label).toContain('Backline');

    const lockEntry = result.find((e) => e.surface === 'locks');
    expect(lockEntry?.href).toBe('calendar/2026-09-22');
    expect(lockEntry?.label).toContain('Schedule confirmed');

    const scheduleEntry = result.find((e) => e.surface === 'schedule');
    expect(scheduleEntry?.label).toContain('Soundcheck');
  });

  it('folds advance history and negotiation entries under the advance surface with a derived href', () => {
    const sources = emptySources();

    const advance: ShowAdvance = {
      showDayId: 'day_2026-09-24',
      status: 'sent',
      items: [],
      riderRevision: 1,
      history: [
        { status: 'sent', stamp: { at: '2026-09-19T10:00', by: 'Tour Manager' } },
      ],
    };
    sources.showAdvances.set('day_2026-09-24', advance);

    const thread: NegotiationThread = {
      showDayId: 'day_2026-09-24',
      itemKey: 'sec_1::ch1',
      status: 'awaiting_tm',
      entries: [
        {
          id: 'neg_1',
          kind: 'venue_response',
          answer: 'partial',
          stamp: { at: '2026-09-24T11:00', by: 'Venue Contact' },
        },
      ],
    };
    sources.negotiations.set('day_2026-09-24::sec_1::ch1', thread);

    const result = collectRecentUpdates(sources);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.surface === 'advance')).toBe(true);
    expect(result.every((e) => e.href === 'advance/day_2026-09-24')).toBe(true);
    expect(result[0].at).toBe('2026-09-24T11:00'); // negotiation entry is more recent
    expect(result[1].at).toBe('2026-09-19T10:00');
  });

  it('respects the limit parameter after sorting the full combined set', () => {
    const sources = emptySources();
    const records: ScheduleItemEditRecord[] = Array.from({ length: 5 }, (_, i) => ({
      patch: { notes: `note ${i}` },
      changes: [{ rowLabel: 'Load-in', field: 'notes', before: '', after: `note ${i}` }],
      status: 'direct',
      resolvedAt: { at: `2026-09-2${i}T10:00`, by: 'Tour Manager' },
    }));
    sources.scheduleItemEditHistory.set('si_1', records);

    const result = collectRecentUpdates(sources, 2);
    expect(result).toHaveLength(2);
    expect(result[0].at).toBe('2026-09-24T10:00');
    expect(result[1].at).toBe('2026-09-23T10:00');
  });

  it('defaults the limit to 20 when not provided', () => {
    const sources = emptySources();
    const records: ScheduleItemEditRecord[] = Array.from({ length: 25 }, (_, i) => ({
      patch: {},
      changes: [{ rowLabel: 'Doors', field: 'notes', before: '', after: `${i}` }],
      status: 'direct',
      resolvedAt: { at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00`, by: 'Tour Manager' },
    }));
    sources.scheduleItemEditHistory.set('si_1', records);

    expect(collectRecentUpdates(sources)).toHaveLength(20);
  });
});
