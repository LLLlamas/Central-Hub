// Visibility resolver — the heart of the permissions model.
// Hierarchy: persons > tags > groups > default. Most specific wins.
// Levels: blocked < sees < owns.

import type { Visibility, VisibilityLevel, CurrentUser } from '@/types';

const LEVEL_RANK: Record<VisibilityLevel, number> = {
  blocked: 0,
  sees: 1,
  owns: 2,
};

export function resolveVisibility(
  spec: Visibility,
  user: CurrentUser,
): VisibilityLevel {
  // Most specific match wins.
  if (spec.persons?.[user.tourPersonId]) return spec.persons[user.tourPersonId];
  for (const tagId of user.tagIds) {
    if (spec.tags?.[tagId]) return spec.tags[tagId];
  }
  if (spec.groups?.[user.groupId]) return spec.groups[user.groupId];
  return spec.default;
}

export function canSee(spec: Visibility, user: CurrentUser): boolean {
  return LEVEL_RANK[resolveVisibility(spec, user)] >= LEVEL_RANK.sees;
}

export function canEdit(spec: Visibility, user: CurrentUser): boolean {
  return LEVEL_RANK[resolveVisibility(spec, user)] >= LEVEL_RANK.owns;
}

export function visibilityLabel(level: VisibilityLevel): string {
  switch (level) {
    case 'owns':
      return 'Owns';
    case 'sees':
      return 'Sees';
    case 'blocked':
      return 'Blocked';
  }
}

export function visibilityDescription(level: VisibilityLevel): string {
  switch (level) {
    case 'owns':
      return 'Can view and edit.';
    case 'sees':
      return 'Can view — it\'s on their day sheet.';
    case 'blocked':
      return 'Hidden — not in their day sheet.';
  }
}

// Quick visibility constructors for common patterns
export const vis = {
  everyone(level: VisibilityLevel = 'sees'): Visibility {
    return { default: level };
  },
  onlyGroups(groupIds: string[], level: VisibilityLevel = 'sees'): Visibility {
    return {
      default: 'blocked',
      groups: Object.fromEntries(groupIds.map((id) => [id, level])),
    };
  },
  sensitive(): Visibility {
    return { default: 'blocked' };
  },
};
