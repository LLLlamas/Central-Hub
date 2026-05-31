import { describe, expect, it } from 'vitest';
import {
  parseTocEntries,
  findHeadingPages,
  isPlotPage,
  classifyTocTitle,
} from '@/lib/pdfCore.mjs';
import type { PPage } from '@/lib/pdfCore.mjs';

// Helpers â€” synthesize a PItem at a sensible position.
const item = (text: string, x = 70, y = 700, h = 12) => ({ text, x, y, w: text.length * 6, h });

// A page where every TOC row is laid out as separate "N." + "Title" items at
// the same y-coordinate, mirroring the real rider's PDF layout.
function tocPage(num: number, entries: Array<[number, string]>): PPage {
  const items = entries.flatMap(([n, title], i) => {
    const y = 700 - i * 18;
    return [item(`${n}.`, 75, y), item(title, 95, y)];
  });
  return { num, items };
}

function bodyPage(num: number, headings: string[]): PPage {
  const items = headings.map((h, i) => item(h, 57, 600 - i * 20));
  return { num, items };
}

describe('parseTocEntries', () => {
  it('detects a 14-row TOC and returns entries in Â§N order', () => {
    const toc = tocPage(2, [
      [1, 'Intro'], [2, 'Notas'], [3, 'Permisos'], [4, 'Soporte, Escenario'],
      [5, 'Especificaciones Tecnicas'], [6, 'Input - Output'], [7, 'Stage plot'],
      [8, 'Iluminacion y Lightplot'], [9, 'Backline'], [10, 'Soundcheck'],
      [11, 'Transportacion'], [12, 'Hospedaje'], [13, 'Camerinos'], [14, 'Catering'],
    ]);
    const cover: PPage = { num: 1, items: [item('Tech Rider', 200, 700, 20)] };
    const entries = parseTocEntries([cover, tocPage(2, [
      [1, 'Intro'], [2, 'Notas'], [3, 'Permisos'], [4, 'Soporte, Escenario'],
      [5, 'Especificaciones Tecnicas'], [6, 'Input - Output'], [7, 'Stage plot'],
      [8, 'Iluminacion y Lightplot'], [9, 'Backline'], [10, 'Soundcheck'],
      [11, 'Transportacion'], [12, 'Hospedaje'], [13, 'Camerinos'], [14, 'Catering'],
    ])]);
    void toc;
    expect(entries.length).toBe(14);
    expect(entries[0].num).toBe(1);
    expect(entries[13].num).toBe(14);
    expect(entries[5].title).toBe('Input - Output');
    // tocPage is attached as a non-enumerable hint for downstream callers.
    expect((entries as { tocPage?: number }).tocPage).toBe(2);
  });

  it('returns [] when no TOC-like rows are found', () => {
    const random: PPage = { num: 1, items: [item('Lorem ipsum'), item('dolor sit amet')] };
    expect(parseTocEntries([random])).toEqual([]);
  });

  it('rejects a page that has < 5 numbered rows', () => {
    const sparse = tocPage(1, [[1, 'A'], [2, 'B'], [3, 'C']]);
    expect(parseTocEntries([sparse]).length).toBe(0);
  });
});

describe('findHeadingPages', () => {
  it('maps each TOC entry to the page where its body heading appears', () => {
    const tocEntries = Object.assign(
      [
        { num: 1, title: 'Intro' },
        { num: 2, title: 'Notas' },
        { num: 6, title: 'Input - Output' },
      ],
      { tocPage: 2 },
    );
    const pages: PPage[] = [
      { num: 1, items: [item('Cover')] },
      tocPage(2, [[1, 'Intro'], [2, 'Notas'], [6, 'Input - Output']]),
      bodyPage(3, ['1- INTRO']),
      bodyPage(4, ['2- NOTAS']),
      bodyPage(7, ['6- INPUT Y OUTPUT']),
    ];
    const map = findHeadingPages(pages, tocEntries);
    expect(map.get(1)).toBe(3);
    expect(map.get(2)).toBe(4);
    expect(map.get(6)).toBe(7);
  });

  it('excludes the TOC page itself from loose-pass matches', () => {
    // A rider that uses "N. Title" headings (looseDotPass). The TOC page
    // shouldn't be picked up as Â§1's start.
    const tocEntries = Object.assign(
      [{ num: 1, title: 'Intro' }, { num: 2, title: 'Notas' }],
      { tocPage: 2 },
    );
    const pages: PPage[] = [
      bodyPage(1, ['Cover page']),
      tocPage(2, [[1, 'Intro'], [2, 'Notas']]),
      { num: 3, items: [item('1. Intro', 70, 600), item('Body text body text body text body text', 70, 580)] },
    ];
    const map = findHeadingPages(pages, tocEntries);
    expect(map.get(1)).toBe(3);
  });
});

describe('isPlotPage', () => {
  it('flags pages with very few text items as plot pages', () => {
    expect(isPlotPage({ num: 1, items: [item('header'), item('footer')] })).toBe(true);
  });

  it('does not flag text-rich pages', () => {
    const items = Array.from({ length: 20 }, (_, i) => item(`row ${i}`));
    expect(isPlotPage({ num: 1, items })).toBe(false);
  });
});

describe('classifyTocTitle', () => {
  it('routes Spanish titles to the expected RiderSectionType', () => {
    expect(classifyTocTitle('Intro')).toBe('cover_and_contacts');
    expect(classifyTocTitle('Notas')).toBe('production_control');
    expect(classifyTocTitle('Permisos')).toBe('permits');
    expect(classifyTocTitle('Soporte, Escenario')).toBe('stage_specs');
    expect(classifyTocTitle('Especificaciones TÃ©cnicas')).toBe('audio_pa');
    expect(classifyTocTitle('Input - Output')).toBe('input_list');
    expect(classifyTocTitle('Stage plot')).toBe('stage_plot');
    expect(classifyTocTitle('IluminaciÃ³n y Lightplot')).toBe('lighting_equipment');
    expect(classifyTocTitle('Backline')).toBe('backline');
    expect(classifyTocTitle('Soundcheck')).toBe('soundcheck');
    expect(classifyTocTitle('TransportaciÃ³n')).toBe('ground_transport');
    expect(classifyTocTitle('Hospedaje')).toBe('lodging');
    expect(classifyTocTitle('Camerinos')).toBe('dressing_rooms');
    expect(classifyTocTitle('Catering')).toBe('catering');
  });

  it('falls back to "other" for unknown titles', () => {
    expect(classifyTocTitle('Press & Marketing')).toBe('other');
  });
});
