// Visibility defaults by schedule-item type — the "set it once" layer that
// removes per-item permission work for the common case.
//
// Every ScheduleItem is seeded with a Visibility blob derived from its type
// (see `defaultVisibilityForType`). Per-item edits are still allowed and act
// as overrides on top — the resolver in `lib/visibility.ts` doesn't change.

import type { ScheduleItemType, Visibility } from '@/types';

/**
 * Suggested owning department per item type — shown as a hint chip in the
 * type-defaults editor so the TM knows who would *normally* edit each kind
 * of item. No longer auto-granted: the seed Visibility starts locked to
 * Management + Production only, and the TM grants the owner group (and
 * anyone else) explicitly. Operational items map to Production; audio to
 * Audio; performance to Artist; calls/meals to Management.
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
 * The seed Visibility for an item of this type. NEAR-TERM POLICY: every active
 * member can **see** the schedule (and thus Calendar / Today / Day Sheets);
 * only Management + Production **own** it (the only editors). So `default: 'sees'`
 * with mgmt/production `owns`. The TM can still lock specific types/items down
 * later via the type-defaults editor (`default: 'blocked'`) — the resolver +
 * per-item overrides are unchanged; this just flips the starting point from
 * "hidden until granted" to "visible, manager-editable". Sensitive items are
 * still flagged via `ScheduleItem.sensitive`.
 */
export function defaultVisibilityForType(_type: ScheduleItemType): Visibility {
  return {
    default: 'sees',
    groups: {
      grp_mgmt: 'owns',
      grp_production: 'owns',
    },
  };
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
