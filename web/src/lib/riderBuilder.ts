/**
 * Rider-authoring foundation — pure functions for building/normalizing a
 * `RiderImport` that the Tour Manager/PM AUTHOR directly in-app, rather than
 * only ever extracting from an uploaded PDF. The PDF-upload path (`origin:
 * 'imported'`) stays supported as a fallback; this module adds the
 * `origin: 'authored'` path: start from the consensus 14-entry table of
 * contents (same list as `riderFixture.ts` / `riderSections.ts`) and let the
 * user fill it in, add/remove/reorder/rename sections later.
 *
 * No React, no storage I/O — callers (AppState mutators) own persistence.
 */

import { getRiderSection } from '@/lib/riderSections';
import { getNowIso } from '@/lib/today';
import type { ID, RiderImport, RiderSection, RiderSectionType } from '@/types';

// Same 14 section types, in the same order they appear in the Elsa y Elmar
// rider PDF — see `RIDER_SECTIONS` (lib/riderSections.ts), the canonical §N
// page map this list mirrors. Titles are the English category label
// (`getRiderSection(type).name`) since an authored rider has no
// source-language PDF to draw a verbatim title from.
const TOC_TYPES: RiderSectionType[] = [
  'cover_and_contacts',
  'production_control',
  'permits',
  'stage_specs',
  'audio_pa',
  'input_list',
  'stage_plot',
  'lighting_equipment',
  'backline',
  'soundcheck',
  'ground_transport',
  'lodging',
  'dressing_rooms',
  'catering',
];

/**
 * Seed template for a blank authored rider: 14 entries, type + English title.
 * `stage_plot` is retitled "Stage design" — this section is being repurposed
 * from "uploaded PDF stage-plot pages" to "paste a Dropbox link or upload
 * stage photos/video" in a later phase; the type stays `stage_plot` (so
 * existing plot-review code keeps working) but the label changes now.
 */
export const RIDER_TOC_TEMPLATE: Array<{ type: RiderSectionType; title: string }> = TOC_TYPES.map(
  (type) => ({
    type,
    title: type === 'stage_plot' ? 'Stage design' : (getRiderSection(type)?.name ?? type),
  }),
);

function mintId(prefix: string): ID {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** A brand-new authored `RiderImport` — no source file, 14 blank TOC sections. */
export function createRiderDraft(by: string): RiderImport {
  const now = getNowIso();
  const sections: RiderSection[] = RIDER_TOC_TEMPLATE.map((entry, i) => ({
    id: mintId('sec'),
    type: entry.type,
    title: entry.title,
    status: 'pending',
    tocIndex: i + 1,
  }));
  return {
    id: mintId('ri'),
    uploadedAt: now,
    uploadedBy: by,
    status: 'review',
    origin: 'authored',
    sections,
    revision: 1,
  };
}

/**
 * Backward-compat shim for `RiderImport`s persisted before `RiderSection.id`
 * and `RiderImport.origin` existed. Assigns any missing section id as
 * `${type}-${index}` — the exact legacy composite key `RiderIngest.tsx` /
 * `AppState.tsx` used to key `sectionApprovals` / `sectionEdits` /
 * `sectionEditHistory` / `pendingEdits` before section ids existed, so old
 * overlay entries keep resolving. Defaults `origin` to `'imported'`.
 * Idempotent: sections that already have an id are left untouched.
 */
export function normalizeRider(ri: RiderImport): RiderImport {
  return {
    ...ri,
    origin: ri.origin ?? 'imported',
    sections: ri.sections.map((s, i) => (s.id ? s : { ...s, id: `${s.type}-${i}` })),
  };
}

/** Single choke point for the approvals/edits/history overlay key. */
export function sectionKey(s: { id: ID }): string {
  return s.id;
}
