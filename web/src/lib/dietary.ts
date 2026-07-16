import type { CateringMenu, MenuTime } from '@/types';

export interface DietaryTagItem {
  room: string;
  menuTime: MenuTime;
  itemName: string;
}

export interface DietaryTagEntry {
  tag: string;
  count: number;
  items: DietaryTagItem[];
}

// Rolls up every dietary tag across a catering section's menus so a caterer
// or venue can see "gluten-free: 2 items" and drill into which ones.
export function aggregateDietaryTags(menus: CateringMenu[]): DietaryTagEntry[] {
  const byTag = new Map<string, DietaryTagEntry>();
  for (const menu of menus) {
    for (const item of menu.items) {
      for (const tag of item.dietaryTags ?? []) {
        if (!byTag.has(tag)) byTag.set(tag, { tag, count: 0, items: [] });
        const entry = byTag.get(tag)!;
        entry.count += 1;
        entry.items.push({ room: menu.room, menuTime: menu.menuTime, itemName: item.item });
      }
    }
  }
  return [...byTag.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
