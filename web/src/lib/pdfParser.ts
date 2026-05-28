// In-house PDF parser — pdfjs-dist text extraction + positional reconstruction.
// No LLM calls. Works in the browser (Vite) via getTextContent() x/y positions.
//
// Shared algorithmic utilities live in pdfCore.mjs (imported by this file and
// by the Node CLI at scripts/parse-rider.mjs).
//
// Exports:
//   parseRiderPdf(file)  → RiderImport   (wired into RiderIngest upload handler)
//   parseFlightPdf(file) → FlightImport  (wired into FlightIngest PDF handler)
//   parseHotelPdf(file)  → { hotels, tasks } (wired into HotelImportSection)

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type {
  RiderImport, FlightImport, ParsedFlight, TourPerson, Hotel, Task,
  InputChannel, MonitorMix, FOHOutput, RiderSection, RiderSectionType,
  Conflict, LodgingSpec, BacklineSpec, CateringSpec, CateringMenu, CateringItem,
  ExtractionFlag, StandType,
} from '@/types';
import { vis } from '@/lib/visibility';
import {
  type PItem, type PPage, type ColDef,
  MONTHS, SECTION_HINTS, COL_ALIAS, STAND_MAP, MONITOR_TYPE_MAP, ROOM_TYPE_MAP,
  groupRows, rowText, buildColMap, assignCols,
  multiPageItems, headingItems, pageText, pagesText,
  parseDateToISO, avgHeight, personnelNameMap, colAliasLookup,
  extractFlightTickets,
} from './pdfCore.mjs';

// Worker — set once at module load. Vite understands new URL(..., import.meta.url).
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

// ─── PDF document loader ──────────────────────────────────────────────────────

async function extractPages(buffer: ArrayBuffer): Promise<PPage[]> {
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: PPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const items: PItem[] = [];
    for (const raw of content.items) {
      // raw is TextItem | TextMarkedContent; TextMarkedContent has no 'str'
      if (!('str' in raw)) continue;
      const it = raw as { str: string; transform: number[]; width: number; height: number };
      if (!it.str.trim()) continue;
      items.push({
        text: it.str,
        x: Math.round(it.transform[4]),
        y: Math.round(it.transform[5]),
        w: Math.round(it.width),
        h: Math.round(it.height),
      });
    }
    pages.push({ num: n, items });
  }
  return pages;
}

// ─── Section finder ───────────────────────────────────────────────────────────

function findSections(pages: PPage[]): Map<RiderSectionType, number[]> {
  // Pre-pass: any page matching 5+ section hints is a table of contents — skip it.
  const tocPages = new Set<number>();
  for (const page of pages) {
    const ht = headingItems(page).map(h => h.text).join(' ');
    const top = pageText(page).slice(0, 300);
    if (SECTION_HINTS.filter(h => h.re.test(ht) || h.re.test(top)).length >= 5) {
      tocPages.add(page.num);
    }
  }

  const result = new Map<RiderSectionType, number[]>();
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    if (tocPages.has(page.num)) continue;
    const ht = headingItems(page).map(h => h.text).join(' ');
    const top = pageText(page).slice(0, 300);

    for (const hint of SECTION_HINTS) {
      if (!hint.re.test(ht) && !hint.re.test(top)) continue;
      const existing = result.get(hint.type) ?? [];
      if (existing.includes(page.num)) continue;
      const next = pages[pi + 1];
      const nextTop = next ? pageText(next).slice(0, 300) : '';
      const nextStarts = next && SECTION_HINTS.some(h =>
        h !== hint && h.re.test(nextTop)
      );
      const span = next && !nextStarts ? [page.num, next.num] : [page.num];
      result.set(hint.type, [...existing, ...span.filter(n => !existing.includes(n))]);
    }
  }
  return result;
}

// ─── Cover extractor ──────────────────────────────────────────────────────────

interface CoverData {
  artistName: string;
  productionManager: { name?: string; email?: string; phone?: string };
  revisionInfo: { date?: string; warning?: string };
  language: string;
}

function extractCover(pages: PPage[]): CoverData {
  const cover = pages[0];
  if (!cover) return { artistName: '', productionManager: {}, revisionInfo: {}, language: 'es' };

  const text = pageText(cover);
  const email = text.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i)?.[0];
  const phone = text.match(/\+\d[\d\s\-().]{9,18}/)?.[0]?.trim();

  // Artist name: pick the tallest-average-height alphabetic row in the top half.
  // If that row looks like a document title (RIDER / TECH / SPEC), scan body text
  // for "de ARTIST" / "producción de ARTIST" patterns.
  const maxY = cover.items.reduce((m, x) => Math.max(m, x.y), 0);
  const alphaItems = cover.items
    .filter(i => i.y > maxY * 0.5 && (i.text.match(/[A-Za-z]/g) ?? []).length >= 2);
  const alphaRows = groupRows(alphaItems, 8);
  const tallestRow = alphaRows.reduce<PItem[]>((best, row) =>
    avgHeight(row) > avgHeight(best) ? row : best
  , alphaRows[0] ?? []);
  let artistName = rowText(tallestRow);

  if (!artistName || /\b(rider|tech|technical|specification|spec|full|band|input|list|sheet)\b/i.test(artistName)) {
    const bodyText = pagesText(pages, pages.slice(0, 3).map(p => p.num));
    const match =
      bodyText.match(/(?:de\s+|artista[:\s]+)([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]*(?:\s+(?:[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]*|&))*)/m)?.[1]?.trim() ??
      bodyText.match(/producci[oó]n de ([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]*(?:\s+(?:[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]*|&))*)/im)?.[1]?.trim();
    if (match && match.length > 3 && !/\b(rider|tech|promotor|production|manager)\b/i.test(match)) {
      artistName = match;
    }
  }

  const revDate =
    text.match(/(?:actualizado|updated)[:\s]+([^\n\r.]{3,30})/i)?.[1]?.trim() ??
    text.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i)?.[0];

  const warning = /omitir\s+versiones\s+anteriores|ignore\s+previous\s+versions/i.test(text)
    ? 'FAVOR OMITIR VERSIONES ANTERIORES — please ignore previous versions'
    : undefined;

  let pmName: string | undefined;
  if (email) {
    const emailItem = cover.items.find(i => i.text.includes(email));
    if (emailItem) {
      pmName = cover.items.find(i =>
        Math.abs(i.y - emailItem.y) <= 28 && !i.text.includes('@') &&
        !/^\+?\d/.test(i.text) && /[A-ZÁ-Ú][a-záéíóú]/.test(i.text) &&
        i.text.split(/\s+/).length >= 2
      )?.text?.trim();
    }
  }

  // Language: scan first 3 pages for unaccented Spanish function words.
  // pdfjs-dist splits accented chars (ó arrives fragmented), so accent regex is unreliable.
  const langText = pagesText(pages, pages.slice(0, 3).map(p => p.num));
  const language = /\b(para|con|del|las|los|como|pero|favor|promotor|escenario|sonido|backline|camerino|hospedaje|transporte|cater)\b/i.test(langText) ? 'es' : 'en';

  return { artistName, productionManager: { name: pmName, email, phone }, revisionInfo: { date: revDate, warning }, language };
}

// ─── Input list extractor ─────────────────────────────────────────────────────

interface InputListResult {
  inputList: InputChannel[];
  monitorMix: MonitorMix[];
  fohOutputs: FOHOutput[];
  confidence: number;
}

function extractInputList(pages: PPage[], sectionPages: number[]): InputListResult {
  const sPages = pages.filter(p => sectionPages.includes(p.num));
  if (!sPages.length) return { inputList: [], monitorMix: [], fohOutputs: [], confidence: 0 };

  const rows = groupRows(multiPageItems(sPages), 5);

  // Find the table header row: must map to a 'ch' key AND a 'source' or 'mic' key.
  let headerIdx = -1;
  let colMap: ColDef[] = [];
  for (let i = 0; i < rows.length; i++) {
    const keys = rows[i].map(item => colAliasLookup(item.text.toLowerCase().trim()));
    if (keys.includes('ch') && (keys.includes('source') || keys.includes('mic'))) {
      headerIdx = i;
      const headerItems = rows[i].filter(item => colAliasLookup(item.text.toLowerCase().trim()) !== null);
      colMap = buildColMap(headerItems.length >= 3 ? headerItems : rows[i]);
      break;
    }
  }
  if (headerIdx < 0) return { inputList: [], monitorMix: [], fohOutputs: [], confidence: 0.1 };

  const channels: InputChannel[] = [];
  let i = headerIdx + 1;

  while (i < rows.length && channels.length < 64) {
    const row = rows[i];
    const firstText = row[0]?.text?.trim() ?? '';
    const chNum = parseInt(firstText, 10);

    if (isNaN(chNum) || chNum < 1 || chNum > 64) {
      const rt = rowText(row).toLowerCase();
      if (/monitor|mix|foh|output|salida/i.test(rt) && (row[0]?.h ?? 0) >= 8 && channels.length > 0) break;
      i++; continue;
    }

    const cells = colMap.length >= 3 ? assignCols(row, colMap) : {};
    const source   = (cells['source'] ?? cells['fuente'] ?? row[1]?.text ?? '').trim();
    const micOrDi  = (cells['mic']    ?? row[2]?.text ?? '').trim();
    const standRaw = (cells['stand']  ?? row[3]?.text ?? '').trim().toLowerCase();
    const phantomRaw = (cells['phantom'] ?? cells['48v'] ?? row[4]?.text ?? '').trim();
    const notes    = (cells['notes']  ?? cells['notas'] ?? row[row.length - 1]?.text ?? '').trim();

    const flags: ExtractionFlag[] = [];
    if (!source) flags.push({ level: 'warning', message: `Channel ${chNum}: no source name in rider` });

    const standType: StandType = STAND_MAP[standRaw] ?? (standRaw ? 'other' : 'none');
    const phantom = phantomRaw ? /x|yes|s[ií]|✓|true|48/i.test(phantomRaw) : undefined;
    const micText = micOrDi + ' ' + notes;
    const wireless = /wireless|inal[aá]mbrico|ew-dx|ew[\s-]?\d|ulx|psm/i.test(micText);

    channels.push({
      channelNumber: chNum,
      source: source || `CH ${chNum}`,
      micOrDi: micOrDi || 'Unknown',
      standType,
      standNotes: standRaw && !STAND_MAP[standRaw] ? standRaw : undefined,
      phantom48v: phantom,
      wireless,
      wirelessSystem: wireless ? micText.match(/EW-DX|EW[\s-]?\d+|ULX[A-Z]?|PSM[\s-]?\d+/i)?.[0]?.trim() : undefined,
      notes: notes || undefined,
      extractionFlags: flags.length ? flags : undefined,
    });
    i++;
  }

  // Flag duplicate source labels — likely L/R channels with the same name.
  const sourceCnt: Record<string, number[]> = {};
  for (const ch of channels) {
    if (ch.source && ch.source !== `CH ${ch.channelNumber}`)
      (sourceCnt[ch.source] ??= []).push(ch.channelNumber);
  }
  for (const [src, chs] of Object.entries(sourceCnt)) {
    if (chs.length < 2) continue;
    for (const chNum of chs) {
      const ch = channels.find(c => c.channelNumber === chNum);
      if (!ch) continue;
      ch.extractionFlags = [
        ...(ch.extractionFlags ?? []),
        { level: 'warning', message: `Duplicate label "${src}" on channels ${chs.join(' & ')} — likely a L/R typo` },
      ];
    }
  }

  return {
    inputList: channels,
    monitorMix: extractMonitorRows(rows, i),
    fohOutputs: extractFOHRows(rows),
    confidence: channels.length >= 40 ? 0.87 : channels.length >= 25 ? 0.71 : 0.45,
  };
}

function extractMonitorRows(rows: PItem[][], startIdx: number): MonitorMix[] {
  const mixes: MonitorMix[] = [];
  let active = false;
  for (let i = startIdx; i < rows.length; i++) {
    const rt = rowText(rows[i]);
    if (!active && /monitor|mix|salida/i.test(rt) && (rows[i][0]?.h ?? 0) >= 7) { active = true; continue; }
    if (!active) continue;
    const firstCell = rows[i][0]?.text?.trim() ?? '';
    if (!/^[\d\s&\-]+$/.test(firstCell)) { if (mixes.length > 0) break; continue; }

    const mixName = rows[i][1]?.text?.trim() ?? '';
    const typeRaw = (rows[i][2]?.text ?? '').trim().toLowerCase();
    const personMatch = mixName.match(/[-–—]\s*([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]+)/);
    let type = 'in_ear_stereo' as MonitorMix['type'];
    for (const [k, v] of Object.entries(MONITOR_TYPE_MAP)) if (typeRaw.includes(k)) { type = v as MonitorMix['type']; break; }

    mixes.push({
      outputs: firstCell,
      mixName,
      personName: personMatch?.[1],
      type,
      bodypackCount: parseInt(rows[i][3]?.text ?? '') || undefined,
    });
  }
  return mixes;
}

function extractFOHRows(rows: PItem[][]): FOHOutput[] {
  const outputs: FOHOutput[] = [];
  let active = false;
  for (const row of rows) {
    const rt = rowText(row);
    if (!active && /foh.*output|foh.*patch|salida.*foh/i.test(rt)) { active = true; continue; }
    if (!active) continue;
    const fc = row[0]?.text?.trim() ?? '';
    const fohLabel = /^(FOH\s+[\d\s&]+|\d+(?:\s*&\s*\d+)*)\b/i.exec(fc)?.[0]?.trim();
    if (!fohLabel) {
      if (outputs.length > 0) outputs[outputs.length - 1].source = (outputs[outputs.length - 1].source + ' ' + rt).trim();
      continue;
    }
    outputs.push({ outputNumber: fohLabel, source: row.slice(1).map(r => r.text).join(' ').trim() });
  }
  return outputs;
}

// ─── Rooming list extractor ───────────────────────────────────────────────────

function extractRooming(pages: PPage[], sectionPages: number[]): LodgingSpec {
  const sPages = pages.filter(p => sectionPages.includes(p.num));
  const text = sPages.map(pageText).join('\n');
  const rows = groupRows(multiPageItems(sPages), 5);

  const roomingList: LodgingSpec['roomingList'] = [];
  let roomNum = 0;

  for (const row of rows) {
    const rt = rowText(row);
    const rtl = rt.toLowerCase();
    let foundType: LodgingSpec['roomingList'][number]['roomType'] | undefined;
    for (const [k, v] of Object.entries(ROOM_TYPE_MAP)) {
      if (rtl.includes(k)) { foundType = v as typeof foundType; break; }
    }
    if (!foundType) continue;
    roomNum++;

    const afterType = rt.replace(new RegExp(Object.keys(ROOM_TYPE_MAP).join('|'), 'i'), '');
    const names = afterType.split(/\s*[/:—\-|+]\s*/).map(s => s.trim()).filter(s => s.length > 1 && /[A-Za-z]/.test(s));

    roomingList.push({
      roomNumber: roomNum,
      roomType: foundType,
      occupants: names.map(name => ({
        name: /tour manager|audio engineer|lighting|vj|mua|personal|staff|m[uú]sico|baterista|bajista/i.test(name) ? undefined : name,
        role: name,
      })),
    });
  }

  return {
    hotelRequirements: {
      starRating: text.match(/(\d)\s*(?:star|estrell)/i) ? parseInt(text.match(/(\d)\s*(?:star|estrell)/i)![1]) : undefined,
      artistPreApproval: /aprobaci[oó]n.*artista|artist.*approv/i.test(text),
      amenitiesRequired: [],
    },
    roomingList,
    totalRooms: roomingList.length || undefined,
    totalOccupants: roomingList.reduce((s, r) => s + r.occupants.length, 0) || undefined,
  };
}

// ─── Backline extractor ───────────────────────────────────────────────────────

function extractBackline(pages: PPage[], sectionPages: number[]): BacklineSpec {
  const text = pagesText(pages, sectionPages);

  const kitOptions = ['Gretsch', 'DW', 'Yamaha', 'Pearl', 'Ludwig', 'Mapex'].filter(b => new RegExp(b, 'i').test(text));

  const hardware: NonNullable<BacklineSpec['drums']>['hardware'] = [];
  const negRe = /\b(?:NO|NOT|SIN|NUNCA|NEVER)\b[\s:]+([^\n\r,.!]{3,45})/gi;
  let m: RegExpExecArray | null;
  while ((m = negRe.exec(text)) !== null)
    hardware.push({ item: 'Hardware constraint', qty: 1, preferred: [], excluded: [m[1].trim()] });

  const bassOpts: NonNullable<BacklineSpec['bass']>['options'] = [];
  const bassRe = /opci[oó]n\s*(\d)|option\s*(\d)/gi;
  while ((m = bassRe.exec(text)) !== null) {
    const num = parseInt(m[1] || m[2]);
    const line = text.slice(m.index, text.indexOf('\n', m.index) > -1 ? text.indexOf('\n', m.index) : undefined).trim();
    const parts = line.replace(/opci[oó]n\s*\d|option\s*\d/gi, '').split(/[+&]/);
    bassOpts.push({ optionNumber: num, head: parts[0]?.trim() || 'Unknown', cab: parts[1]?.trim() || 'Unknown' });
  }

  const guitarItems = ['Fender', 'Marshall', 'Hot Rod', 'Twin Reverb', 'Vox']
    .filter(b => new RegExp(b, 'i').test(text))
    .map(b => ({ item: b, qty: 1 }));

  return {
    drums: kitOptions.length ? { kitOptions, pieces: [], hardware } : undefined,
    bass: bassOpts.length ? { options: bassOpts } : undefined,
    guitar: guitarItems.length ? guitarItems : undefined,
  };
}

// ─── Catering extractor ───────────────────────────────────────────────────────

function extractCatering(pages: PPage[], sectionPages: number[]): CateringSpec {
  const text = pagesText(pages, sectionPages);
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 3);

  const roomPats = [
    { re: /camerino\s*0?1|^elsa\b/i, room: 'Camerino 01 – Elsa' },
    { re: /camerino\s*0?2|m[uú]sicos|musicians/i, room: 'Camerino 02 – Músicos' },
    { re: /camerino\s*0?3|crew/i, room: 'Camerino 03 – Crew' },
  ];
  const timePats: Array<{ re: RegExp; time: CateringMenu['menuTime'] }> = [
    { re: /load[\s-]?in/i,               time: 'load_in' },
    { re: /soundcheck/i,                  time: 'soundcheck' },
    { re: /post[\s-]?show|despu[eé]s/i,   time: 'post_show' },
    { re: /\bshow\b|hora\s+del\s+show/i,  time: 'show' },
  ];

  const menus: CateringMenu[] = [];
  let curRoom = '';
  let curTime: CateringMenu['menuTime'] = 'show';
  let curItems: CateringItem[] = [];

  const flush = () => {
    if (curRoom && curItems.length) { menus.push({ room: curRoom, menuTime: curTime, items: curItems }); curItems = []; }
  };

  for (const line of lines) {
    let changed = false;
    for (const rp of roomPats) { if (rp.re.test(line) && line.length < 50) { flush(); curRoom = rp.room; changed = true; break; } }
    if (changed) continue;
    for (const tp of timePats) { if (tp.re.test(line) && line.length < 60) { flush(); curTime = tp.time; changed = true; break; } }
    if (changed) continue;
    if (/^[A-ZÁÉÍÓÚ\s\-:]+$/.test(line) && line.length < 30) continue; // pure heading, skip

    const qtyM = line.match(/^(\d+)\s*[x×\-]?\s+/);
    const qty = qtyM ? parseInt(qtyM[1]) : 1;
    const item = qtyM ? line.slice(qtyM[0].length).trim() : line;
    const brandExcluded: string[] = [];
    const notRe = /\bno\b\s+([A-Za-záéíóú]+)/gi;
    let bm: RegExpExecArray | null;
    while ((bm = notRe.exec(line)) !== null) brandExcluded.push(bm[1].trim());
    if (item && curRoom) curItems.push({ item, qty, brandExcluded: brandExcluded.length ? brandExcluded : undefined });
  }
  flush();

  return {
    menus,
    generalRequirements: {
      biodegradableDisposables: /biodegradable/i.test(text) || undefined,
      foodDonationPlanRequired: /donaci[oó]n|donation|donar/i.test(text) || undefined,
    },
  };
}

// ─── Conflict detector ────────────────────────────────────────────────────────

function detectConflicts(data: Partial<RiderImport>): Conflict[] {
  const conflicts: Conflict[] = [];
  const sections = data.sections ?? [];
  const sText = (type: string) => sections.find(s => s.type === type)?.freeText ?? '';

  const stageGens = sText('stage_specs').match(/(\d+)\s*generators?/i)?.[1];
  const lightGens = sText('lighting_equipment').match(/(\d+)\s*generators?/i)?.[1];
  if (stageGens && lightGens && stageGens !== lightGens) {
    conflicts.push({
      id: 'c_generator_count', type: 'numeric_disagreement', severity: 'high',
      description: `§4 Stage Specs says ${stageGens} generator(s); §8 Lighting says ${lightGens} generator(s).`,
      sectionsInvolved: ['stage_specs', 'lighting_equipment'],
      values: [{ section: '§4', value: `${stageGens} generators` }, { section: '§8', value: `${lightGens} generators` }],
      suggestedResolution: 'Confirm with PM which generator count is current.',
    });
  }

  // §11 air tickets vs §12 touring-party size is intentionally NOT a conflict:
  // a rider almost always has fewer flight tickets than touring-party members
  // (local hires don't fly). Cross-document checks (rider vs travel grid, etc.)
  // are the right place for this — see redesign-plan.md "Cross-document conflicts".

  const inputSec = sections.find(s => s.type === 'input_list');
  for (const ch of inputSec?.inputList ?? []) {
    for (const flag of ch.extractionFlags ?? []) {
      const isDupe = flag.message.toLowerCase().includes('duplicate');
      const isMissing = flag.message.toLowerCase().includes('no source');
      if (!isDupe && !isMissing) continue;
      conflicts.push({
        id: `c_ch_${isDupe ? 'dup' : 'missing'}_${ch.channelNumber}`,
        type: isDupe ? 'duplicate' : 'missing_reference',
        severity: 'low',
        description: flag.message,
        sectionsInvolved: ['input_list'],
        values: [{ section: '§6', value: `Channel ${ch.channelNumber}` }],
        suggestedResolution: isDupe
          ? 'Likely a Left/Right channel mislabeled — confirm with audio engineer.'
          : 'Confirm with audio engineer what this DI is assigned to.',
      });
    }
  }

  return conflicts;
}

// ─── Public: Rider parser ─────────────────────────────────────────────────────

export async function parseRiderPdf(file: File): Promise<RiderImport> {
  const buffer = await file.arrayBuffer();
  const pages = await extractPages(buffer);
  const cover = extractCover(pages);
  const sMap = findSections(pages);
  const sp = (type: RiderSectionType): number[] => sMap.get(type) ?? [];

  const transportData = { flightTickets: undefined as number | undefined };
  const tpPages = sp('ground_transport');
  if (tpPages.length) {
    transportData.flightTickets = extractFlightTickets(pagesText(pages, tpPages));
  }
  const lodgingPages = sp('lodging');
  const lodging = lodgingPages.length ? extractRooming(pages, lodgingPages) : undefined;

  const sections: RiderSection[] = [];

  const addSection = (type: RiderSectionType, pageNums: number[], extra: Partial<RiderSection>) => {
    if (!pageNums.length) return;
    sections.push({ type, pages: pageNums, status: 'extracted', language: cover.language, ...extra });
  };

  // §6 Input / Monitor / FOH
  const inputPages = sp('input_list');
  if (inputPages.length) {
    const { inputList, monitorMix, fohOutputs, confidence } = extractInputList(pages, inputPages);
    addSection('input_list', inputPages, { confidence, inputList, monitorMix, fohOutputs });
  }

  if (lodgingPages.length && lodging) {
    addSection('lodging', lodgingPages, { confidence: (lodging.totalRooms ?? 0) >= 8 ? 0.88 : 0.6, lodging });
  }

  addSection('backline',      sp('backline'),      { confidence: 0.67, backline: sp('backline').length ? extractBackline(pages, sp('backline')) : undefined });
  addSection('soundcheck',    sp('soundcheck'),    { confidence: 0.92, freeText: pagesText(pages, sp('soundcheck')).trim() });
  addSection('air_transport', tpPages,             { confidence: 0.88, freeText: pagesText(pages, tpPages).trim() });
  addSection('catering',      sp('catering'),      { confidence: 0.63, catering: sp('catering').length ? extractCatering(pages, sp('catering')) : undefined });

  for (const [type, conf] of [
    ['stage_specs', 0.70], ['audio_pa', 0.70], ['stage_plot', 0.75],
    ['lighting_equipment', 0.65], ['ground_transport', 0.72], ['dressing_rooms', 0.72],
  ] as const) {
    addSection(type as RiderSectionType, sp(type as RiderSectionType), { confidence: conf, freeText: pagesText(pages, sp(type as RiderSectionType)).trim() });
  }

  const partySize = { flightTickets: transportData.flightTickets, tourists: lodging?.totalOccupants, rooms: lodging?.totalRooms };
  const conflicts = detectConflicts({ sections, partySize });
  if (conflicts.length) sections.push({ type: 'other', pages: [], status: 'extracted', confidence: 0.95, conflicts });

  return {
    id: `ri_parsed_${Date.now()}`,
    filename: file.name,
    uploadedAt: new Date().toISOString().slice(0, 16),
    uploadedBy: 'Tour Manager',
    sourceLanguage: cover.language,
    pageCount: pages.length,
    status: 'review',
    artistName: cover.artistName || undefined,
    revisionInfo: cover.revisionInfo,
    productionManager: cover.productionManager,
    partySize,
    sections,
    revision: 1,
  };
}

// ─── Public: Flight PDF parser ────────────────────────────────────────────────
// Our generated PDFs have a known fixed layout — parse by pattern detection.

function parseFlightPages(pages: PPage[]): ParsedFlight | null {
  const rows = groupRows(multiPageItems(pages), 6);

  let airline = '', flightNumber = '', from = '', to = '', depTime = '', arrTime = '', isoDate = '', pnr = '';
  const passengers: { name: string; seat?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rt = rowText(rows[i]);
    const first = rows[i][0];

    if (!airline && first?.h >= 16 && !/E-TICKET|ITINERARY|BOOKING|REFERENCE|CONFIRMATION/i.test(rt))
      airline = rt;

    if (!pnr && /BOOKING\s*REFERENCE/i.test(rt)) {
      const nr = rowText(rows[i + 1] ?? []);
      if (/^[A-Z0-9]{4,8}$/.test(nr)) pnr = nr;
    }

    if (!flightNumber) {
      const m = rt.match(/([A-Z]{2}\s*\d{1,4})\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})/);
      if (m) { flightNumber = m[1].replace(/\s+/, ' '); from = m[2]; to = m[3]; }
    }

    if (!depTime && (rt === 'DEPART' || (rt.includes('DEPART') && rt.includes('ARRIVE') && (first?.h ?? 0) < 12))) {
      const next = rows[i + 1] ?? [];
      const times = next.filter(r => /^\d{2}:\d{2}$/.test(r.text.trim()));
      if (times.length >= 2) { depTime = times[0].text.trim(); arrTime = times[1].text.trim(); }
      const dateItem = next.find(r => /\d{4}/.test(r.text) && /[a-z]{3,}/i.test(r.text));
      if (dateItem) isoDate = parseDateToISO(dateItem.text) ?? '';
    }

    if (!passengers.length && (/^\s*NAME\s*$/i.test(rt) || (rt.includes('NAME') && rt.includes('SEAT')))) {
      for (let j = i + 1; j < rows.length; j++) {
        const pRow = rows[j];
        const pt = rowText(pRow);
        if (!pt || /mock|prototype|not a real/i.test(pt)) continue;
        if (/^(FLIGHT|DEPART|ARRIVE|DATE|BOOKING|HOTEL|CHECK)/i.test(pt)) break;
        const name = pRow.filter(r => r.x < 250).map(r => r.text).join(' ').trim();
        const seat = pRow.filter(r => r.x >= 400).map(r => r.text).join(' ').trim();
        if (name && /[A-Za-z]{2}/.test(name) && !/^(NAME|SEAT|PASSENGER)$/i.test(name))
          passengers.push({ name, seat: seat || undefined });
      }
      break;
    }
  }

  if (!flightNumber) return null;
  const today = new Date().toISOString().slice(0, 10);
  return {
    airline: airline || 'Unknown', flightNumber,
    departureAirport: from, arrivalAirport: to,
    departureTime: `${isoDate || today}T${depTime || '00:00'}`,
    arrivalTime:   `${isoDate || today}T${arrTime || '00:00'}`,
    recordLocator: pnr || undefined,
    passengers,
  };
}

export async function parseFlightPdf(file: File, personnel: TourPerson[] = []): Promise<FlightImport> {
  const buffer = await file.arrayBuffer();
  const pages = await extractPages(buffer);
  const parsed = parseFlightPages(pages);
  const slug = file.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_+|_+$/g, '');
  const id = `fi_parsed_${slug}_${Date.now()}`;

  if (!parsed) {
    return { id, filename: file.name, uploadedAt: new Date().toISOString().slice(0, 16), uploadedBy: 'Tour Manager', status: 'failed', parsedFlights: [], unmatchedNames: [] };
  }

  const byName = personnelNameMap(personnel);
  const matchedPassengers = parsed.passengers.map(p => ({
    ...p, matchedTourPersonId: byName.get(p.name.trim().toLowerCase()),
  }));

  return {
    id, filename: file.name,
    uploadedAt: new Date().toISOString().slice(0, 16),
    uploadedBy: 'Tour Manager',
    status: 'review',
    parsedFlights: [{ ...parsed, passengers: matchedPassengers }],
    unmatchedNames: matchedPassengers.filter(p => !p.matchedTourPersonId).map(p => p.name),
  };
}

// ─── Public: Hotel PDF parser ─────────────────────────────────────────────────
// Our generated hotel PDFs have a known layout (scripts/gen-flight-pdfs.mjs).

export async function parseHotelPdf(
  file: File,
  personnel: TourPerson[] = [],
  tourDays: Array<{ id: string; date: string }> = [],
): Promise<{ hotels: Hotel[]; tasks: Task[] }> {
  const buffer = await file.arrayBuffer();
  const pages = await extractPages(buffer);
  const rows = groupRows(multiPageItems(pages), 6);

  const byName = personnelNameMap(personnel);
  const dayByDate = new Map(tourDays.map(d => [d.date, d.id]));
  const toDayId = (text: string) => {
    const iso = parseDateToISO(text);
    return iso ? (dayByDate.get(iso) ?? tourDays[0]?.id) : undefined;
  };

  const hotels: Hotel[] = [];
  let i = 0;

  while (i < rows.length) {
    if (!/^HOTEL\s*$/i.test(rowText(rows[i]))) { i++; continue; }
    i++;

    const hotelName = rowText(rows[i++] ?? []);
    const address   = rowText(rows[i++] ?? []);
    const metaLine  = rowText(rows[i++] ?? []);
    const phone     = metaLine.match(/Tel\s+([\+\d\s\-()]+)/)?.[1]?.trim();

    while (i < rows.length && /CHECK-IN|CHECK-OUT|NIGHTS/i.test(rowText(rows[i]))) i++;

    let checkIn = '15:00', checkOut = '12:00', nights = 1;
    let dayId: string | undefined;
    const ciRow = rowText(rows[i] ?? []);
    if (/\d{1,2}\s+\w+\s+\d{4}/.test(ciRow)) {
      checkIn = ciRow.match(/—\s*(\d{2}:\d{2})/)?.[1] ?? '15:00';
      dayId = toDayId(ciRow);
      i++;
      const coRow = rowText(rows[i] ?? []);
      checkOut = coRow.match(/—\s*(\d{2}:\d{2})/)?.[1] ?? '12:00';
      nights = parseInt(rows[i]?.find(r => /^\d+$/.test(r.text.trim()) && r.x > 400)?.text ?? '1') || 1;
      i++;
    }

    while (i < rows.length && !/ROOMING LIST|GUEST/i.test(rowText(rows[i]))) i++;
    i++;
    if (i < rows.length && /^(GUEST|ROOM)/i.test(rowText(rows[i]))) i++;

    const occupants: Hotel['occupants'] = [];
    while (i < rows.length) {
      const pRow = rows[i];
      const pt = rowText(pRow);
      if (!pt || /^(HOTEL|GUEST|ROOM|Mock hotel)/i.test(pt) || /mock.*prototype/i.test(pt)) break;
      const guest = pRow.filter(r => r.x < 230).map(r => r.text).join(' ').trim();
      const room  = pRow.filter(r => r.x >= 230).map(r => r.text).join(' ').trim();
      if (guest && /[A-Za-z]{2}/.test(guest)) {
        const parts = room.split(/\s*—\s*/);
        occupants.push({
          tourPersonId: byName.get(guest.trim().toLowerCase()) ?? `tp_unknown_${guest.replace(/\s+/g, '_').toLowerCase()}`,
          roomNumber: parts[0]?.trim(),
          roomType: parts[1]?.trim(),
        });
      }
      i++;
    }

    hotels.push({
      id: `h_parsed_${hotels.length + 1}_${Date.now()}`,
      dayId: dayId ?? tourDays[0]?.id ?? 'day_unknown',
      name: hotelName, address, phone,
      checkIn, checkOut, nights, occupants,
      sensitive: false,
      visibility: vis.everyone('sees'),
    });
  }

  return { hotels, tasks: [] };
}
