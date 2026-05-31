// Rider fixture for scratch mode.
//
// The scratch-mode rider IS the Elsa y Elmar rider — the same PDF the demo
// tour uses. The mockTour rider section list pre-dates the TOC-driven model
// and over-splits sections (§6 is three rows; §8 is two). Here we collapse it
// to the 14 TOC entries the new review surface expects, hand-authoring the
// titles + tocIndex + endPage fields the parser would otherwise produce.

import { mockTour } from '@/data/mockTour';
import { getNowIso } from '@/lib/today';
import { RIDER_PDF_PATH } from '@/lib/riderSections';
import { renderPlotImagesFromUrl } from '@/lib/pdfParser';
import type { PlotImage, RiderImport, RiderSection, TourPerson } from '@/types';

// Rider/personnel records are plain JSON-safe data — a JSON round-trip is a
// dependency-free deep clone (no Date/Map/Set in these types).
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// Verbatim TOC titles from the rider PDF (Spanish — source language). The
// review UI shows these as-is; English category labels are a fallback.
const TOC_TITLES: Array<{ num: number; title: string; type: RiderSection['type']; pages: number[] }> = [
  { num: 1,  title: 'Intro',                       type: 'cover_and_contacts', pages: [1, 2] },
  { num: 2,  title: 'Notas',                       type: 'production_control', pages: [2, 3] },
  { num: 3,  title: 'Permisos',                    type: 'permits',            pages: [3] },
  { num: 4,  title: 'Soporte, Escenario',          type: 'stage_specs',        pages: [3, 4] },
  { num: 5,  title: 'Especificaciones Técnicas',   type: 'audio_pa',           pages: [5, 6] },
  { num: 6,  title: 'Input - Output',              type: 'input_list',         pages: [7, 8, 9, 10] },
  { num: 7,  title: 'Stage plot',                  type: 'stage_plot',         pages: [11] },
  { num: 8,  title: 'Iluminación y Lightplot',     type: 'lighting_equipment', pages: [12, 13, 14, 15, 16, 17] },
  { num: 9,  title: 'Backline',                    type: 'backline',           pages: [18] },
  { num: 10, title: 'Soundcheck',                  type: 'soundcheck',         pages: [19] },
  { num: 11, title: 'Transportación',              type: 'ground_transport',   pages: [19, 20] },
  { num: 12, title: 'Hospedaje',                   type: 'lodging',            pages: [20] },
  { num: 13, title: 'Camerinos',                   type: 'dressing_rooms',     pages: [21] },
  { num: 14, title: 'Catering',                    type: 'catering',           pages: [22, 23, 24, 25, 26, 27] },
];

const STAGE_PLOT_IMAGES: PlotImage[] = [
  { page: 11, caption: 'Stage plot — page 1', kind: 'stage_plot' },
];

const LIGHT_PLOT_IMAGES: PlotImage[] = [
  { page: 13, caption: 'Lightplot — sheet 1', kind: 'lighting_plot' },
  { page: 14, caption: 'Lightplot — sheet 2', kind: 'lighting_plot' },
  { page: 15, caption: 'Lightplot — sheet 3', kind: 'lighting_plot' },
  { page: 16, caption: 'Lightplot — sheet 4', kind: 'lighting_plot' },
];

/**
 * Collapse the demo's over-split rider sections into one section per TOC
 * entry. §6 inherits inputList + monitorMix + fohOutputs from the three split
 * sections; §8 inherits the lightplot pages as `plots`.
 */
function buildTocSections(): RiderSection[] {
  const src = mockTour.riderImports[0].sections;
  const byType = (...types: RiderSection['type'][]) =>
    src.filter((s) => types.includes(s.type));

  // Pluck the typed payloads from the over-split mock sections.
  const inputSec   = byType('input_list')[0];
  const monSec     = byType('audio_monitors')[0];
  const fohSec     = byType('output_patch')[0];
  const stageSec   = byType('stage_specs')[0];
  const audioSec   = byType('audio_pa')[0];
  const plotSec    = byType('stage_plot')[0];
  const lightSec   = byType('lighting_equipment')[0];
  const backSec    = byType('backline')[0];
  const soundSec   = byType('soundcheck')[0];
  const gtSec      = byType('ground_transport')[0];
  const airSec     = byType('air_transport')[0];
  const lodgeSec   = byType('lodging')[0];
  const dressSec   = byType('dressing_rooms')[0];
  const catSec     = byType('catering')[0];
  const coverSec   = byType('cover_and_contacts')[0];
  const prodSec    = byType('production_control')[0];
  const permSec    = byType('permits')[0];

  const sections: RiderSection[] = TOC_TITLES.map((toc): RiderSection => {
    const endPage = toc.pages[toc.pages.length - 1];
    const base: RiderSection = {
      type: toc.type,
      tocIndex: toc.num,
      title: toc.title,
      pages: toc.pages,
      endPage,
      status: 'extracted',
      language: 'es',
    };
    switch (toc.type) {
      case 'cover_and_contacts':
        return { ...base, status: coverSec?.status ?? 'extracted', confidence: coverSec?.confidence ?? 0.95, freeText: coverSec?.freeText, freeTextEn: coverSec?.freeTextEn };
      case 'production_control':
        return { ...base, status: prodSec?.status ?? 'extracted', confidence: prodSec?.confidence ?? 0.9, freeText: prodSec?.freeText, freeTextEn: prodSec?.freeTextEn };
      case 'permits':
        return { ...base, status: permSec?.status ?? 'extracted', confidence: permSec?.confidence ?? 0.88, freeText: permSec?.freeText, freeTextEn: permSec?.freeTextEn };
      case 'stage_specs':
        return { ...base, status: stageSec?.status ?? 'review', confidence: stageSec?.confidence ?? 0.9, freeText: stageSec?.freeText, freeTextEn: stageSec?.freeTextEn };
      case 'audio_pa':
        return { ...base, status: audioSec?.status ?? 'review', confidence: audioSec?.confidence ?? 0.9, freeText: audioSec?.freeText, freeTextEn: audioSec?.freeTextEn };
      case 'input_list':
        return {
          ...base,
          status: inputSec?.status ?? 'review',
          confidence: inputSec?.confidence ?? 0.9,
          inputList: inputSec?.inputList,
          monitorMix: monSec?.monitorMix,
          fohOutputs: fohSec?.fohOutputs,
        };
      case 'stage_plot':
        return { ...base, status: plotSec?.status ?? 'pending', confidence: plotSec?.confidence ?? 0.78, freeText: plotSec?.freeText, freeTextEn: plotSec?.freeTextEn, plots: STAGE_PLOT_IMAGES };
      case 'lighting_equipment':
        return { ...base, status: lightSec?.status ?? 'review', confidence: lightSec?.confidence ?? 0.85, freeText: lightSec?.freeText, freeTextEn: lightSec?.freeTextEn, plots: LIGHT_PLOT_IMAGES };
      case 'backline':
        return { ...base, status: backSec?.status ?? 'review', confidence: backSec?.confidence ?? 0.9, backline: backSec?.backline };
      case 'soundcheck':
        return { ...base, status: soundSec?.status ?? 'approved', confidence: soundSec?.confidence ?? 0.95, freeText: soundSec?.freeText, freeTextEn: soundSec?.freeTextEn };
      case 'ground_transport':
        // §11 Transportación covers both ground + air in the rider.
        return {
          ...base,
          status: gtSec?.status ?? 'review',
          confidence: gtSec?.confidence ?? 0.9,
          freeText: [gtSec?.freeText, airSec?.freeText].filter(Boolean).join('\n\n'),
          freeTextEn: [gtSec?.freeTextEn, airSec?.freeTextEn].filter(Boolean).join('\n\n'),
        };
      case 'lodging':
        return { ...base, status: lodgeSec?.status ?? 'review', confidence: lodgeSec?.confidence ?? 0.9, lodging: lodgeSec?.lodging };
      case 'dressing_rooms':
        return { ...base, status: dressSec?.status ?? 'review', confidence: dressSec?.confidence ?? 0.88, freeText: dressSec?.freeText, freeTextEn: dressSec?.freeTextEn };
      case 'catering':
        return { ...base, status: catSec?.status ?? 'review', confidence: catSec?.confidence ?? 0.85, catering: catSec?.catering };
      default:
        return base;
    }
  });

  // The trailing "Conflicts & Notes" pseudo-section was removed from the
  // rider-ingest rail (it was overkill at the section-review altitude). The
  // conflict data itself still lives in mockTour and is surfaced by the
  // Tour Overview's ConflictFeed via AppState — only the rail entry is gone.
  return clone(sections);
}

/** A fresh RiderImport for the scratch tour — the demo rider, collapsed to 14 TOC sections. */
export function buildScratchRiderImport(): RiderImport {
  const ri = clone(mockTour.riderImports[0]);
  ri.uploadedBy = 'Tour Manager';
  ri.uploadedAt = getNowIso();
  ri.sections = buildTocSections();
  return ri;
}

/**
 * Walk a RiderImport's sections and populate `PlotImage.dataUrl` (+ width /
 * height) for every plot page by rendering the source PDF. Browser-only —
 * returns the input unchanged in environments without `document`.
 *
 * Used in two places:
 *   - the rider ingest upload handler (after the fixture is built), and
 *   - app boot (to re-derive data URLs that were stripped from localStorage).
 */
export async function hydrateRiderPlotImages(
  ri: RiderImport,
  pdfUrl: string = RIDER_PDF_PATH,
): Promise<RiderImport> {
  const plotPages = new Set<number>();
  for (const s of ri.sections) for (const p of s.plots ?? []) plotPages.add(p.page);
  if (plotPages.size === 0) return ri;
  const rendered = await renderPlotImagesFromUrl(pdfUrl, [...plotPages]);
  if (rendered.size === 0) return ri;
  return {
    ...ri,
    sections: ri.sections.map((s) =>
      s.plots
        ? {
            ...s,
            plots: s.plots.map((p) => {
              const r = rendered.get(p.page);
              return r ? { ...p, dataUrl: r.dataUrl, width: r.width, height: r.height } : p;
            }),
          }
        : s,
    ),
  };
}

/**
 * The personnel the rider names — the band + crew. Excludes the demo Tour
 * Manager (`tp_lorenzo`): the scratch tour already has its own TM.
 */
export function buildScratchRiderPersonnel(): TourPerson[] {
  return clone(mockTour.personnel.filter((p) => p.id !== 'tp_lorenzo'));
}
