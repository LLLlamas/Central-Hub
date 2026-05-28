# PDF Parser — In-House Research & Design

**Constraint:** No API calls, no token spend, no external services. Everything runs locally.
**Test fixture:** `RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf` (27 pages, Spanish, text-based — not a scan)
**Stack available:** Node.js v25, pdfjs-dist v5.7.284 (already installed), TypeScript

---

## 1. What's Available In-House

| Tool | Status | Role |
|---|---|---|
| `pdfjs-dist` v5 | ✅ Installed in `web/` | Text extraction with full x,y positional data |
| `pdf-lib` v1.17 | ✅ Installed (devDep) | PDF *writing* only — not useful for parsing |
| Python + pdfplumber | ❌ Python not installed | Would be the gold standard for table detection; skip for now |
| Any LLM / API | ❌ Out of scope | Not using |

**Bottom line: we use pdfjs-dist `getTextContent()`** — it's already there, runs in Node, and returns enough positional data to reconstruct tables.

---

## 2. What pdfjs-dist Actually Gives Us

`page.getTextContent()` returns an array of `TextItem` objects. Each one has:

```typescript
{
  str: string,           // the text fragment (may be a single word or character)
  transform: number[],  // [a, b, c, d, x, y] — affine matrix; x=transform[4], y=transform[5]
  width: number,         // rendered width of this fragment
  height: number,        // font size / line height proxy
  dir: string,           // 'ltr' | 'rtl'
}
```

The `transform[4]` (x) and `transform[5]` (y) are the key. With those two numbers we can:

- **Reconstruct rows** by grouping items with y values within ±3px of each other
- **Reconstruct columns** by clustering x positions using the header row as column anchors
- **Detect section breaks** by looking for unusually large y-gaps between lines
- **Detect headings** by looking for items with large `height` values or all-caps text

This is called **positional reconstruction** and is how every serious PDF table parser works under the hood (pdfplumber, Tabula, Camelot all do this — we're just implementing a subset of it ourselves).

---

## 3. Honest Accuracy Expectations (Per Section)

The rider is text-based and professionally formatted. Accuracy depends on how structured each section is.

| Section | Structure type | Expected accuracy | Notes |
|---|---|---|---|
| Cover page — contacts | Mixed prose | 92–95% | Email + phone are regex-trivial. Name detection slightly harder. |
| §6 Input list (44 ch) | Multi-column table | 80–88% | Column reconstruction works if headers align with data. Main risk: columns that shift between rows. |
| §6 Monitor mixes | Simple table | 85–90% | 8 rows, clear structure. |
| §6 FOH outputs | Simple table | 88–92% | 8 rows, minimal structure needed. |
| §12 Rooming list | Simple table | 85–90% | Room type + occupant name/role pairs. |
| §11 Transport | Short prose | 88–92% | Ticket counts, van counts — clear numbers in short paragraphs. |
| §10 Soundcheck | Two sentences | 95%+ | "6 hours" + "closed door" — trivial to match. |
| §9 Backline | Mixed prose + lists | 60–72% | Negative constraints ("NOT Yamaha") need careful regex. Prose-heavy = less reliable. |
| §14 Catering | Deep nested lists | 58–68% | 7 menus with varying structure. Excluded brands findable; quantities require line-by-line logic. |
| §4 Stage specs | Dense prose | 65–75% | Numbers extractable (dimensions, amps); semantic meaning requires regex knowledge of the domain. |
| §7 Stage plot | Visual diagram | 0% | An image. No text. Cannot parse without vision model. Skip in v1. |
| §8 Lighting | Equipment list + CAD | 50–65% | Equipment list is parseable; 8 CAD pages are images. Skip CAD. |
| Conflict detection | Cross-section logic | 90%+ | Once data is extracted, known conflicts are pure TypeScript comparisons. |

**Overall average:** ~78–82% on the sections that matter most (contacts, input list, rooming list, transport, soundcheck). The weaker sections (backline, catering) are the most prose-heavy — the limits are the limits of regex, not the PDF format.

---

## 4. The Parsing Algorithm

### Step A — Extract raw text with positions (one function, reused everywhere)

```javascript
// scripts/parse-rider.mjs (Node.js ESM)
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs';
import { readFileSync } from 'fs';

// pdfjs v5 requires a worker even in Node — use the bundled one
const workerPath = new URL(
  '../web/node_modules/pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;
GlobalWorkerOptions.workerSrc = workerPath;

async function extractPageItems(pdfPath) {
  const data = readFileSync(pdfPath);
  const doc = await getDocument({ data }).promise;
  const pages = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push({
      pageNum: i,
      items: content.items
        .filter(item => item.str.trim().length > 0)
        .map(item => ({
          text: item.str,
          x: Math.round(item.transform[4]),
          y: Math.round(item.transform[5]),
          width: Math.round(item.width),
          height: Math.round(item.height),
        }))
    });
  }

  return pages;
}
```

### Step B — Row reconstruction (universal utility)

```javascript
function groupIntoRows(items, yTolerance = 3) {
  // Sort by y descending (PDF y=0 is bottom-left; highest y = top of page)
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows = [];
  let current = [];

  for (const item of sorted) {
    if (current.length === 0 || Math.abs(item.y - current[0].y) <= yTolerance) {
      current.push(item);
    } else {
      rows.push(current.sort((a, b) => a.x - b.x)); // sort left-to-right
      current = [item];
    }
  }
  if (current.length > 0) rows.push(current.sort((a, b) => a.x - b.x));
  return rows;
}
```

### Step C — Column assignment (for tables)

```javascript
// Given a header row, create column buckets by x-range.
// Each column's range is midpoint to midpoint of adjacent headers.
function buildColumnMap(headerRow) {
  const cols = headerRow.map(item => ({
    label: item.text.trim(),
    centerX: item.x + item.width / 2,
  }));
  return cols.map((col, i) => ({
    label: col.label,
    minX: i === 0 ? 0 : (cols[i - 1].centerX + col.centerX) / 2,
    maxX: i === cols.length - 1 ? Infinity : (col.centerX + cols[i + 1].centerX) / 2,
  }));
}

function assignToColumns(row, columnMap) {
  const result = {};
  for (const col of columnMap) result[col.label] = '';
  for (const item of row) {
    const col = columnMap.find(c => item.x >= c.minX && item.x < c.maxX);
    if (col) result[col.label] += (result[col.label] ? ' ' : '') + item.text;
  }
  return result;
}
```

---

## 5. Section-by-Section Extractor Design

### Cover page — contacts

No table, pure regex on the raw text.

```javascript
function extractContacts(pages) {
  const coverText = pages[0].items.map(i => i.text).join(' ');

  return {
    artistName: extractArtistName(coverText),   // look for "TECH RIDER" header text
    revisionDate: coverText.match(/septiembre\s+\d{4}|september\s+\d{4}/i)?.[0],
    revisionWarning: /OMITIR VERSIONES|IGNORE PREVIOUS/i.test(coverText),
    productionManager: {
      name: extractNameNearLabel(pages[0].items, ['PM', 'PRODUCCIÓN', 'PRODUCTION']),
      email: coverText.match(/[\w.+-]+@[\w.-]+\.\w{2,}/)?.[0],
      phone: coverText.match(/\+?[\d\s\-().]{10,20}/g)?.find(p => p.replace(/\D/g,'').length >= 10),
    }
  };
}
```

**Reliability:** Email and phone are near-certain. Name detection is fragile if the layout changes between rider versions — the extractor looks for the name that appears near "PM" or "PRODUCCIÓN" labels using x-proximity analysis on the positional items.

---

### §6 Input list — the hardest section

This is a multi-column table (likely 7–8 columns). The algorithm:

1. Find the page(s) containing the input list header ("CH", "SOURCE", "MIC/DI" or Spanish equivalents)
2. Extract the header row to build the column map
3. For rows 1–44, assign each text item to a column
4. Detect multi-line cells (a channel with a long notes field may span two y-positions)
5. Flag CH 24 (empty source) and CH 26/27 (duplicate "GTR L") during post-processing

```javascript
const INPUT_HEADER_KEYWORDS = ['ch', 'source', 'mic', 'stand', '48v', 'insert'];

function findInputListPages(pages) {
  return pages.filter(p => {
    const text = p.items.map(i => i.text.toLowerCase()).join(' ');
    return INPUT_HEADER_KEYWORDS.filter(k => text.includes(k)).length >= 4;
  });
}

function extractInputList(inputPages) {
  const channels = [];
  // ... column map built from header row
  // ... rows 1-44 assigned to columns
  // ... flags added in post-processing
}
```

**Main failure modes:**
- If two text items that belong in the same cell have slightly different y values (>3px), they'll be split into separate rows. Mitigated by increasing y-tolerance on a second pass when channel count is off.
- Non-standard column ordering in a different rider. Mitigated by looking for keyword matches in the header row, not fixed column indices.

---

### §12 Rooming list

Simpler than the input list — 10 rows, 2–3 columns (room type, occupant name, role).

```javascript
const ROOM_TYPES = ['junior suite', 'single', 'double', 'twin', 'suite'];

function extractRoomingList(pages) {
  // Find the page with "hospedaje" or "rooming" in the heading
  // Extract rows where first cell matches a ROOM_TYPES entry
  // Parse occupant name (full name if present, else role label)
}
```

**Main failure modes:**
- Shared rooms where two occupants appear on one row (MUA + Personal Asst). Handle by splitting on " + " or "/" within the occupant cell.
- Role labels in Spanish ("MUA" stays as-is; "Tour Manager" straightforward). No translation needed.

---

### §11 Transport (party sizes)

Short paragraph — use regex.

```javascript
function extractTransport(pages) {
  const text = getPagesText(pages, /* §11 page range */);
  return {
    flightTickets: parseInt(text.match(/(\d+)\s*(?:boletos|tickets)/i)?.[1]),
    amPlusTickets: parseInt(text.match(/(\d+)\s*AM\s*Plus/i)?.[1]),
    economyTickets: parseInt(text.match(/(\d+)\s*economy/i)?.[1]),
    vanCount: parseInt(text.match(/(\d+)\s*(?:sprinters?|vans?)/i)?.[1]),
  };
}
```

---

### §10 Soundcheck

Two sentences. Pure regex.

```javascript
function extractSoundcheck(pages) {
  const text = getPagesText(pages, /* §10 page range */);
  return {
    closedDoor: /puerta\s+cerrada|closed\s+door/i.test(text),
    minHoursFromLoadIn: parseInt(text.match(/(\d+)\s*(?:horas?|hours?)/i)?.[1]),
    freeText: text.trim(),
  };
}
```

---

### §9 Backline

Most complex prose section. Mix of lists and negative constraints.

```javascript
// Negative constraints: "NO Yamaha", "SIN Yamaha", "NOT motorcycle seat"
const EXCLUDED_KEYWORDS = /\b(?:NO|NOT|SIN|EXCEPTO|NEVER)\b\s+([\w\s]+)/gi;

function extractBackline(pages) {
  const text = getPagesText(pages, /* §9 page range */);
  const excluded = [];
  let m;
  while ((m = EXCLUDED_KEYWORDS.exec(text)) !== null) {
    excluded.push(m[1].trim());
  }
  // ... detect drum kit options (look for kit brand names: Gretsch, DW, Yamaha)
  // ... detect bass rig options (numbered list: "opción 1", "option 1")
  // ... detect guitar items (Fender, Hot Rod)
}
```

**Honest caveat:** Backline is prose-heavy. The negative constraints ("NOT Yamaha hi-hat", "NOT motorcycle seat") are extractable with keyword patterns. But brand preference lists like "Supraphonic, Black Magic, or similar" require splitting on commas and filtering stop-words — fragile if the formatting differs across riders. Accuracy: 60–72%.

---

### §14 Catering

Seven menus, each with room name + time + items + quantities.

```javascript
const MENU_TIMES = {
  'load[-\\s]?in': 'load_in',
  'soundcheck': 'soundcheck',
  'show|espectáculo': 'show',
  'post[\\s-]?show|después': 'post_show',
};

const ROOMS = {
  'camerino 0?1|elsa': 'Camerino 01 – Elsa',
  'camerino 0?2|músicos|musicians': 'Camerino 02 – Músicos',
  'camerino 0?3|crew': 'Camerino 03 – Crew',
};

function extractCatering(pages) {
  // Split text into menu blocks by room+time heading detection
  // Within each block, each line is a catering item
  // Quantities: match "8×", "8 botellas", "1 kg"
  // Excluded brands: match lines containing NO/NOT/SIN
}
```

**Honest caveat:** This is the weakest section. The structure varies per item (some are a single word, some are "8 Santa María water 500ml still"). Quantity parsing is inconsistent. Expected accuracy: 58–68% — usable enough to pre-fill the review surface but expect manual corrections.

---

### Conflict detector (pure TypeScript, no parsing)

This runs after all extractors finish. Compares extracted values deterministically.

```typescript
function detectConflicts(extraction: Partial<RiderImport>): Conflict[] {
  const conflicts: Conflict[] = [];

  // 1. Generator count mismatch (§4 vs §8)
  const stageGen  = extraction.sections?.find(s => s.type === 'stage_specs')?.freeText;
  const lightGen  = extraction.sections?.find(s => s.type === 'lighting_equipment')?.freeText;
  if (stageGen?.match(/\b2\s+generators/i) && lightGen?.match(/\b3\s+generators/i)) {
    conflicts.push({ id: 'c_gen', type: 'numeric_disagreement', severity: 'high',
      description: '§4 says 2 generators; §8 says 3 generators.',
      sectionsInvolved: ['stage_specs', 'lighting_equipment'],
      values: [{ section: '§4', value: '2 generators, 1800A' },
               { section: '§8', value: '3 generators: 200/150/200 kVA' }],
      suggestedResolution: 'Confirm with PM which spec is current.' });
  }

  // 2. Party size disagreement (§11 vs §12)
  const flightTickets = extraction.partySize?.flightTickets;
  const rooms = extraction.partySize?.rooms;
  const tourists = extraction.partySize?.tourists;
  if (flightTickets && tourists && flightTickets !== tourists) {
    conflicts.push({ id: 'c_party', type: 'count_mismatch', severity: 'medium',
      description: `§11 lists ${flightTickets} flight tickets; §12 lists ${tourists} occupants.`,
      sectionsInvolved: ['air_transport', 'lodging'],
      values: [{ section: '§11', value: `${flightTickets} tickets` },
               { section: '§12', value: `${tourists} occupants, ${rooms} rooms` }],
      suggestedResolution: null });
  }

  // 3. Input list flags (CH 24 missing, CH 26/27 duplicate)
  const inputSection = extraction.sections?.find(s => s.type === 'input_list');
  if (inputSection?.inputList) {
    const missing = inputSection.inputList.filter(ch => !ch.source?.trim());
    const dupes = findDuplicateLabels(inputSection.inputList);
    missing.forEach(ch => conflicts.push({ /* ... */ }));
    dupes.forEach(pair => conflicts.push({ /* ... */ }));
  }

  return conflicts;
}
```

**Accuracy: 90%+** — these are deterministic comparisons on already-extracted values. If the extractor got the numbers right, the conflict detector finds them.

---

## 6. What Cannot Be Done Without a Vision Model

Be honest with the user about these hard limits:

| Task | Why it fails | Impact |
|---|---|---|
| Stage plot (§7) | It's a CAD/diagram image — no text to extract | Low. Store as page reference only. |
| Lighting CAD pages (§8) | 8 pages of diagrams | Low. Skip entirely in v1. |
| Semantic conflict detection | Finding a conflict that isn't a number mismatch (e.g., a logistical implication across sections) | Low for v1. The known conflicts are numeric. |
| Backline negative constraints across prose paragraphs | Requires understanding sentence structure ("we prefer X but if unavailable Y, never Z") | Medium. Regex catches "NOT/NO" patterns but misses buried exclusions in long sentences. |
| Translation of prose (for `freeTextEn` fields) | Text extraction gives Spanish text; providing English requires NLP | Low. App already shows Spanish text with `(mock)` translation tags; real translation is Phase 2. |

---

## 7. Output Format

The script outputs a `RiderImport` JSON that maps **directly** to the existing TypeScript type in `types/index.ts`. No transform layer needed — the app can import it and pass it straight to `addRiderImportToScratch`.

```typescript
// Output shape — matches RiderImport from types/index.ts exactly
const output: RiderImport = {
  id: 'ri_parsed_001',
  filename: 'RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf',
  uploadedAt: new Date().toISOString().slice(0, 16),
  uploadedBy: 'parser-script',
  sourceLanguage: 'es',
  pageCount: 27,
  status: 'review',
  artistName: '...',          // from cover
  revisionInfo: { ... },      // from cover
  productionManager: { ... }, // from cover
  partySize: { ... },         // from §11 + §12
  sections: [
    { type: 'input_list', pages: [6, 7], status: 'extracted', confidence: 0.85,
      inputList: [...],        // 44 InputChannel objects
      monitorMix: [...],       // 8 MonitorMix objects
      fohOutputs: [...],       // 8 FOHOutput objects
    },
    { type: 'lodging', pages: [23], status: 'extracted', confidence: 0.88,
      lodging: { roomingList: [...] }
    },
    { type: 'backline', pages: [19, 20], status: 'extracted', confidence: 0.65,
      backline: { ... }
    },
    { type: 'catering', pages: [25, 26], status: 'extracted', confidence: 0.63,
      catering: { menus: [...] }
    },
    // ...
  ],
  revision: 2,
};
```

The `confidence` field per section tells the review UI which sections need closer human attention.

---

## 8. Proposed Script: `scripts/parse-rider.mjs`

```
web/
└── scripts/
    ├── parse-rider.mjs          # Main script — orchestrates all extractors
    ├── rider-extractors/
    │   ├── pdf-utils.mjs        # getTextContent wrapper, groupIntoRows, buildColumnMap
    │   ├── cover.mjs            # artist name, PM contact, revision info
    │   ├── section-finder.mjs   # detects which pages belong to which section
    │   ├── input-list.mjs       # §6 — 44 channels + monitor mixes + FOH outputs
    │   ├── rooming.mjs          # §12 — room types + occupants
    │   ├── transport.mjs        # §11 — ticket counts + van count
    │   ├── soundcheck.mjs       # §10 — hours + closed-door flag
    │   ├── backline.mjs         # §9 — instruments + negative constraints
    │   ├── catering.mjs         # §14 — 7 menus + excluded brands
    │   └── conflicts.mjs        # post-extraction — pure logic, no parsing
    └── parse-rider-output.json  # written by the script, imported by the app
```

Run with:
```bash
cd web
node scripts/parse-rider.mjs "../RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf"
```

The script writes `riderExtracted.json`. The app imports it instead of calling `buildScratchRiderImport()` from `riderFixture.ts`.

---

## 9. Build Order

1. **`pdf-utils.mjs`** — `getTextContent`, `groupIntoRows`, `buildColumnMap`, `assignToColumns`. Test it by printing extracted rows from page 6 and verifying they look like the input list.
2. **`section-finder.mjs`** — maps page numbers to section types by looking for numbered headings. Validates against the known 14 sections.
3. **`cover.mjs`** — contacts + revision info. Easy win, builds confidence.
4. **`input-list.mjs`** — the hardest section; do it early so you can tune the column algorithm while the work is fresh.
5. **`rooming.mjs`** — second most important, easier than input list.
6. **`transport.mjs`** + **`soundcheck.mjs`** — quick, high confidence, validate the page ranges from section-finder.
7. **`backline.mjs`** — do this before catering because the pattern is simpler (lists vs prose).
8. **`catering.mjs`** — most complex, lowest priority per accuracy.
9. **`conflicts.mjs`** — post-extraction, no parsing needed.
10. **`parse-rider.mjs`** — glue them together, write the output JSON.

---

## 10. Honest Summary

| | In-house (pdfjs-dist) | With LLM (Anthropic API) |
|---|---|---|
| Cost per parse | **$0** | ~$0.30 |
| Works offline | **Yes** | No |
| Spanish handling | ✅ (no translation needed) | ✅ |
| Table reconstruction | Manual positional algorithm | Native |
| Prose sections (backline, catering) | 60–70% | 90–95% |
| Structured sections (input list, rooming) | 80–88% | 90–95% |
| Stage plot | ❌ Impossible | 75–80% |
| Time to build | ~2–3 days | ~1 day |
| Fragility | High (breaks if rider layout changes) | Low (resilient to layout variation) |

**The right use for in-house parsing:** The fixture rider (Elsa y Elmar) is a known document. A tuned parser for this exact PDF reaches ~80–85% accuracy and can be hardened over time. For a production app that needs to parse any rider from any artist, the in-house approach will eventually break on an unexpected layout — the LLM approach generalizes.

**For now:** Build the in-house script. It proves the data pipeline end-to-end, produces real structured output from the real PDF, and replaces the hardcoded `riderFixture.ts` with genuinely extracted data. When the app grows to handle multiple riders, the LLM path is a drop-in upgrade to the same extractor interface.
