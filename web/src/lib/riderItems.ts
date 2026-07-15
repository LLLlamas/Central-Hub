// Pure derivation of "what does the rider ask the venue to provide" as a flat
// list of negotiable line items. No React, no storage I/O — a later phase
// builds a venue-negotiation UI on top of this.
//
// Most section types (cover & contacts, stage specs, transport, lodging, …)
// aren't itemized here — they produce a single `section_ack` snapshot meaning
// "the venue acknowledges this section" rather than line-by-line negotiation.
// Only input_list, backline, and catering sections get broken into individual
// negotiable items today.

import type { RiderItemSnapshot, RiderSection, RiderSectionEdit } from '@/types';

export type { RiderItemSnapshot };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** title falls back to the raw type when the section has no authored/extracted title. */
function sectionTitle(section: RiderSection): string {
  return section.title ?? section.type;
}

/**
 * Numeric qty is used as-is. String qty (e.g. "2 dozen") isn't parsed —
 * requestedQty becomes 1 and the original string is preserved as qtyLabel
 * so the UI can still show "2 dozen" verbatim.
 */
export function parseQty(qty: number | string): { requestedQty: number; qtyLabel?: string } {
  if (typeof qty === 'number') {
    return { requestedQty: qty };
  }
  return { requestedQty: 1, qtyLabel: qty };
}

/**
 * Overlay `sectionEdits` (keyed by RiderSection.id) onto their base sections.
 * Returns a new array — inputs are never mutated.
 */
export function getMergedSections(
  sections: RiderSection[],
  sectionEdits: ReadonlyMap<string, RiderSectionEdit>,
): RiderSection[] {
  return sections.map((section) => {
    const edit = sectionEdits.get(section.id);
    if (!edit) return { ...section };

    const merged: RiderSection = { ...section };
    if (edit.inputList !== undefined) merged.inputList = edit.inputList;
    if (edit.monitorMix !== undefined) merged.monitorMix = edit.monitorMix;
    if (edit.fohOutputs !== undefined) merged.fohOutputs = edit.fohOutputs;
    if (edit.backline !== undefined) merged.backline = edit.backline;
    if (edit.lodging !== undefined) merged.lodging = edit.lodging;
    if (edit.catering !== undefined) merged.catering = edit.catering;
    if (edit.freeText !== undefined) merged.freeText = edit.freeText;
    if (edit.freeTextEn !== undefined) merged.freeTextEn = edit.freeTextEn;
    return merged;
  });
}

function sectionAckItem(section: RiderSection, title: string): RiderItemSnapshot {
  return {
    itemKey: section.id,
    sectionId: section.id,
    sectionType: section.type,
    sectionTitle: title,
    kind: 'section_ack',
    label: title,
    requestedQty: 1,
  };
}

function deriveInputListItems(section: RiderSection, title: string): RiderItemSnapshot[] {
  const items: RiderItemSnapshot[] = [];

  for (const ch of section.inputList ?? []) {
    const micPart = ch.micOrDi ? ` — ${ch.micOrDi}` : '';
    items.push({
      itemKey: `${section.id}::ch${ch.channelNumber}`,
      sectionId: section.id,
      sectionType: section.type,
      sectionTitle: title,
      kind: 'item',
      label: `Ch${ch.channelNumber} ${ch.source}${micPart}`,
      requestedQty: 1,
    });
  }

  for (const mix of section.monitorMix ?? []) {
    items.push({
      itemKey: `${section.id}::mix-${slugify(mix.outputs)}`,
      sectionId: section.id,
      sectionType: section.type,
      sectionTitle: title,
      kind: 'item',
      label: `${mix.mixName} (${mix.type})`,
      requestedQty: 1,
    });
  }

  // fohOutputs intentionally skipped — console patch info, not something the
  // venue needs to physically provide.
  return items;
}

function deriveBacklineItems(section: RiderSection, title: string): RiderItemSnapshot[] {
  const items: RiderItemSnapshot[] = [];
  const backline = section.backline;
  if (!backline) return items;

  const base = {
    sectionId: section.id,
    sectionType: section.type,
    sectionTitle: title,
    kind: 'item' as const,
  };

  if (backline.drums) {
    backline.drums.hardware.forEach((hw, i) => {
      items.push({
        ...base,
        itemKey: `${section.id}::hw${i}`,
        label: hw.item,
        requestedQty: hw.qty,
        notes: hw.excluded && hw.excluded.length > 0 ? `Excluded: ${hw.excluded.join(', ')}` : undefined,
      });
    });

    if (backline.drums.kitOptions.length > 0) {
      items.push({
        ...base,
        itemKey: `${section.id}::kit-options`,
        label: `Drum kit (options: ${backline.drums.kitOptions.join(', ')})`,
        requestedQty: 1,
      });
    }
  }

  if (backline.bass && backline.bass.options.length > 0) {
    const optionsStr = backline.bass.options
      .map((o) => `Option ${o.optionNumber}: ${o.head} / ${o.cab}`)
      .join('; ');
    items.push({
      ...base,
      itemKey: `${section.id}::bass-options`,
      label: `Bass rig (options: ${optionsStr})`,
      requestedQty: 1,
    });
  }

  (backline.guitar ?? []).forEach((g, i) => {
    items.push({
      ...base,
      itemKey: `${section.id}::guitar${i}`,
      label: g.item,
      requestedQty: g.qty,
      notes: g.notes,
    });
  });

  (backline.miscellaneous ?? []).forEach((m, i) => {
    items.push({
      ...base,
      itemKey: `${section.id}::misc${i}`,
      label: m.item,
      requestedQty: m.qty,
      notes: m.notes,
    });
  });

  return items;
}

function deriveCateringItems(section: RiderSection, title: string): RiderItemSnapshot[] {
  const items: RiderItemSnapshot[] = [];
  const menus = section.catering?.menus ?? [];

  menus.forEach((menu, menuIndex) => {
    menu.items.forEach((item, itemIndex) => {
      const { requestedQty, qtyLabel } = parseQty(item.qty);

      const noteParts: string[] = [];
      if (item.notes) noteParts.push(item.notes);
      if (item.brandExcluded && item.brandExcluded.length > 0) {
        noteParts.push(`Excluded: ${item.brandExcluded.join(', ')}`);
      }
      if (item.dietaryTags && item.dietaryTags.length > 0) {
        noteParts.push(`Dietary: ${item.dietaryTags.join(', ')}`);
      }

      items.push({
        itemKey: `${section.id}::menu${menuIndex}-item${itemIndex}-${slugify(item.item)}`,
        sectionId: section.id,
        sectionType: section.type,
        sectionTitle: title,
        kind: 'item',
        label: item.item,
        requestedQty,
        qtyLabel,
        unit: item.unit,
        notes: noteParts.length > 0 ? noteParts.join('. ') : undefined,
      });
    });
  });

  return items;
}

/** Derive the flat negotiable-item list for one (already-merged) section. */
function deriveSectionItems(section: RiderSection): RiderItemSnapshot[] {
  const title = sectionTitle(section);
  switch (section.type) {
    case 'input_list':
      return deriveInputListItems(section, title);
    case 'backline':
      return deriveBacklineItems(section, title);
    case 'catering':
      return deriveCateringItems(section, title);
    default:
      return [sectionAckItem(section, title)];
  }
}

/** Derive the flat negotiable-item list for a set of (already-merged) sections. */
export function deriveRiderItems(sections: RiderSection[]): RiderItemSnapshot[] {
  const items: RiderItemSnapshot[] = [];
  for (const section of sections) {
    items.push(...deriveSectionItems(section));
  }
  return items;
}
