import { describe, it, expect } from 'vitest';
import { resolveVisibility, canSee, canEdit, vis } from '@/lib/visibility';
import type { CurrentUser } from '@/types';

const user: CurrentUser = {
  tourPersonId: 'p1',
  name: 'Tester',
  role: 'Audio',
  groupId: 'g_audio',
  tagIds: ['t_foh'],
};

describe('resolveVisibility â€” most specific wins', () => {
  it('falls back to the default level', () => {
    expect(resolveVisibility({ default: 'sees' }, user)).toBe('sees');
  });

  it('a group override beats the default', () => {
    expect(
      resolveVisibility({ default: 'blocked', groups: { g_audio: 'sees' } }, user),
    ).toBe('sees');
  });

  it('a tag override beats a group override', () => {
    expect(
      resolveVisibility(
        { default: 'blocked', groups: { g_audio: 'sees' }, tags: { t_foh: 'owns' } },
        user,
      ),
    ).toBe('owns');
  });

  it('a person override beats a tag override', () => {
    expect(
      resolveVisibility(
        { default: 'sees', tags: { t_foh: 'owns' }, persons: { p1: 'blocked' } },
        user,
      ),
    ).toBe('blocked');
  });

  it('ignores overrides that do not apply to this user', () => {
    expect(
      resolveVisibility({ default: 'sees', groups: { g_lighting: 'blocked' } }, user),
    ).toBe('sees');
  });
});

describe('canSee / canEdit', () => {
  it('canSee is true for sees and owns, false for blocked', () => {
    expect(canSee({ default: 'sees' }, user)).toBe(true);
    expect(canSee({ default: 'owns' }, user)).toBe(true);
    expect(canSee({ default: 'blocked' }, user)).toBe(false);
  });

  it('canEdit is true only for owns', () => {
    expect(canEdit({ default: 'owns' }, user)).toBe(true);
    expect(canEdit({ default: 'sees' }, user)).toBe(false);
    expect(canEdit({ default: 'blocked' }, user)).toBe(false);
  });
});

describe('vis constructors', () => {
  it('vis.everyone sets the default', () => {
    expect(vis.everyone('owns')).toEqual({ default: 'owns' });
  });

  it('vis.onlyGroups blocks by default and grants the listed groups', () => {
    expect(vis.onlyGroups(['g_audio', 'g_lighting'], 'sees')).toEqual({
      default: 'blocked',
      groups: { g_audio: 'sees', g_lighting: 'sees' },
    });
  });
});
