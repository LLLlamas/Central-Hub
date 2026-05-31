import { describe, it, expect } from 'vitest';
import { computeReadableBy, groupForMember, membershipToCurrentUser } from '@/lib/access';
import type { Membership, Visibility } from '@/types';

function member(over: Partial<Membership> = {}): Membership {
  return {
    uid: over.uid ?? 'u1',
    tourId: 't1',
    email: over.email ?? `${over.uid ?? 'u1'}@example.com`,
    role: over.role ?? 'crew',
    status: over.status ?? 'active',
    tourPersonId: over.tourPersonId ?? 'tp1',
    displayName: over.displayName ?? 'Crew One',
    groupId: over.groupId ?? 'grp_audio',
    tagIds: over.tagIds ?? [],
    joinedAt: '2025-09-22T09:00',
    ...over,
  };
}

describe('computeReadableBy', () => {
  it('includes a member when the default floor lets them see', () => {
    const vis: Visibility = { default: 'sees' };
    const crew = member({ uid: 'crew', role: 'crew' });
    expect(computeReadableBy(vis, [crew])).toEqual(['crew']);
  });

  it('excludes a member blocked by the default floor', () => {
    const vis: Visibility = { default: 'blocked' };
    const crew = member({ uid: 'crew', role: 'crew' });
    expect(computeReadableBy(vis, [crew])).toEqual([]);
  });

  it('always includes owner-floor roles regardless of visibility', () => {
    const vis: Visibility = { default: 'blocked' };
    const owner = member({ uid: 'owner', role: 'owner', groupId: 'grp_mgmt' });
    const manager = member({ uid: 'mgr', role: 'manager', groupId: 'grp_mgmt' });
    const production = member({ uid: 'prod', role: 'production', groupId: 'grp_production' });
    const crew = member({ uid: 'crew', role: 'crew' });
    expect(computeReadableBy(vis, [owner, manager, production, crew]).sort()).toEqual(
      ['mgr', 'owner', 'prod'].sort(),
    );
  });

  it('honors group overrides above the default floor', () => {
    const vis: Visibility = { default: 'blocked', groups: { grp_audio: 'sees' } };
    const audio = member({ uid: 'audio', role: 'crew', groupId: 'grp_audio' });
    const lighting = member({ uid: 'light', role: 'crew', groupId: 'grp_lighting' });
    expect(computeReadableBy(vis, [audio, lighting])).toEqual(['audio']);
  });

  it('honors tag overrides above the group level (more specific wins)', () => {
    // group blocks audio, but the FOH tag re-grants sees → tagged member sees.
    const vis: Visibility = {
      default: 'blocked',
      groups: { grp_audio: 'blocked' },
      tags: { foh: 'sees' },
    };
    const foh = member({ uid: 'foh', role: 'crew', groupId: 'grp_audio', tagIds: ['foh'] });
    const monitors = member({ uid: 'mon', role: 'crew', groupId: 'grp_audio', tagIds: ['mon'] });
    expect(computeReadableBy(vis, [foh, monitors])).toEqual(['foh']);
  });

  it('honors person overrides above tag and group (most specific wins)', () => {
    const vis: Visibility = {
      default: 'sees',
      groups: { grp_audio: 'sees' },
      tags: { foh: 'sees' },
      persons: { tp_blocked: 'blocked' },
    };
    const blocked = member({
      uid: 'blocked',
      role: 'crew',
      tourPersonId: 'tp_blocked',
      groupId: 'grp_audio',
      tagIds: ['foh'],
    });
    const seen = member({ uid: 'seen', role: 'crew', tourPersonId: 'tp_seen' });
    expect(computeReadableBy(vis, [blocked, seen])).toEqual(['seen']);
  });

  it('a person-block still loses to the owner floor', () => {
    const vis: Visibility = { default: 'sees', persons: { tp_mgr: 'blocked' } };
    const mgr = member({ uid: 'mgr', role: 'manager', tourPersonId: 'tp_mgr', groupId: 'grp_mgmt' });
    expect(computeReadableBy(vis, [mgr])).toEqual(['mgr']);
  });
});

describe('groupForMember / membershipToCurrentUser', () => {
  it('uses the explicit groupId when present', () => {
    expect(groupForMember({ role: 'crew', groupId: 'grp_audio' })).toBe('grp_audio');
  });

  it('falls back to the role default group when groupId is empty', () => {
    expect(groupForMember({ role: 'manager', groupId: '' })).toBe('grp_mgmt');
    expect(groupForMember({ role: 'production', groupId: '' })).toBe('grp_production');
    expect(groupForMember({ role: 'crew', groupId: '' })).toBe('grp_crew');
  });

  it('maps a Membership to the CurrentUser shape the resolver expects', () => {
    const cu = membershipToCurrentUser(
      member({ uid: 'x', tourPersonId: 'tp9', displayName: 'Nine', groupId: 'grp_audio', tagIds: ['foh'] }),
    );
    expect(cu).toEqual({
      tourPersonId: 'tp9',
      name: 'Nine',
      role: 'crew',
      groupId: 'grp_audio',
      tagIds: ['foh'],
    });
  });
});
