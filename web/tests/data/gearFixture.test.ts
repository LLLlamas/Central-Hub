import { describe, it, expect } from 'vitest';
import { buildGearItemsFromAuthoredRider, mergeGearItems } from '@/data/gearFixture';
import type { RiderImport, RiderSection } from '@/types';

function baseSection(overrides: Partial<RiderSection>): RiderSection {
  return {
    id: 'sec_1',
    type: 'other',
    status: 'approved',
    ...overrides,
  };
}

function authoredRider(sections: RiderSection[]): RiderImport {
  return {
    id: 'ri_1',
    uploadedAt: '2026-01-01T00:00',
    uploadedBy: 'TM',
    status: 'imported',
    origin: 'authored',
    sections,
    revision: 1,
  };
}

describe('buildGearItemsFromAuthoredRider', () => {
  it('returns nothing for a rider with no backline/input_list/catering content', () => {
    const rider = authoredRider([baseSection({ id: 'sec_x', type: 'stage_specs', freeText: 'no gear here' })]);
    expect(buildGearItemsFromAuthoredRider(rider)).toEqual([]);
  });

  it('derives backline pieces, hardware, bass options, guitar, misc, and video screen', () => {
    const rider = authoredRider([
      baseSection({
        id: 'sec_backline',
        type: 'backline',
        backline: {
          drums: {
            kitOptions: [],
            pieces: [{ type: 'Kick', size: '22"', notes: 'with legs' }],
            hardware: [{ item: 'Snare stand', qty: 2, preferred: ['DW'], excluded: ['Yamaha'] }],
          },
          bass: { options: [{ optionNumber: 1, head: 'SVT-Classic', cab: '8x10' }] },
          guitar: [{ item: 'Twin Reverb', qty: 1, notes: 'main' }],
          miscellaneous: [{ item: 'Keyboard stand', qty: 3, brandPreferred: 'Hercules' }],
          videoScreen: { type: 'LED', dimensions: '12x5m', aspectRatio: '16:9', resolutionPreferred: '1080p', resolutionMin: '720p' },
        },
      }),
    ]);

    const items = buildGearItemsFromAuthoredRider(rider);
    expect(items).toHaveLength(6);
    expect(items.every((i) => i.fromRider && i.riderSection === 'backline')).toBe(true);

    const kick = items.find((i) => i.name.startsWith('Kick'));
    expect(kick?.category).toBe('backline_drums');
    expect(kick?.notes).toBe('with legs');

    const snareStand = items.find((i) => i.name === 'Snare stand');
    expect(snareStand?.quantity).toBe(2);
    expect(snareStand?.notes).toContain('Preferred: DW');
    expect(snareStand?.notes).toContain('Excluded: Yamaha');

    const bassOption = items.find((i) => i.category === 'backline_bass');
    expect(bassOption?.name).toBe('Bass amp option 1 — SVT-Classic + 8x10');

    const video = items.find((i) => i.category === 'video');
    expect(video?.name).toBe('LED — 12x5m');
  });

  it('derives one item per input list channel', () => {
    const rider = authoredRider([
      baseSection({
        id: 'sec_io',
        type: 'input_list',
        inputList: [
          { channelNumber: 1, source: 'Kick In', micOrDi: 'Beta 91' },
          { channelNumber: 2, source: 'Snare Top', micOrDi: 'SM57', notes: 'tight' },
        ],
      }),
    ]);

    const items = buildGearItemsFromAuthoredRider(rider);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: 'Ch 1 — Kick In', category: 'audio_mics', quantity: 1, riderSection: 'input_list' });
    expect(items[1].notes).toBe('SM57 — tight');
  });

  it('derives catering items across menus, coercing non-numeric qty to 1', () => {
    const rider = authoredRider([
      baseSection({
        id: 'sec_cat',
        type: 'catering',
        catering: {
          menus: [
            {
              room: 'Band room',
              menuTime: 'show',
              items: [
                { item: 'Agua', itemEn: 'Water', qty: 12, unit: 'bottles' },
                { item: 'Snacks', qty: 'a few', brandPreferred: ['Nature Valley'] },
              ],
            },
          ],
        },
      }),
    ]);

    const items = buildGearItemsFromAuthoredRider(rider);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: 'Water', quantity: 12, unit: 'bottles', category: 'catering' });
    expect(items[1].quantity).toBe(1);
    expect(items[1].notes).toContain('Band room');
    expect(items[1].notes).toContain('Preferred: Nature Valley');
  });

  it('produces fresh ids that mergeGearItems can reconcile against user edits', () => {
    const rider = authoredRider([
      baseSection({
        id: 'sec_io',
        type: 'input_list',
        inputList: [{ channelNumber: 1, source: 'Kick In', micOrDi: 'Beta 91' }],
      }),
    ]);
    const fresh = buildGearItemsFromAuthoredRider(rider);
    const current = [{ ...fresh[0], status: 'confirmed' as const, notes: 'user note' }];
    const merged = mergeGearItems(current, fresh);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('confirmed');
    expect(merged[0].notes).toBe('user note');
  });
});
