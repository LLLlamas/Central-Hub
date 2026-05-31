import { describe, expect, it } from 'vitest';
import { extractPageText, findNextHeadingY } from '@/lib/pdfCore.mjs';
import type { PPage } from '@/lib/pdfCore.mjs';

// Synthesize an item at (x, y) with a given height. PDF y=0 is bottom-left,
// so higher y = higher on the page. A typical page height in our fixtures is
// y up to ~800 â€” we match that here so header/footer fractions behave realistically.
const item = (text: string, x = 70, y = 400, h = 11) => ({ text, x, y, w: text.length * 6, h });

describe('extractPageText', () => {
  it('strips top header band and bottom footer / page-number chrome', () => {
    const page: PPage = {
      num: 3,
      items: [
        item('RIDER ELSA Y ELMAR 2025', 60, 790, 9),        // header band
        item('CONTROL DE PRODUCCION', 70, 600, 13),         // body â€” keep
        item('El promotor acepta lo siguiente.', 70, 580),  // body â€” keep
        item('3 / 27', 280, 20),                            // footer page number
        item('3', 290, 12),                                 // bare page number
      ],
    };
    const out = extractPageText(page);
    expect(out).toContain('CONTROL DE PRODUCCION');
    expect(out).toContain('El promotor acepta lo siguiente.');
    expect(out).not.toMatch(/RIDER ELSA/);
    expect(out).not.toMatch(/3 \/ 27/);
    expect(out.trim()).not.toMatch(/^3$/m);
  });

  it('clips above clipAboveY so the next-section heading and rows above are dropped', () => {
    const page: PPage = {
      num: 3,
      items: [
        item('2- NOTAS', 70, 700, 14),                       // Â§2 heading
        item('Body paragraph for Â§2.', 70, 680),             // Â§2 body
        item('3- PERMISOS', 70, 500, 14),                    // Â§3 heading (next section)
        item('Permit body paragraph.', 70, 480),             // Â§3 body
      ],
    };
    // Â§2's clip: keep only items ABOVE Â§3's heading (y > 500).
    const out = extractPageText(page, { clipAboveY: 500 });
    expect(out).toContain('2- NOTAS');
    expect(out).toContain('Body paragraph for Â§2.');
    expect(out).not.toContain('3- PERMISOS');
    expect(out).not.toContain('Permit body paragraph.');
  });

  it('drops empty / whitespace-only items and returns an empty string when nothing remains', () => {
    const blank: PPage = { num: 99, items: [item(' ', 70, 400)] };
    expect(extractPageText(blank)).toBe('');
  });
});

describe('findNextHeadingY', () => {
  it('returns the y of the next numbered heading on the page', () => {
    const page: PPage = {
      num: 3,
      items: [
        item('2- NOTAS', 70, 700, 14),
        item('paragraph', 70, 680),
        item('3- PERMISOS', 70, 500, 14),
      ],
    };
    expect(findNextHeadingY(page, 2)).toBe(500);
  });

  it('ignores headings whose number is less than or equal to the current section', () => {
    const page: PPage = {
      num: 3,
      items: [item('2- NOTAS', 70, 700, 14)],
    };
    expect(findNextHeadingY(page, 2)).toBeUndefined();
    expect(findNextHeadingY(page, 3)).toBeUndefined();
  });
});
