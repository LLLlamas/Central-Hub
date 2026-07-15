import { describe, it, expect } from 'vitest';
import {
  RIDER_TOC_TEMPLATE,
  createRiderDraft,
  normalizeRider,
  sectionKey,
} from '@/lib/riderBuilder';
import type { RiderImport, RiderSection } from '@/types';

describe('RIDER_TOC_TEMPLATE', () => {
  it('has 14 entries', () => {
    expect(RIDER_TOC_TEMPLATE).toHaveLength(14);
  });

  it('retitles the stage_plot entry to "Stage design"', () => {
    const entry = RIDER_TOC_TEMPLATE.find((e) => e.type === 'stage_plot');
    expect(entry?.title).toBe('Stage design');
  });

  it('keeps every other title as the English category label', () => {
    const catering = RIDER_TOC_TEMPLATE.find((e) => e.type === 'catering');
    expect(catering?.title).toBe('Catering');
    const lodging = RIDER_TOC_TEMPLATE.find((e) => e.type === 'lodging');
    expect(lodging?.title).toBe('Lodging');
  });
});

describe('createRiderDraft', () => {
  const draft = createRiderDraft('Tour Manager');

  it('produces exactly 14 sections', () => {
    expect(draft.sections).toHaveLength(14);
  });

  it('gives every section a unique id', () => {
    const ids = new Set(draft.sections.map((s) => s.id));
    expect(ids.size).toBe(14);
    for (const s of draft.sections) expect(s.id).toBeTruthy();
  });

  it('orders tocIndex 1 through 14', () => {
    expect(draft.sections.map((s) => s.tocIndex)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
  });

  it('carries the retitled "Stage design" entry through', () => {
    const stage = draft.sections.find((s) => s.type === 'stage_plot');
    expect(stage?.title).toBe('Stage design');
  });

  it('marks the rider authored, in review, revision 1', () => {
    expect(draft.origin).toBe('authored');
    expect(draft.status).toBe('review');
    expect(draft.revision).toBe(1);
    expect(draft.uploadedBy).toBe('Tour Manager');
  });

  it('marks every section pending with no payload fields set', () => {
    for (const s of draft.sections) {
      expect(s.status).toBe('pending');
      expect(s.pages).toBeUndefined();
      expect(s.inputList).toBeUndefined();
      expect(s.freeText).toBeUndefined();
      expect(s.plots).toBeUndefined();
    }
  });

  it('leaves file-derived RiderImport fields undefined', () => {
    expect(draft.filename).toBeUndefined();
    expect(draft.pdfObjectUrl).toBeUndefined();
    expect(draft.pageCount).toBeUndefined();
    expect(draft.sourceLanguage).toBeUndefined();
  });

  it('mints a fresh id each call', () => {
    const other = createRiderDraft('Tour Manager');
    expect(other.id).not.toBe(draft.id);
  });
});

describe('normalizeRider', () => {
  function legacySection(type: RiderSection['type']): RiderSection {
    // Simulate pre-id persisted data: no `id` field at runtime despite the
    // current type saying it's required.
    const { id: _unused, ...rest } = { id: 'placeholder', type, status: 'extracted' as const };
    void _unused;
    return rest as unknown as RiderSection;
  }

  function legacyRider(): RiderImport {
    return {
      id: 'ri_legacy',
      uploadedAt: '2026-01-01T00:00',
      uploadedBy: 'Tour Manager',
      status: 'review',
      revision: 1,
      sections: [
        legacySection('cover_and_contacts'),
        legacySection('stage_specs'),
        legacySection('catering'),
      ],
    } as unknown as RiderImport;
  }

  it('assigns legacy sections an id of `${type}-${index}`', () => {
    const normalized = normalizeRider(legacyRider());
    expect(normalized.sections.map((s) => s.id)).toEqual([
      'cover_and_contacts-0',
      'stage_specs-1',
      'catering-2',
    ]);
  });

  it('defaults origin to "imported" when absent', () => {
    const normalized = normalizeRider(legacyRider());
    expect(normalized.origin).toBe('imported');
  });

  it('leaves an explicit origin untouched', () => {
    const authored = createRiderDraft('Tour Manager');
    const normalized = normalizeRider(authored);
    expect(normalized.origin).toBe('authored');
  });

  it('is idempotent — leaves already-id\'d sections alone', () => {
    const once = normalizeRider(legacyRider());
    const twice = normalizeRider(once);
    expect(twice).toEqual(once);
    expect(twice.sections.map((s) => s.id)).toEqual(once.sections.map((s) => s.id));
  });

  it('does not touch sections that already have an id, even mid-array', () => {
    const rider = legacyRider();
    rider.sections[1] = { ...rider.sections[1], id: 'sec_custom' };
    const normalized = normalizeRider(rider);
    expect(normalized.sections.map((s) => s.id)).toEqual([
      'cover_and_contacts-0',
      'sec_custom',
      'catering-2',
    ]);
  });
});

describe('sectionKey', () => {
  it('returns the id as-is', () => {
    expect(sectionKey({ id: 'sec_abc' })).toBe('sec_abc');
  });

  it('matches the id createRiderDraft assigns', () => {
    const draft = createRiderDraft('Tour Manager');
    expect(sectionKey(draft.sections[0])).toBe(draft.sections[0].id);
  });
});
