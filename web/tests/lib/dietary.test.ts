import { describe, it, expect } from 'vitest';
import { aggregateDietaryTags } from '@/lib/dietary';
import type { CateringMenu } from '@/types';

const menus: CateringMenu[] = [
  {
    room: 'Dressing Room 1',
    menuTime: 'show',
    items: [
      { item: 'Salad', qty: 2, dietaryTags: ['gluten-free', 'vegan'] },
      { item: 'Chicken', qty: 4, dietaryTags: ['gluten-free'] },
      { item: 'Bread', qty: 1 },
    ],
  },
  {
    room: 'Backstage',
    menuTime: 'load_in',
    items: [
      { item: 'Fruit plate', qty: 1, dietaryTags: ['vegan'] },
    ],
  },
];

describe('aggregateDietaryTags', () => {
  it('rolls up counts per tag across all menus', () => {
    const result = aggregateDietaryTags(menus);
    expect(result).toEqual([
      {
        tag: 'gluten-free',
        count: 2,
        items: [
          { room: 'Dressing Room 1', menuTime: 'show', itemName: 'Salad' },
          { room: 'Dressing Room 1', menuTime: 'show', itemName: 'Chicken' },
        ],
      },
      {
        tag: 'vegan',
        count: 2,
        items: [
          { room: 'Dressing Room 1', menuTime: 'show', itemName: 'Salad' },
          { room: 'Backstage', menuTime: 'load_in', itemName: 'Fruit plate' },
        ],
      },
    ]);
  });

  it('ignores items with no dietary tags', () => {
    const result = aggregateDietaryTags([{ room: 'X', menuTime: 'show', items: [{ item: 'Water', qty: 1 }] }]);
    expect(result).toEqual([]);
  });

  it('returns an empty array for no menus', () => {
    expect(aggregateDietaryTags([])).toEqual([]);
  });

  it('sorts ties alphabetically by tag', () => {
    const tied: CateringMenu[] = [
      { room: 'A', menuTime: 'show', items: [{ item: 'X', qty: 1, dietaryTags: ['nut-free'] }] },
      { room: 'B', menuTime: 'show', items: [{ item: 'Y', qty: 1, dietaryTags: ['dairy-free'] }] },
    ];
    expect(aggregateDietaryTags(tied).map((e) => e.tag)).toEqual(['dairy-free', 'nut-free']);
  });
});
