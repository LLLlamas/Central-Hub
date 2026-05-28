import { describe, it, expect } from 'vitest';
import {
  createScratchTour,
  scratchUsers,
  scratchDefaultUserKey,
  SCRATCH_TM_TP_ID,
  SCRATCH_TOUR_NAME,
} from '@/data/scratchTour';

describe('createScratchTour', () => {
  it('is a named, empty shell with a single Tour Manager', () => {
    const t = createScratchTour();
    expect(t.name).toBe(SCRATCH_TOUR_NAME);
    expect(t.personnel).toHaveLength(1);
    expect(t.personnel[0].id).toBe(SCRATCH_TM_TP_ID);
    expect(t.personnel[0].role).toBe('Tour Manager');
    expect(t.personnel[0].groupId).toBe('grp_mgmt');
  });

  it('has every content collection empty but keeps the group taxonomy', () => {
    const t = createScratchTour();
    expect(t.days).toEqual([]);
    expect(t.scheduleItems).toEqual([]);
    expect(t.travel).toEqual([]);
    expect(t.riderImports).toEqual([]);
    expect(t.flightImports).toEqual([]);
    expect(t.legs).toEqual([]);
    expect(t.groups.length).toBeGreaterThan(0);
  });

  it('is JSON-serializable (so it can be persisted to localStorage)', () => {
    const t = createScratchTour();
    expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });
});

describe('scratchUsers / scratchDefaultUserKey', () => {
  it('derives the viewer map from the tour personnel', () => {
    const t = createScratchTour();
    const users = scratchUsers(t);
    expect(Object.keys(users)).toEqual([SCRATCH_TM_TP_ID]);
    expect(users[SCRATCH_TM_TP_ID].name).toBe('Tour Manager');
  });

  it('grows as personnel are added', () => {
    const t = createScratchTour();
    t.personnel.push({
      id: 'tp_x',
      personId: 'p_x',
      person: { id: 'p_x', name: 'Elsa' },
      role: 'Vocals',
      groupId: 'grp_artist',
      tagIds: [],
      startDate: '',
      endDate: '',
    });
    expect(Object.keys(scratchUsers(t))).toHaveLength(2);
  });

  it('defaults the viewer to the Tour Manager', () => {
    expect(scratchDefaultUserKey(createScratchTour())).toBe(SCRATCH_TM_TP_ID);
  });
});
