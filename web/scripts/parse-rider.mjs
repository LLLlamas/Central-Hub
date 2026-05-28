#!/usr/bin/env node
// CLI wrapper for the in-house rider PDF parser.
// Usage: node scripts/parse-rider.mjs [path/to/rider.pdf]
// Writes extracted data to src/data/riderExtracted.json.
//
// pdfjs-dist must be installed: run `npm install` from the web/ directory.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  SECTION_HINTS, COL_ALIAS, STAND_MAP, MONITOR_TYPE_MAP,
  groupRows, rowText, buildColMap, assignCols,
  multiPageItems, headingItems, pageText, pagesText,
  avgHeight, colAliasLookup,
} from '../src/lib/pdfCore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

const DEFAULT_PDF = path.resolve(
  __dirname,
  '../../RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf',
);
const OUT_PATH = path.resolve(__dirname, '../src/data/riderExtracted.json');

const pdfPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_PDF;
if (!fs.existsSync(pdfPath)) {
  console.error(`PDF not found: ${pdfPath}`);
  process.exit(1);
}

// ─── PDF loader (Node version — reads from disk) ──────────────────────────────

async function extractPages(buffer) {
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const items = [];
    for (const raw of content.items) {
      if (!('str' in raw) || !raw.str.trim()) continue;
      items.push({
        text: raw.str,
        x: Math.round(raw.transform[4]),
        y: Math.round(raw.transform[5]),
        w: Math.round(raw.width),
        h: Math.round(raw.height),
      });
    }
    pages.push({ num: n, items });
  }
  return pages;
}

// ─── Section finder ───────────────────────────────────────────────────────────

function findSections(pages) {
  const tocPages = new Set();
  for (const page of pages) {
    const ht = headingItems(page).map(h => h.text).join(' ');
    const top = pageText(page).slice(0, 300);
    if (SECTION_HINTS.filter(h => h.re.test(ht) || h.re.test(top)).length >= 5)
      tocPages.add(page.num);
  }

  const result = new Map();
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

function extractCover(pages) {
  const cover = pages[0];
  if (!cover) return { artistName: '', productionManager: {}, revisionInfo: {}, language: 'es' };

  const text = pageText(cover);
  const email = text.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i)?.[0];
  const phone = text.match(/\+\d[\d\s\-().]{9,18}/)?.[0]?.trim();

  const maxY = cover.items.reduce((m, x) => Math.max(m, x.y), 0);
  const alphaItems = cover.items
    .filter(i => i.y > maxY * 0.5 && (i.text.match(/[A-Za-z]/g) ?? []).length >= 2);
  const alphaRows = groupRows(alphaItems, 8);
  const tallestRow = alphaRows.reduce((best, row) =>
    avgHeight(row) > avgHeight(best) ? row : best
  , alphaRows[0] ?? []);
  let artistName = rowText(tallestRow);

  if (!artistName || /\b(rider|tech|technical|specification|spec|full|band|input|list|sheet)\b/i.test(artistName)) {
    const bodyText = pagesText(pages, pages.slice(0, 3).map(p => p.num));
    const match =
      bodyText.match(/(?:de\s+|artista[:\s]+)([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]*(?:\s+(?:[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]*|&))*)/m)?.[1]?.trim() ??
      bodyText.match(/producci[oó]n de ([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]*(?:\s+(?:[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]*|&))*)/im)?.[1]?.trim();
    if (match && match.length > 3 && !/\b(rider|tech|promotor|production|manager)\b/i.test(match))
      artistName = match;
  }

  const revDate =
    text.match(/(?:actualizado|updated)[:\s]+([^\n\r.]{3,30})/i)?.[1]?.trim() ??
    text.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i)?.[0];

  const warning = /omitir\s+versiones\s+anteriores|ignore\s+previous\s+versions/i.test(text)
    ? 'FAVOR OMITIR VERSIONES ANTERIORES — please ignore previous versions'
    : undefined;

  let pmName;
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

  const langText = pagesText(pages, pages.slice(0, 3).map(p => p.num));
  const language = /\b(para|con|del|las|los|como|pero|favor|promotor|escenario|sonido|backline|camerino|hospedaje|transporte|cater)\b/i.test(langText) ? 'es' : 'en';

  return { artistName, productionManager: { name: pmName, email, phone }, revisionInfo: { date: revDate, warning }, language };
}

// ─── Input list extractor ─────────────────────────────────────────────────────

function extractInputList(pages, sectionPages) {
  const sPages = pages.filter(p => sectionPages.includes(p.num));
  if (!sPages.length) return { inputList: [], monitorMix: [], fohOutputs: [], confidence: 0 };

  const rows = groupRows(multiPageItems(sPages), 5);

  let headerIdx = -1;
  let colMap = [];
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

  const channels = [];
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
    const source    = (cells['source'] ?? cells['fuente'] ?? row[1]?.text ?? '').trim();
    const micOrDi   = (cells['mic']    ?? row[2]?.text ?? '').trim();
    const standRaw  = (cells['stand']  ?? row[3]?.text ?? '').trim().toLowerCase();
    const phantomRaw = (cells['phantom'] ?? cells['48v'] ?? row[4]?.text ?? '').trim();
    const notes     = (cells['notes']  ?? cells['notas'] ?? row[row.length - 1]?.text ?? '').trim();

    const flags = [];
    if (!source) flags.push({ level: 'warning', message: `Channel ${chNum}: no source name in rider` });

    const standType = STAND_MAP[standRaw] ?? (standRaw ? 'other' : 'none');
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

  // Monitor mixes
  const mixes = [];
  let active = false;
  for (let j = i; j < rows.length; j++) {
    const rt = rowText(rows[j]);
    if (!active && /monitor|mix|salida/i.test(rt) && (rows[j][0]?.h ?? 0) >= 7) { active = true; continue; }
    if (!active) continue;
    const firstCell = rows[j][0]?.text?.trim() ?? '';
    if (!/^[\d\s&\-]+$/.test(firstCell)) { if (mixes.length > 0) break; continue; }
    const mixName = rows[j][1]?.text?.trim() ?? '';
    const typeRaw = (rows[j][2]?.text ?? '').trim().toLowerCase();
    const personMatch = mixName.match(/[-–—]\s*([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚa-záéíóú]+)/);
    let type = 'in_ear_stereo';
    for (const [k, v] of Object.entries(MONITOR_TYPE_MAP)) if (typeRaw.includes(k)) { type = v; break; }
    mixes.push({ outputs: firstCell, mixName, personName: personMatch?.[1], type, bodypackCount: parseInt(rows[j][3]?.text ?? '') || undefined });
  }

  // FOH outputs — "FOH N" / "FOH N & M" labels; continuation rows folded into previous source
  const fohOutputs = [];
  let fohActive = false;
  for (const row of rows) {
    const rt = rowText(row);
    if (!fohActive && /foh.*output|foh.*patch|salida.*foh/i.test(rt)) { fohActive = true; continue; }
    if (!fohActive) continue;
    const fc = row[0]?.text?.trim() ?? '';
    const fohLabel = /^(FOH\s+[\d\s&]+|\d+(?:\s*&\s*\d+)*)\b/i.exec(fc)?.[0]?.trim();
    if (!fohLabel) {
      if (fohOutputs.length > 0) fohOutputs[fohOutputs.length - 1].source = (fohOutputs[fohOutputs.length - 1].source + ' ' + rt).trim();
      continue;
    }
    fohOutputs.push({ outputNumber: fohLabel, source: row.slice(1).map(r => r.text).join(' ').trim() });
  }

  return {
    inputList: channels,
    monitorMix: mixes,
    fohOutputs,
    confidence: channels.length >= 40 ? 0.87 : channels.length >= 25 ? 0.71 : 0.45,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Parsing: ${pdfPath}`);
  const buffer = fs.readFileSync(pdfPath);
  const pages = await extractPages(buffer.buffer);
  console.log(`  → ${pages.length} pages extracted`);

  const cover = extractCover(pages);
  const sMap = findSections(pages);
  const sp = type => sMap.get(type) ?? [];

  console.log('  → Sections detected:');
  for (const [type, nums] of sMap.entries()) console.log(`      ${type}: pages ${nums.join(', ')}`);

  const sections = [];

  const inputPages = sp('input_list');
  if (inputPages.length) {
    const { inputList, monitorMix, fohOutputs, confidence } = extractInputList(pages, inputPages);
    console.log(`  → Input list: ${inputList.length} channels, ${monitorMix.length} mixes, ${fohOutputs.length} FOH outputs (confidence: ${(confidence * 100).toFixed(0)}%)`);
    sections.push({ type: 'input_list', pages: inputPages, status: 'extracted', confidence, language: cover.language, inputList, monitorMix, fohOutputs });
  }

  for (const [type, conf] of [
    ['stage_specs', 0.70], ['audio_pa', 0.70], ['stage_plot', 0.75],
    ['lighting_equipment', 0.65], ['soundcheck', 0.92], ['backline', 0.67],
    ['ground_transport', 0.72], ['lodging', 0.80], ['catering', 0.63], ['dressing_rooms', 0.72],
  ]) {
    const nums = sp(type);
    if (nums.length) sections.push({ type, pages: nums, status: 'extracted', confidence: conf, language: cover.language, freeText: pagesText(pages, nums).trim() });
  }

  const result = {
    id: `ri_extracted_${Date.now()}`,
    filename: path.basename(pdfPath),
    uploadedAt: new Date().toISOString().slice(0, 16),
    uploadedBy: 'CLI parse-rider.mjs',
    sourceLanguage: cover.language,
    pageCount: pages.length,
    status: 'review',
    artistName: cover.artistName || undefined,
    revisionInfo: cover.revisionInfo,
    productionManager: cover.productionManager,
    sections,
    revision: 1,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n✓ Written to: ${OUT_PATH}`);
  console.log(`  Artist:   ${result.artistName || '(not detected)'}`);
  console.log(`  Language: ${result.sourceLanguage}`);
  console.log(`  PM:       ${result.productionManager?.name ?? '(not detected)'} <${result.productionManager?.email ?? '?'}>`);
  console.log(`  Sections: ${sections.length}`);
  if (sections.find(s => s.type === 'input_list')?.inputList?.length)
    console.log(`  Channels: ${sections.find(s => s.type === 'input_list').inputList.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
