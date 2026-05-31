import { describe, it, expect } from 'vitest';
import {
  getDay,
  getDayById,
  getScheduleItemsForDay,
  getTravelForDay,
  getHotelsForDay,
  getTasksForDay,
  getTourPersonById,
  getGroupById,
  getGroupTagById,
  getAllConflicts,
} from '@/lib/tourQueries';
import { createScratchTour } from '@/data/scratchTour';
import { vis } from '@/lib/visibility';
import type { Tour } from '@/types';

function makeTour(): Tour {
  const t = createScratchTour();
  t.days = [
    { id: 'day_a', date: '2026-09-23', dayType: 'rehearsal', published: false },
    { id: 'day_b', date: '2026-09-25', dayType: 'show', published: false },
    { id: 'day_c', date: '2026-09-26', dayType: 'off', published: false },
  ];
  t.scheduleItems = [
    { id: 'si1', dayId: 'day_a', type: 'rehearsal', title: 'Rehearsal', startTime: '11:00', visibility: vis.everyone() },
    { id: 'si2', dayId: 'day_b', type: 'doors', title: 'Doors', startTime: '20:00', visibility: vis.everyone() },
  ];
  t.travel = [
    {
      id: 'tr1', dayId: 'day_b', mode: 'flight', from: 'LAX', to: 'MEX',
      departTime: '09:00', arriveTime: '15:00', passengers: [], visibility: vis.everyone(),
    },
  ];
  t.hotels = [
    {
      id: 'h1', dayId: 'day_a', name: 'Hotel One', address: 'Somewhere',
      nights: 3, occupants: [], visibility: vis.everyone(), sensitive: false,
    },
  ];
  t.tasks = [{ id: 'tk1', dayId: 'day_b', title: 'Task', status: 'todo', visibility: vis.everyone() }];
  t.groupTags = [{ id: 'tag_foh', groupId: 'grp_audio', name: 'FOH' }];
  t.riderImports = [
    {
      id: 'ri1', filename: 'r.pdf', uploadedAt: '2026-09-01T10:00', uploadedBy: 'TM',
      sourceLanguage: 'es', pageCount: 1, status: 'review', revision: 1,
      sections: [
        {
          type: 'other', pages: [], status: 'review',
          conflicts: [
            { id: 'c1', type: 'duplicate', severity: 'low', description: 'x', sectionsInvolved: [], values: [] },
            { id: 'c2', type: 'duplicate', severity: 'high', description: 'y', sectionsInvolved: [], values: [] },
          ],
        },
        { type: 'stage_specs', pages: [4], status: 'review' },
      ],
    },
  ];
  return t;
}

describe('tourQueries â€” day lookups', () => {
  const t = makeTour();
  it('getDay finds by date', () => {
    expect(getDay(t, '2026-09-25')?.id).toBe('day_b');
    expect(getDay(t, '2099-01-01')).toBeUndefined();
  });
  it('getDayById finds by id', () => {
    expect(getDayById(t, 'day_a')?.date).toBe('2026-09-23');
  });
});

describe('tourQueries â€” per-day collections', () => {
  const t = makeTour();
  it('getScheduleItemsForDay filters by dayId', () => {
    expect(getScheduleItemsForDay(t, 'day_a').map((s) => s.id)).toEqual(['si1']);
    expect(getScheduleItemsForDay(t, 'day_c')).toEqual([]);
  });
  it('getTravelForDay filters by dayId', () => {
    expect(getTravelForDay(t, 'day_b')).toHaveLength(1);
    expect(getTravelForDay(t, 'day_a')).toEqual([]);
  });
  it('getTasksForDay filters by dayId', () => {
    expect(getTasksForDay(t, 'day_b').map((x) => x.id)).toEqual(['tk1']);
  });
});

describe('tourQueries â€” getHotelsForDay multi-night coverage', () => {
  const t = makeTour();
  it('includes the hotel on its check-in day', () => {
    expect(getHotelsForDay(t, 'day_a').map((h) => h.id)).toEqual(['h1']);
  });
  it('includes the hotel on a night within the stay', () => {
    expect(getHotelsForDay(t, 'day_b').map((h) => h.id)).toEqual(['h1']);
  });
  it('excludes the hotel on the check-out day', () => {
    expect(getHotelsForDay(t, 'day_c')).toEqual([]);
  });
});

describe('tourQueries â€” entity lookups', () => {
  const t = makeTour();
  it('getTourPersonById finds the seeded TM', () => {
    expect(getTourPersonById(t, 'tp_scratch_tm')?.role).toBe('Tour Manager');
  });
  it('getGroupById / getGroupTagById resolve', () => {
    expect(getGroupById(t, 'grp_mgmt')?.name).toBe('Management');
    expect(getGroupTagById(t, 'tag_foh')?.name).toBe('FOH');
    expect(getGroupById(t, 'nope')).toBeUndefined();
  });
});

describe('tourQueries â€” getAllConflicts', () => {
  it('flattens conflicts across rider sections', () => {
    const ids = getAllConflicts(makeTour()).map((c) => c.id);
    expect(ids).toEqual(['c1', 'c2']);
  });
  it('returns [] when there are no rider imports', () => {
    expect(getAllConflicts(createScratchTour())).toEqual([]);
  });
});
