import { describe, it, expect } from 'vitest';
import { diffRiderVersions } from '@/lib/riderDiff';
import { createRiderDraft } from '@/lib/riderBuilder';
import type { RiderImport, RiderSection } from '@/types';

function section(overrides: Partial<RiderSection>): RiderSection {
  return {
    id: 'sec_1',
    type: 'catering',
    status: 'extracted',
    ...overrides,
  };
}

function rider(sections: RiderSection[]): RiderImport {
  return {
    id: 'ri_1',
    uploadedAt: '2026-01-01T00:00',
    uploadedBy: 'Tour Manager',
    status: 'review',
    origin: 'authored',
    revision: 1,
    sections,
  };
}

describe('diffRiderVersions', () => {
  it('reports no diffs for two identical versions', () => {
    const draft = createRiderDraft('Tour Manager');
    const diff = diffRiderVersions(draft, draft);
    expect(diff.addedSections).toEqual([]);
    expect(diff.removedSections).toEqual([]);
    expect(diff.sectionDiffs).toEqual([]);
  });

  it('detects an added section', () => {
    const a = rider([section({ id: 'sec_1', type: 'catering' })]);
    const b = rider([
      section({ id: 'sec_1', type: 'catering' }),
      section({ id: 'sec_2', type: 'lodging', title: 'Lodging' }),
    ]);
    const diff = diffRiderVersions(a, b);
    expect(diff.addedSections).toEqual([{ type: 'lodging', label: 'Lodging' }]);
    expect(diff.removedSections).toEqual([]);
  });

  it('detects a removed section', () => {
    const a = rider([
      section({ id: 'sec_1', type: 'catering' }),
      section({ id: 'sec_2', type: 'lodging', title: 'Lodging' }),
    ]);
    const b = rider([section({ id: 'sec_1', type: 'catering' })]);
    const diff = diffRiderVersions(a, b);
    expect(diff.removedSections).toEqual([{ type: 'lodging', label: 'Lodging' }]);
    expect(diff.addedSections).toEqual([]);
  });

  it('detects a changed title', () => {
    const a = rider([section({ id: 'sec_1', type: 'catering', title: 'Catering' })]);
    const b = rider([section({ id: 'sec_1', type: 'catering', title: 'Catering & Snacks' })]);
    const diff = diffRiderVersions(a, b);
    expect(diff.sectionDiffs).toHaveLength(1);
    expect(diff.sectionDiffs[0].changes).toContainEqual({
      rowLabel: 'Catering & Snacks',
      field: 'Title',
      before: 'Catering',
      after: 'Catering & Snacks',
    });
  });

  it('detects a changed freeText', () => {
    const a = rider([section({ id: 'sec_1', type: 'permits', freeText: 'Old text' })]);
    const b = rider([section({ id: 'sec_1', type: 'permits', freeText: 'New text' })]);
    const diff = diffRiderVersions(a, b);
    expect(diff.sectionDiffs[0].changes).toContainEqual({
      rowLabel: 'permits',
      field: 'Free text',
      before: 'Old text',
      after: 'New text',
    });
  });

  it('detects a changed list field (input list row)', () => {
    const a = rider([
      section({
        id: 'sec_1',
        type: 'input_list',
        inputList: [{ channelNumber: 1, source: 'Kick', micOrDi: 'Beta 52' }],
      }),
    ]);
    const b = rider([
      section({
        id: 'sec_1',
        type: 'input_list',
        inputList: [{ channelNumber: 1, source: 'Kick', micOrDi: 'D6' }],
      }),
    ]);
    const diff = diffRiderVersions(a, b);
    const change = diff.sectionDiffs[0].changes.find((c) => c.field === 'Input list row');
    expect(change).toBeTruthy();
    expect(change?.rowLabel).toBe('Ch 1 — Kick');
    expect(change?.before).toContain('Beta 52');
    expect(change?.after).toContain('D6');
  });

  it('reports added/removed rows within a shared list field', () => {
    const a = rider([
      section({
        id: 'sec_1',
        type: 'input_list',
        inputList: [{ channelNumber: 1, source: 'Kick', micOrDi: 'Beta 52' }],
      }),
    ]);
    const b = rider([
      section({
        id: 'sec_1',
        type: 'input_list',
        inputList: [
          { channelNumber: 1, source: 'Kick', micOrDi: 'Beta 52' },
          { channelNumber: 2, source: 'Snare', micOrDi: 'SM57' },
        ],
      }),
    ]);
    const diff = diffRiderVersions(a, b);
    const added = diff.sectionDiffs[0].changes.find((c) => c.field === 'Input list row (added)');
    expect(added?.rowLabel).toBe('Ch 2 — Snare');
  });
});
