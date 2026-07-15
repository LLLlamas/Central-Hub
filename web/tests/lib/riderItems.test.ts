import { describe, it, expect } from 'vitest';
import { deriveRiderItems, getMergedSections, parseQty } from '@/lib/riderItems';
import type { RiderSection, RiderSectionEdit } from '@/types';

function baseSection(overrides: Partial<RiderSection>): RiderSection {
  return {
    id: 'sec_1',
    type: 'other',
    status: 'approved',
    ...overrides,
  };
}

describe('parseQty', () => {
  it('uses a numeric qty directly with no qtyLabel', () => {
    expect(parseQty(4)).toEqual({ requestedQty: 4 });
  });

  it('falls back to qty 1 + qtyLabel for a string qty', () => {
    expect(parseQty('2 dozen')).toEqual({ requestedQty: 1, qtyLabel: '2 dozen' });
  });
});

describe('getMergedSections', () => {
  it('overlays a matching edit onto the base section without mutating inputs', () => {
    const sections: RiderSection[] = [
      baseSection({
        id: 'sec_input',
        type: 'input_list',
        inputList: [{ channelNumber: 1, source: 'Kick In', micOrDi: 'Beta 91' }],
      }),
    ];
    const edits = new Map<string, RiderSectionEdit>([
      [
        'sec_input',
        { inputList: [{ channelNumber: 1, source: 'Kick In (edited)', micOrDi: 'Beta 52' }] },
      ],
    ]);

    const merged = getMergedSections(sections, edits);

    expect(merged).not.toBe(sections);
    expect(merged[0].inputList?.[0].source).toBe('Kick In (edited)');
    // original untouched
    expect(sections[0].inputList?.[0].source).toBe('Kick In');
  });

  it('leaves sections without a matching edit unchanged', () => {
    const sections: RiderSection[] = [baseSection({ id: 'sec_x', title: 'Stage specs' })];
    const merged = getMergedSections(sections, new Map());
    expect(merged[0]).toEqual(sections[0]);
    expect(merged[0]).not.toBe(sections[0]);
  });
});

describe('deriveRiderItems — input_list', () => {
  it('emits one item per input channel and one per monitor mix, skipping fohOutputs', () => {
    const sections: RiderSection[] = [
      baseSection({
        id: 'sec_io',
        type: 'input_list',
        title: 'Input / Output',
        inputList: [
          { channelNumber: 1, source: 'Kick In', micOrDi: 'Beta 91' },
          { channelNumber: 2, source: 'Snare Top', micOrDi: '' },
        ],
        monitorMix: [{ outputs: '1-2', mixName: 'MAIN - ELSA', type: 'in_ear_stereo' }],
        fohOutputs: [{ outputNumber: '1', source: 'Main L' }],
      }),
    ];

    const items = deriveRiderItems(sections);

    expect(items).toHaveLength(3);
    const ch1 = items.find((i) => i.itemKey === 'sec_io::ch1');
    expect(ch1).toMatchObject({
      sectionId: 'sec_io',
      sectionType: 'input_list',
      sectionTitle: 'Input / Output',
      kind: 'item',
      requestedQty: 1,
    });
    expect(ch1?.label).toContain('Ch1');
    expect(ch1?.label).toContain('Kick In');
    expect(ch1?.label).toContain('Beta 91');

    const ch2 = items.find((i) => i.itemKey === 'sec_io::ch2');
    expect(ch2?.label).toBe('Ch2 Snare Top');

    const mix = items.find((i) => i.itemKey === 'sec_io::mix-1-2');
    expect(mix).toMatchObject({ kind: 'item', requestedQty: 1 });
    expect(mix?.label).toContain('MAIN - ELSA');

    expect(items.some((i) => i.label.includes('Main L'))).toBe(false);
  });
});

describe('deriveRiderItems — backline', () => {
  it('flattens hardware, kitOptions, bass options, guitar, and miscellaneous', () => {
    const sections: RiderSection[] = [
      baseSection({
        id: 'sec_bl',
        type: 'backline',
        title: 'Backline',
        backline: {
          drums: {
            kitOptions: ['DW Collectors maple', 'Yamaha Recording Custom'],
            pieces: [],
            hardware: [
              { item: 'Kick pedal', qty: 1, excluded: ['Yamaha'] },
              { item: 'Hi-hat stand', qty: 1 },
            ],
          },
          bass: {
            options: [{ optionNumber: 1, head: 'Ampeg SVT-VR', cab: 'Ampeg 8x10' }],
          },
          guitar: [{ item: 'Fender Twin Reverb', qty: 2, notes: 'Needs footswitch' }],
          miscellaneous: [{ item: 'DI boxes', qty: 4 }],
        },
      }),
    ];

    const items = deriveRiderItems(sections);
    const keys = items.map((i) => i.itemKey);

    expect(keys).toEqual([
      'sec_bl::hw0',
      'sec_bl::hw1',
      'sec_bl::kit-options',
      'sec_bl::bass-options',
      'sec_bl::guitar0',
      'sec_bl::misc0',
    ]);

    const kickPedal = items.find((i) => i.itemKey === 'sec_bl::hw0');
    expect(kickPedal).toMatchObject({ label: 'Kick pedal', requestedQty: 1 });
    expect(kickPedal?.notes).toBe('Excluded: Yamaha');

    const hiHat = items.find((i) => i.itemKey === 'sec_bl::hw1');
    expect(hiHat?.notes).toBeUndefined();

    const kit = items.find((i) => i.itemKey === 'sec_bl::kit-options');
    expect(kit?.label).toContain('DW Collectors maple');
    expect(kit?.label).toContain('Yamaha Recording Custom');
    expect(kit?.requestedQty).toBe(1);

    const bass = items.find((i) => i.itemKey === 'sec_bl::bass-options');
    expect(bass?.label).toContain('Ampeg SVT-VR');
    expect(bass?.requestedQty).toBe(1);

    const guitar = items.find((i) => i.itemKey === 'sec_bl::guitar0');
    expect(guitar).toMatchObject({ label: 'Fender Twin Reverb', requestedQty: 2, notes: 'Needs footswitch' });

    const misc = items.find((i) => i.itemKey === 'sec_bl::misc0');
    expect(misc).toMatchObject({ label: 'DI boxes', requestedQty: 4 });

    expect(items.every((i) => i.kind === 'item')).toBe(true);
  });

  it('returns no items when backline payload is absent', () => {
    const sections: RiderSection[] = [baseSection({ id: 'sec_bl', type: 'backline' })];
    expect(deriveRiderItems(sections)).toEqual([]);
  });
});

describe('deriveRiderItems — catering', () => {
  it('itemizes menu items with numeric and string qty', () => {
    const sections: RiderSection[] = [
      baseSection({
        id: 'sec_cat',
        type: 'catering',
        title: 'Catering',
        catering: {
          menus: [
            {
              room: 'Dressing room',
              menuTime: 'show',
              items: [
                { item: 'Still water', qty: 24, unit: 'bottles' },
                {
                  item: 'Bananas',
                  qty: '2 dozen',
                  brandExcluded: ['none'],
                  dietaryTags: ['vegan'],
                  notes: 'Ripe, not green',
                },
              ],
            },
          ],
        },
      }),
    ];

    const items = deriveRiderItems(sections);
    expect(items).toHaveLength(2);

    const water = items.find((i) => i.itemKey === 'sec_cat::menu0-item0-still-water');
    expect(water).toMatchObject({
      kind: 'item',
      label: 'Still water',
      requestedQty: 24,
      unit: 'bottles',
    });
    expect(water?.qtyLabel).toBeUndefined();

    const bananas = items.find((i) => i.itemKey === 'sec_cat::menu0-item1-bananas');
    expect(bananas).toMatchObject({ label: 'Bananas', requestedQty: 1, qtyLabel: '2 dozen' });
    expect(bananas?.notes).toContain('Ripe, not green');
    expect(bananas?.notes).toContain('Excluded: none');
    expect(bananas?.notes).toContain('Dietary: vegan');
  });

  it('gives two blank/same-name items in one menu distinct itemKeys', () => {
    const sections: RiderSection[] = [
      baseSection({
        id: 'sec_cat',
        type: 'catering',
        title: 'Catering',
        catering: {
          menus: [
            {
              room: 'Dressing room',
              menuTime: 'show',
              items: [
                { item: '', qty: '' },
                { item: '', qty: '' },
              ],
            },
          ],
        },
      }),
    ];

    const items = deriveRiderItems(sections);
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.itemKey)).size).toBe(2);
  });
});

describe('deriveRiderItems — section_ack fallback', () => {
  const otherTypes: RiderSection['type'][] = [
    'cover_and_contacts',
    'production_control',
    'permits',
    'stage_specs',
    'audio_pa',
    'audio_monitors',
    'output_patch',
    'stage_plot',
    'lighting_equipment',
    'lighting_plot',
    'video',
    'soundcheck',
    'ground_transport',
    'air_transport',
    'lodging',
    'dressing_rooms',
    'settlement',
    'other',
  ];

  it('produces exactly one section_ack item per section, regardless of payload', () => {
    for (const type of otherTypes) {
      const section = baseSection({ id: `sec_${type}`, type, title: `Title for ${type}` });
      const items = deriveRiderItems([section]);
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        itemKey: `sec_${type}`,
        sectionId: `sec_${type}`,
        sectionType: type,
        sectionTitle: `Title for ${type}`,
        kind: 'section_ack',
        label: `Title for ${type}`,
        requestedQty: 1,
      });
    }
  });

  it('does not itemize a lodging section roomingList — still a single section_ack', () => {
    const section = baseSection({
      id: 'sec_lodge',
      type: 'lodging',
      title: 'Lodging',
      lodging: {
        roomingList: [
          { roomNumber: 101, roomType: 'double', occupants: [{ name: 'Elsa', role: 'Artist' }] },
          { roomNumber: 102, roomType: 'single', occupants: [{ name: 'Julian', role: 'Artist' }] },
        ],
        totalRooms: 2,
      },
    });

    const items = deriveRiderItems([section]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('section_ack');
  });

  it('falls back to the raw type as label when title is absent', () => {
    const section = baseSection({ id: 'sec_notitle', type: 'permits' });
    const items = deriveRiderItems([section]);
    expect(items[0].label).toBe('permits');
    expect(items[0].sectionTitle).toBe('permits');
  });
});
