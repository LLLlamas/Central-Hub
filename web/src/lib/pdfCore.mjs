// Shared pure-algorithmic helpers for PDF text extraction.
// No pdfjs-dist imports — callers handle worker setup and getDocument.
// Used by both pdfParser.ts (Vite/browser) and parse-rider.mjs (Node CLI).

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTHS = {
  january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
  july:'07', august:'08', september:'09', october:'10', november:'11', december:'12',
};

// Rider section heading patterns — Spanish and English, used for section detection.
export const SECTION_HINTS = [
  { type: 'stage_specs',        re: /soporte.*escenario|escenario.*soporte|stage\s*specs?|§\s*4\b/i },
  { type: 'audio_pa',           re: /especificaciones\s*t[eé]cnicas|audio\s*pa|sistema\s*de\s*sonido|§\s*5\b/i },
  { type: 'input_list',         re: /input[\s\/]*output|input\s*list|lista\s*de\s*canales|§\s*6\b|\bCH\s+SOURCE\b/i },
  { type: 'stage_plot',         re: /stage\s*plot|plano\s*de\s*escenario|§\s*7\b/i },
  { type: 'lighting_equipment', re: /iluminaci[oó]n|lightplot|lighting|§\s*8\b/i },
  { type: 'backline',           re: /backline|§\s*9\b/i },
  { type: 'soundcheck',         re: /soundcheck|§\s*10\b/i },
  { type: 'ground_transport',   re: /transporte|transportaci[oó]n|§\s*11\b/i },
  { type: 'lodging',            re: /hospedaje|alojamiento|lodging|rooming|§\s*12\b/i },
  { type: 'dressing_rooms',     re: /camerinos|dressing\s*room|§\s*13\b/i },
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
