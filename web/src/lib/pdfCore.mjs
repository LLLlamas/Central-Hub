// Shared pure-algorithmic helpers for PDF text extraction.
// No pdfjs-dist imports — callers handle worker setup and getDocument.
// Used by both pdfParser.ts (Vite/browser) and parse-rider.mjs (Node CLI).

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTHS = {
  january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
  july:'07', august:'08', september:'09', october:'10', november:'11', december:'12',
};

// Rider section heading patterns — Spanish and English, used for section detection.
// Rules for writing these regexes:
//  - Prefer section-heading-specific terms (§N, "TERRESTRE", "AÉREO") over
//    generic words that can appear anywhere in body text.
//  - "transporte" alone is too broad — it appears in backline sections as
//    "transporte de equipo" (equipment transport). Require it to be paired
//    with a specific qualifier or vehicle term.
//  - "camerino" alone fires on catering sections that say "servir en camerino".
//    Require it to be followed by a room number/role or preceded by § 13.
export const SECTION_HINTS = [
  { type: 'stage_specs',        re: /soporte.*escenario|escenario.*soporte|stage\s*specs?|§\s*4\b/i },
  { type: 'audio_pa',           re: /especificaciones\s*t[eé]cnicas|audio\s*pa|sistema\s*de\s*sonido|§\s*5\b/i },
  { type: 'input_list',         re: /input[\s\/]*output|input\s*list|lista\s*de\s*canales|§\s*6\b|\bCH\s+SOURCE\b/i },
  { type: 'stage_plot',         re: /stage\s*plot|plano\s*de\s*escenario|§\s*7\b/i },
  { type: 'lighting_equipment', re: /iluminaci[oó]n|lightplot|lighting|§\s*8\b/i },
  { type: 'backline',           re: /backline|§\s*9\b/i },
  { type: 'soundcheck',         re: /soundcheck|§\s*10\b/i },
  // ground_transport: require vehicle terms or §11 — NOT bare "transporte" which
  // appears in backline sections as "transporte de equipo".
  { type: 'ground_transport',   re: /§\s*11\b|transporte\s+(?:terrestre|local|nocturno|de\s+personal)|sprinter|\bvan\s*\d{1,2}\b.*pax|autob[uú]s\s+\d|renta\s+de\s+(?:van|sprinter|veh)/i },
  // air_transport: flight-specific terms only.
  { type: 'air_transport',      re: /transporte\s+a[eé]r[eo]|vuelos?\s+(?:directos?|nacionales?|internacionales?)|boletos?\s+de\s+avi[oó]n|aerol[íi]nea|pasajes?\s+a[eé]reos?|air\s+transport/i },
  { type: 'lodging',            re: /hospedaje|alojamiento|lodging|rooming|§\s*12\b/i },
  // dressing_rooms: "camerino" alone fires on catering text ("servir en camerino").
  // Require §13, room number/role, or explicit "requerimientos de camerino" phrasing.
  { type: 'dressing_rooms',     re: /§\s*13\b|camerino\s*(?:0?[0-9]|\d{2})|camerino\s+(?:artista|banda|m[uú]sicos?|crew|producci[oó]n)|dressing\s+room(?:s|\s+require|\s+\d)/i },
  { type: 'catering',           re: /catering|§\s*14\b/i },
];

// Column header aliases for input-list table detection.
// Keys must be lowercase. Longer keys (≥5 chars) also participate in prefix matching
// to handle pdfjs-dist's accented-character fragmentation (e.g. "Descripci ó n").
export const COL_ALIAS = {
  ch: 'ch', '#': 'ch', canal: 'ch', no: 'ch', num: 'ch', 'n°': 'ch',
  source: 'source', fuente: 'source', instrumento: 'source',
  descripci: 'source', 'descripción': 'source', 'descripcion': 'source',
  'mic/di': 'mic', mic: 'mic', di: 'mic', micr: 'mic',
  'micrófono': 'mic', 'microfono': 'mic', micro: 'mic',
  stand: 'stand', pie: 'stand', atril: 'stand', soporte: 'stand',
  '48v': 'phantom', phantom: 'phantom', '48': 'phantom',
  insert: 'insert', inserto: 'insert',
  sub: 'sub',
  notes: 'notes', notas: 'notes', obs: 'notes',
  observaciones: 'notes', observaci: 'notes',
};

export const STAND_MAP = {
  boom: 'boom', 'short boom': 'short_boom', 'mini boom': 'mini_boom',
  'tall boom': 'tall_boom', straight: 'straight', clamp: 'clamp',
  none: 'none', mini: 'mini_boom', corta: 'short_boom', alta: 'tall_boom',
};

export const MONITOR_TYPE_MAP = {
  iem: 'in_ear_stereo', 'in-ear': 'in_ear_stereo', 'in ear': 'in_ear_stereo',
  wedge: 'wedge', 'side fill': 'side_fill', sidefill: 'side_fill',
  'drum fill': 'drum_fill',
};

export const ROOM_TYPE_MAP = {
  'junior suite': 'junior_suite', suite: 'suite',
  single: 'single', sencilla: 'single', individual: 'single',
  double: 'double', doble: 'double', twin: 'twin',
};

// ─── Row / column helpers ─────────────────────────────────────────────────────

/** Group text items into visual rows by y-coordinate proximity. PDF y=0 = bottom-left. */
export function groupRows(items, yTol = 4) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - cur[0].y) <= yTol) {
      cur.push(sorted[i]);
    } else {
      rows.push(cur.sort((a, b) => a.x - b.x));
      cur = [sorted[i]];
    }
  }
  rows.push(cur.sort((a, b) => a.x - b.x));
  return rows;
}

/** Join all items in a row into a single trimmed string. */
export function rowText(row) {
  return row.map(i => i.text).join(' ').trim();
}

/** Build column boundary definitions from a detected header row. */
export function buildColMap(headerRow) {
  return headerRow.map((item, i) => {
    const prevMid = i === 0 ? 0 : Math.round((headerRow[i-1].x + headerRow[i-1].w/2 + item.x + item.w/2) / 2);
    const nextMid = i === headerRow.length - 1 ? 9999 : Math.round((item.x + item.w/2 + headerRow[i+1].x + headerRow[i+1].w/2) / 2);
    return { label: item.text.trim(), minX: prevMid - 5, maxX: nextMid + 5 };
  });
}

/** Assign each item in a row to its column bucket by x-position. */
export function assignCols(row, cols) {
  const out = Object.fromEntries(cols.map(c => [c.label, '']));
  for (const item of row) {
    const col = cols.find(c => item.x >= c.minX && item.x < c.maxX);
    if (col) out[col.label] = (out[col.label] + ' ' + item.text).trim();
  }
  return out;
}

/**
 * Offset y-coordinates so items from different PDF pages don't collide in groupRows.
 * Earlier pages get higher y offsets so they sort first in groupRows's descending sort.
 */
export function multiPageItems(sPages) {
  return sPages.flatMap((p, pi) =>
    p.items.map(item => ({ ...item, y: item.y + (sPages.length - 1 - pi) * 10000 }))
  );
}

// ─── Page text helpers ────────────────────────────────────────────────────────

/** Extract heading-candidate items: large height or all-caps short text. */
export function headingItems(page) {
  return page.items.filter(i =>
    i.h >= 10 || (i.text.length < 60 && i.text === i.text.toUpperCase() && i.text.trim().length > 3)
  );
}

/** Join all items on a page into newline-separated lines. */
export function pageText(page) {
  return groupRows(page.items).map(rowText).join('\n');
}

/** Join text across multiple pages. Pass `nums` to filter by page number. */
export function pagesText(pages, nums) {
  return (nums ? pages.filter(p => nums.includes(p.num)) : pages).map(pageText).join('\n');
}

// ─── Bounded per-page text extraction ─────────────────────────────────────────
// Used to produce one clean, chrome-stripped text block per page inside a
// rider section, with optional clipping above a y-boundary so a section
// doesn't bleed into the next section's heading when both share a page.

/** Repeating chrome strings that show up on every page (artist + doc title). */
const CHROME_PATTERNS = [
  /^(?:RIDER|TECH(?:NICAL)?(?:\s+RIDER)?|FULL\s+BAND|VENUE\s+SHOWS?)\b/i,
  /^\d+\s*\/\s*\d+$/,                // "3 / 27"
  /^\d{1,3}$/,                       // bare page number
];

/**
 * Find the y-coordinate of the next numbered section heading on a page
 * (e.g. "3- PERMISOS" or "3. Permisos"), used to clip a previous section
 * when both share the same physical page. `afterNum` filters to headings
 * whose number is strictly greater than the current section's TOC index.
 * Returns undefined if none found.
 */
export function findNextHeadingY(page, afterNum) {
  const rows = groupRows(page.items, 4);
  let best;
  for (const row of rows) {
    const t = rowText(row).trim();
    const m = t.match(/^(\d{1,2})\s*[.\-:]\s*([A-Za-zÁÉÍÓÚÑáéíóúñ].{1,60})$/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (!Number.isFinite(num) || num <= afterNum) continue;
    const y = row[0]?.y ?? 0;
    if (best === undefined || y > best) best = y;
  }
  return best;
}

/**
 * Find the y-coordinate of a specific numbered heading on a page (e.g. for
 * the section's OWN heading on its start page). Returns undefined if not found.
 * The heading row itself is kept; callers use the y as the "drop above" line
 * for any preceding section's leftover content on the same page.
 */
export function findHeadingY(page, num) {
  const rows = groupRows(page.items, 4);
  for (const row of rows) {
    const t = rowText(row).trim();
    const m = t.match(/^(\d{1,2})\s*[.\-:]\s*([A-Za-zÁÉÍÓÚÑáéíóúñ].{1,60})$/);
    if (!m) continue;
    if (parseInt(m[1], 10) === num) return row[0]?.y ?? 0;
  }
  return undefined;
}

/**
 * Return the per-page text for one page inside a section, with chrome
 * (top header, bottom footer, page numbers, repeated rider title) stripped.
 * Pass `clipAboveY` to drop everything at or above that y-coordinate — used
 * to cut off a previous section when the next section's heading lands on
 * the same page. Empty string when nothing meaningful remains.
 *
 * PDF y=0 is at the bottom-left. Larger y = higher on the page.
 * Thresholds are in PDF points (1pt ≈ 1/72 inch). A standard letter page is
 * 612 × 792pt — we keep margins generous so we don't accidentally cut body
 * rows on shorter pages.
 */
export function extractPageText(page, opts = {}) {
  const { clipAboveY, keepFromY, headerBandPt = 36, footerBandPt = 36 } = opts;
  if (!page.items.length) return '';
  const maxY = page.items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  const pageHeight = Math.max(maxY + headerBandPt, 792);
  const headerCut = pageHeight - headerBandPt;
  const footerCut = footerBandPt;
  const keep = page.items.filter(it => {
    // clipAboveY = y of the next section's heading on this page; everything
    // at or below it belongs to the next section, so drop it.
    if (clipAboveY !== undefined && it.y <= clipAboveY) return false;
    // keepFromY = y of THIS section's heading on its start page; anything
    // above it is the previous section's leftover content, so drop it.
    if (keepFromY !== undefined && it.y > keepFromY) return false;
    if (it.y >= headerCut) return false;
    if (it.y <= footerCut) return false;
    const t = it.text.trim();
    if (!t) return false;
    if (CHROME_PATTERNS.some(re => re.test(t))) return false;
    return true;
  });
  if (!keep.length) return '';
  return groupRows(keep).map(rowText).join('\n').trim();
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Parse "22 September 2025" or "Mon, 22 September 2025" → ISO date "2025-09-22". */
export function parseDateToISO(text) {
  const m = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!m) return undefined;
  const mo = MONTHS[m[2].toLowerCase()];
  if (!mo) return undefined;
  return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
}

/** Average character height of items in a row. */
export function avgHeight(row) {
  return row.length ? row.reduce((s, i) => s + i.h, 0) / row.length : 0;
}

/**
 * Build a lowercase-name → tourPersonId lookup map from a personnel array.
 * Works with any object that has `{ person: { name: string }, id: string }`.
 */
export function personnelNameMap(personnel) {
  return new Map(personnel.map(p => [p.person.name.trim().toLowerCase(), p.id]));
}

/**
 * Sum all "N boletos de avión" mentions in a §11 transport blob.
 * Air tickets only — must be the phrase "boletos de avión" (accent-tolerant,
 * pdfjs sometimes fragments "avión" → "avi ó n"). Bare "pasajes" / "boletos"
 * collides with "20 pasajeros" (van capacity), so this is deliberately strict.
 * Returns undefined when no matches.
 */
export function extractFlightTickets(text) {
  const re = /(\d+)\s*boletos?\s+de\s+avi\s*[óo]?\s*n?\b/gi;
  let total = 0;
  let any = false;
  for (const m of text.matchAll(re)) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n)) { total += n; any = true; }
  }
  return any ? total : undefined;
}

/**
 * Resolve a column header text to a canonical column key via COL_ALIAS.
 * Falls back to prefix-match for fragments like "Descripci" from "Descripción".
 */
export function colAliasLookup(t) {
  if (COL_ALIAS[t]) return COL_ALIAS[t];
  const part = t.split(/\s*\/\s*/)[0];
  if (COL_ALIAS[part]) return COL_ALIAS[part];
  for (const [key, val] of Object.entries(COL_ALIAS)) {
    if (key.length >= 5 && t.startsWith(key)) return val;
  }
  return null;
}

// ─── TOC parser ───────────────────────────────────────────────────────────────
// The new parser is TOC-driven: read the rider's table of contents, find each
// numbered section heading in the body, and use the §N → start-page map to
// produce one review surface per TOC entry. This replaces the old heading-
// regex approach which over-matched and under-segmented.

/**
 * Find a TOC-style "N. Title" or "N - Title" line on a single page.
 * Returns the row collapsed to plain text, paired with the item count
 * (used as a sanity check — TOCs cluster many such entries together).
 */
function tocCandidateRows(page) {
  const rows = groupRows(page.items, 4);
  const out = [];
  for (const row of rows) {
    const text = rowText(row).trim();
    // "1.", "10.", "1 -", "10 -" — number then dot/dash then label.
    const m = text.match(/^(\d{1,2})\s*[.\-]\s+(.{2,80})$/);
    if (m) out.push({ num: parseInt(m[1], 10), title: m[2].trim() });
  }
  return out;
}

/**
 * Detect the TOC page(s) and return its parsed entries in §N order.
 * `tocPage` is set so callers can exclude that page from body-heading searches.
 * Returns { entries: [], tocPage: undefined } if no TOC can be found.
 */
export function parseTocEntries(pages) {
  let best = { score: 0, entries: [], tocPage: undefined };
  for (let i = 0; i < Math.min(pages.length, 5); i++) {
    const cands = tocCandidateRows(pages[i]);
    if (cands.length < 5) continue;
    const nums = cands.map((c) => c.num).sort((a, b) => a - b);
    let monotonic = 0;
    for (let k = 1; k < nums.length; k++) if (nums[k] === nums[k - 1] + 1) monotonic++;
    const score = monotonic + cands.length;
    if (score > best.score) {
      const seen = new Set();
      const deduped = [];
      for (const c of cands.sort((a, b) => a.num - b.num)) {
        if (seen.has(c.num)) continue;
        seen.add(c.num);
        deduped.push(c);
      }
      best = { score, entries: deduped, tocPage: pages[i].num };
    }
  }
  // Backwards-compat: existing call sites expect an array. Attach tocPage
  // as a non-enumerable property so `for…of` and `.length` still work.
  const result = best.entries;
  Object.defineProperty(result, 'tocPage', { value: best.tocPage, enumerable: false });
  return result;
}

/**
 * Locate the body-text heading for each TOC entry by matching the canonical
 * "N- TITLE" / "N. TITLE" form. Returns a Map of §N → start page.
 *
 * Heuristic: scan every page for lines that start with `<num>\s*[.-]\s*<TITLE>`
 * where the title shares a stem with the TOC entry. We keep the *first* match
 * per number (subsequent occurrences would be TOC repeats / cross-references).
 */
export function findHeadingPages(pages, tocEntries) {
  const out = new Map();
  // Stem = first significant word of TOC title (uppercased, accent-stripped),
  // used as the body-heading match anchor. We accept a small Levenshtein-free
  // fuzz: stem prefix match OR known accent variations.
  const stems = new Map();
  for (const t of tocEntries) {
    const stem = t.title
      .replace(/[áàäâã]/gi, 'a').replace(/[éèëê]/gi, 'e')
      .replace(/[íìïî]/gi, 'i').replace(/[óòöôõ]/gi, 'o')
      .replace(/[úùüû]/gi, 'u').replace(/ñ/gi, 'n')
      .toUpperCase().split(/\s+/)[0];
    stems.set(t.num, stem);
  }

  // Body section headings are typically ALL-CAPS and use a dash ("1- INTRO"),
  // while TOC rows are Title Case with a dot ("1. Intro"). Prefer dash+caps
  // strictly; fall back to looser matching only if the strict pass missed
  // entries. This lets §1 INTRO on the same page as the TOC still resolve.
  const strictPass = (line) => line.match(/^(\d{1,2})\s*[-:]\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\-,]{1,60})$/);
  const looseDotPass = (line) => line.match(/^(\d{1,2})\s*\.\s*([A-ZÁÉÍÓÚÑa-záéíóúñ].{1,60})$/);

  const tocPage = tocEntries.tocPage;
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    if (page.num === tocPage) continue;
    const rows = groupRows(page.items, 4);
    for (const row of rows) {
      const text = rowText(row).trim();
      const m = strictPass(text);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      if (out.has(num)) continue;
      const bodyStem = m[2].trim()
        .replace(/[áàäâã]/gi, 'a').replace(/[éèëê]/gi, 'e')
        .replace(/[íìïî]/gi, 'i').replace(/[óòöôõ]/gi, 'o')
        .replace(/[úùüû]/gi, 'u').replace(/ñ/gi, 'n')
        .toUpperCase().split(/\s+/)[0];
      const tocStem = stems.get(num);
      // Accept either a stem prefix match, or fall back to "TOC has this number
      // and we found a numbered heading on this page". The latter is permissive
      // but safe because findHeadingPages only runs after parseTocEntries
      // already confirmed `num` is a real TOC entry.
      if (!tocStem || bodyStem.startsWith(tocStem.slice(0, 4)) || tocStem.startsWith(bodyStem.slice(0, 4))) {
        out.set(num, page.num);
      } else if (!out.has(num)) {
        out.set(num, page.num);
      }
    }
  }

  // Loose fallback for any TOC entries the strict pass missed (e.g. riders
  // that use "N. Title" headings instead of "N- TITLE"). Skip the TOC page
  // so we don't capture the TOC itself.
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    if (page.num === tocPage) continue;
    const rows = groupRows(page.items, 4);
    for (const row of rows) {
      const text = rowText(row).trim();
      const m = looseDotPass(text);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      if (out.has(num)) continue;
      if (!stems.has(num)) continue;
      out.set(num, page.num);
    }
  }
  return out;
}

/**
 * A "plot page" is one where almost all content is rendered as graphics rather
 * than selectable text. Used to mark CAD lightplot / stage-plot pages so the
 * UI shows an image-page reference instead of trying to extract structure.
 *
 * Heuristic: very few meaningful text items (< 15 after stripping header/footer
 * chrome with h < 8). The canonical rider's lightplot pages have 2-3 items;
 * CAD pages with a legend/title block have up to ~12.
 */
export function isPlotPage(page) {
  const meaningful = page.items.filter(i => i.h >= 8);
  return meaningful.length < 15;
}

/**
 * Classify a TOC entry's title (Spanish or English) to a RiderSectionType.
 * Used so the parser routes each TOC entry into the right structured-output
 * extractor where one exists; returns 'other' for free-text-only sections.
 */
export function classifyTocTitle(title) {
  const t = title.toLowerCase()
    .replace(/[áàäâã]/g, 'a').replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i').replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
  if (/^intro\b|introduccion|introduction/.test(t)) return 'cover_and_contacts';
  if (/notas|notes|production\s*control/.test(t)) return 'production_control';
  if (/permis|permit|licen/.test(t)) return 'permits';
  if (/soporte|escenario|stage\s*spec|stage\s*support/.test(t)) return 'stage_specs';
  if (/especifica|specific|technical|tecnic|audio\s*pa/.test(t)) return 'audio_pa';
  if (/input|output|canal|i\/o|i-o/.test(t)) return 'input_list';
  if (/stage\s*plot|plano\s*de\s*escenario/.test(t)) return 'stage_plot';
  if (/ilumin|lightplot|light\s*plot|lighting/.test(t)) return 'lighting_equipment';
  if (/backline/.test(t)) return 'backline';
  if (/soundcheck/.test(t)) return 'soundcheck';
  if (/vuelos|a[eé]r/.test(t)) return 'air_transport';
  if (/terrestre|sprinter|\bvan\b|transport/.test(t)) return 'ground_transport';
  if (/hospedaje|lodging|rooming|alojamiento/.test(t)) return 'lodging';
  if (/camerino|dressing/.test(t)) return 'dressing_rooms';
  if (/catering/.test(t)) return 'catering';
  return 'other';
}
