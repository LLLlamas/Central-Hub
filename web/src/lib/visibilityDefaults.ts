// Visibility defaults by schedule-item type — the "set it once" layer that
// removes per-item permission work for the common case.
//
// Every ScheduleItem is seeded with a Visibility blob derived from its type
// (see `defaultVisibilityForType`). Per-item edits are still allowed and act
// as overrides on top — the resolver in `lib/visibility.ts` doesn't change.

import type { ScheduleItemType, Visibility } from '@/types';

/**
 * Which department "owns" each item type by default — granted `owns` (edit
 * rights). Most operational items belong to Production; audio-specific items
 * to Audio; performance items to Artist; calls/meals to Management.
 */
export const SCHEDULE_TYPE_OWNER: Record<ScheduleItemType, string> = {
  load_in: 'grp_production',
  soundcheck: 'grp_audio',
  doors: 'grp_production',
  set: 'grp_artist',
  changeover: 'grp_production',
  curfew: 'grp_production',
  load_out: 'grp_production',
  bus_call: 'grp_mgmt',
  lobby_call: 'grp_mgmt',
  breakfast: 'grp_mgmt',
  lunch: 'grp_mgmt',
  dinner: 'grp_mgmt',
  press: 'grp_mgmt',
  meet_greet: 'grp_mgmt',
  rehearsal: 'grp_artist',
  other: 'grp_production',
};

/**
 * The seed Visibility for an item of this type — everyone sees by default,
 * the owning group gets `owns`. Sensitive items still get manually flagged
 * via `ScheduleItem.sensitive`, which the resolver / UI handle separately.
 */
export function defaultVisibilityForType(type: ScheduleItemType): Visibility {
  const owner = SCHEDULE_TYPE_OWNER[type];
  return owner
    ? { default: 'sees', groups: { [owner]: 'owns' } }
    : { default: 'sees' };
}

/**
 * Build the starting `Tour.visibilityDefaultsByType` template — the full set,
 * so the UI editor has a populated grid on day 1.
 */
export function buildScheduleTypeDefaults(): Record<ScheduleItemType, Visibility> {
  const out = {} as Record<ScheduleItemType, Visibility>;
  for (const type of Object.keys(SCHEDULE_TYPE_OWNER) as ScheduleItemType[]) {
    out[type] = defaultVisibilityForType(type);
  }
  return out;
}
