// Sections are matched by `type`, not `id` — ids are freshly minted per version.
import type {
  BacklineSpec,
  CateringMenu,
  FieldChange,
  FOHOutput,
  InputChannel,
  LodgingSpec,
  MonitorMix,
  RiderImport,
  RiderSection,
  RiderSectionType,
  RoomingEntry,
} from '@/types';

export interface SectionVersionDiff {
  type: RiderSectionType;
  label: string;
  changes: FieldChange[];
}

export interface RiderVersionDiff {
  addedSections: { type: RiderSectionType; label: string }[];
  removedSections: { type: RiderSectionType; label: string }[];
  sectionDiffs: SectionVersionDiff[];
}

function fmt(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function diffScalar(rowLabel: string, field: string, before: unknown, after: unknown, out: FieldChange[]) {
  const b = fmt(before);
  const a = fmt(after);
  if (b !== a) out.push({ rowLabel, field, before: b, after: a });
}

function diffList<T>(
  field: string,
  before: T[] | undefined,
  after: T[] | undefined,
  keyFn: (t: T, i: number) => string,
  rowLabelFn: (t: T) => string,
  out: FieldChange[],
) {
  const b = before ?? [];
  const a = after ?? [];
  const bMap = new Map(b.map((x, i) => [keyFn(x, i), x]));
  const aMap = new Map(a.map((x, i) => [keyFn(x, i), x]));

  for (const [key, av] of aMap) {
    if (!bMap.has(key)) {
      out.push({ rowLabel: rowLabelFn(av), field: `${field} (added)`, before: '', after: fmt(av) });
    }
  }
  for (const [key, bv] of bMap) {
    if (!aMap.has(key)) {
      out.push({ rowLabel: rowLabelFn(bv), field: `${field} (removed)`, before: fmt(bv), after: '' });
    }
  }
  for (const [key, av] of aMap) {
    const bv = bMap.get(key);
    if (bv !== undefined && fmt(bv) !== fmt(av)) {
      out.push({ rowLabel: rowLabelFn(av), field, before: fmt(bv), after: fmt(av) });
    }
  }
}

function diffSectionPayload(a: RiderSection, b: RiderSection): FieldChange[] {
  const out: FieldChange[] = [];
  const label = b.title?.trim() || a.title?.trim() || b.type;

  diffScalar(label, 'Title', a.title, b.title, out);
  diffScalar(label, 'Free text', a.freeText, b.freeText, out);
  diffScalar(label, 'Free text (EN)', a.freeTextEn, b.freeTextEn, out);

  if (a.inputList || b.inputList) {
    diffList<InputChannel>(
      'Input list row',
      a.inputList,
      b.inputList,
      (r) => String(r.channelNumber),
      (r) => `Ch ${r.channelNumber} — ${r.source}`,
      out,
    );
  }
  if (a.monitorMix || b.monitorMix) {
    diffList<MonitorMix>(
      'Monitor mix row',
      a.monitorMix,
      b.monitorMix,
      (r, i) => r.outputs || String(i),
      (r) => `Mix ${r.outputs} — ${r.mixName}`,
      out,
    );
  }
  if (a.fohOutputs || b.fohOutputs) {
    diffList<FOHOutput>(
      'FOH output row',
      a.fohOutputs,
      b.fohOutputs,
      (r, i) => r.outputNumber || String(i),
      (r) => `Out ${r.outputNumber} — ${r.source}`,
      out,
    );
  }
  if (a.backline || b.backline) {
    const ab = a.backline as BacklineSpec | undefined;
    const bb = b.backline as BacklineSpec | undefined;
    diffScalar(label, 'Backline spec', ab, bb, out);
  }
  if (a.lodging || b.lodging) {
    const al = a.lodging as LodgingSpec | undefined;
    const bl = b.lodging as LodgingSpec | undefined;
    diffList<RoomingEntry>(
      'Rooming entry',
      al?.roomingList,
      bl?.roomingList,
      (r) => String(r.roomNumber),
      (r) => `Room ${r.roomNumber} (${r.roomType})`,
      out,
    );
    diffScalar(label, 'Total rooms', al?.totalRooms, bl?.totalRooms, out);
    diffScalar(label, 'Total occupants', al?.totalOccupants, bl?.totalOccupants, out);
    diffScalar(label, 'Hotel requirements', al?.hotelRequirements, bl?.hotelRequirements, out);
  }
  if (a.catering || b.catering) {
    diffList<CateringMenu>(
      'Catering menu',
      a.catering?.menus,
      b.catering?.menus,
      (m) => `${m.room}|${m.menuTime}`,
      (m) => `${m.room} (${m.menuTime})`,
      out,
    );
    diffScalar(label, 'General requirements', a.catering?.generalRequirements, b.catering?.generalRequirements, out);
  }

  return out;
}

/** Section-array-only diff — the shared engine behind `diffRiderVersions`
 *  (two full `RiderImport`s) and the rider-review round diff (two section
 *  snapshots, no enclosing `RiderImport` needed). */
export function diffSections(a: RiderSection[], b: RiderSection[]): RiderVersionDiff {
  const aByType = new Map(a.map((s) => [s.type, s]));
  const bByType = new Map(b.map((s) => [s.type, s]));

  const addedSections = b
    .filter((s) => !aByType.has(s.type))
    .map((s) => ({ type: s.type, label: s.title?.trim() || s.type }));
  const removedSections = a
    .filter((s) => !bByType.has(s.type))
    .map((s) => ({ type: s.type, label: s.title?.trim() || s.type }));

  const sectionDiffs: SectionVersionDiff[] = [];
  for (const [type, bSection] of bByType) {
    const aSection = aByType.get(type);
    if (!aSection) continue;
    const changes = diffSectionPayload(aSection, bSection);
    if (changes.length > 0) {
      sectionDiffs.push({ type, label: bSection.title?.trim() || aSection.title?.trim() || type, changes });
    }
  }

  return { addedSections, removedSections, sectionDiffs };
}

export function diffRiderVersions(a: RiderImport, b: RiderImport): RiderVersionDiff {
  return diffSections(a.sections, b.sections);
}
