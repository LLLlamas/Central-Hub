/**
 * Canonical rider section index for the Elsa y Elmar tech rider.
 * Maps section number (§N) → page range so any §N reference in the UI can
 * deep-link to the right page of the PDF (`#page=N` is a built-in browser
 * PDF anchor).
 *
 * Also exposes type→section mapping so we can resolve `RiderSectionType`
 * values (e.g. 'stage_specs') to the same section record.
 */

export const RIDER_PDF_PATH =
  '/RIDER%20ELSA%20Y%20ELMAR%202025%20-FULL%20BAND%20-%20Venue%20Shows%20030725.pdf';

export interface RiderSectionInfo {
  num: number;
  name: string;
  pages: number[];
}

export const RIDER_SECTIONS: RiderSectionInfo[] = [
  { num: 1,  name: 'Cover & contacts',    pages: [1, 2] },
  { num: 2,  name: 'Production control',  pages: [2, 3] },
  { num: 3,  name: 'Permits',             pages: [3] },
  { num: 4,  name: 'Stage specs',         pages: [3, 4] },
  { num: 5,  name: 'Audio · PA',          pages: [5, 6] },
  { num: 6,  name: 'Input / Output',      pages: [7, 8, 9, 10] },
  { num: 7,  name: 'Stage plot',          pages: [11] },
  { num: 8,  name: 'Lighting equipment',  pages: [12, 13, 14, 15, 16, 17] },
  { num: 9,  name: 'Backline',            pages: [18] },
  { num: 10, name: 'Soundcheck',          pages: [19] },
  { num: 11, name: 'Transport',           pages: [19, 20] },
  { num: 12, name: 'Lodging',             pages: [20] },
  { num: 13, name: 'Dressing rooms',      pages: [21] },
  { num: 14, name: 'Catering',            pages: [22, 23, 24, 25, 26, 27] },
];

/** RiderSectionType (from types/index.ts) → §N. */
const TYPE_TO_NUM: Record<string, number> = {
  cover_and_contacts: 1,
  production_control: 2,
  permits: 3,
  stage_specs: 4,
  audio_pa: 5,
  audio_monitors: 5,
  input_list: 6,
  output_patch: 6,
  stage_plot: 7,
  lighting_equipment: 8,
  lighting_plot: 8,
  backline: 9,
  soundcheck: 10,
  ground_transport: 11,
  air_transport: 11,
  lodging: 12,
  dressing_rooms: 13,
  catering: 14,
};

export function getRiderSection(
  numOrType: number | string,
): RiderSectionInfo | undefined {
  if (typeof numOrType === 'number') {
    return RIDER_SECTIONS.find((s) => s.num === numOrType);
  }
  const num = TYPE_TO_NUM[numOrType];
  return num ? getRiderSection(num) : undefined;
}

export function riderPageUrl(pages: number[] | undefined): string {
  const first = pages && pages.length > 0 ? pages[0] : 1;
  return `${RIDER_PDF_PATH}#page=${first}`;
}
