// Pure access module — the server-side `readableBy` denormalization (spec §5).
//
// This is the single bridge between the ABAC visibility model and the
// Firestore `readableBy: uid[]` arrays the security rules query against. It
// MUST reuse `resolveVisibility` from lib/visibility.ts — there is exactly one
// copy of the rank logic in the codebase. No firebase imports live here so the
// Cloud Function can import the same algorithm verbatim.

import { resolveVisibility } from '@/lib/visibility';
import type { Visibility, Membership, MemberRole, CurrentUser, ID } from '@/types';

// Roles that always retain at least "sees" on every item, mirroring the seed
// visibility floor `{ default:'blocked', groups:{ grp_mgmt:'owns',
// grp_production:'owns' } }`. A member in one of these roles is included in
// `readableBy` regardless of the item's per-type visibility blob.
const OWNER_FLOOR_ROLES: ReadonlySet<MemberRole> = new Set<MemberRole>([
  'owner',
  'manager',
  'production',
]);

// The group a role maps to when a membership doesn't carry an explicit groupId
// (e.g. a freshly-accepted invite). Managers/owners land in management,
// production in production, everyone else stays uncategorized until the TM
// assigns a real group.
const ROLE_GROUP: Record<MemberRole, ID> = {
  owner: 'grp_mgmt',
  manager: 'grp_mgmt',
  production: 'grp_production',
  crew: 'grp_crew',
  viewer: 'grp_crew',
};

/** The group id a member should resolve against — explicit groupId wins, role default fills in. */
export function groupForMember(m: Pick<Membership, 'role' | 'groupId'>): ID {
  return m.groupId || ROLE_GROUP[m.role];
}

/** True when a role sits on the owner floor (always sees every item). */
export function isOwnerFloorRole(role: MemberRole): boolean {
  return OWNER_FLOOR_ROLES.has(role);
}

/** Shape a Membership into the CurrentUser the visibility resolver expects. */
export function membershipToCurrentUser(m: Membership): CurrentUser {
  return {
    tourPersonId: m.tourPersonId,
    name: m.displayName,
    role: m.role,
    groupId: groupForMember(m),
    tagIds: m.tagIds,
  };
}

/**
 * Compute the uids of members whose effective level on this item is >= 'sees'.
 * Owner-floor roles are always included so managers/production never lose
 * sight of an item regardless of its visibility blob.
 */
export function computeReadableBy(vis: Visibility, members: Membership[]): string[] {
  return members
    .filter(
      (m) =>
        isOwnerFloorRole(m.role) ||
        resolveVisibility(vis, membershipToCurrentUser(m)) !== 'blocked',
    )
    .map((m) => m.uid);
}
