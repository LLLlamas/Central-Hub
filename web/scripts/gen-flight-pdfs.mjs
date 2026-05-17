// Generates the mock flight-confirmation PDFs served from web/public/.
// One-off build script — run with `node scripts/gen-flight-pdfs.mjs`.
// Data mirrors `flightImports` in src/data/mockTour.ts. pdf-lib is a
// devDependency used only here; the output PDFs are committed static assets.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const flights = [
  {
    file: 'AM19_Group_LAX-MEX_2025-09-22.pdf',
    airline: 'Aeroméxico',
    confTitle: 'E-Ticket Itinerary & Receipt',
    pnr: 'ABCD12',
    flightNumber: 'AM 19',
    from: 'LAX',
    fromCity: 'Los Angeles International',
    to: 'MEX',
    toCity: 'Mexico City — Benito Juárez Intl',
    date: 'Monday, 22 September 2025',
    depart: '09:35',
    arrive: '15:20',
    cabin: 'Economy — group booking',
    passengers: [
      ['Elsa Carvajal', '2A'],
      ['Julian Bernal', '2C'],
      ['Juan', '3A'],
      ['Daniel', '3C'],
      ['Lorenzo Llamas', '4A'],
      ['Manuel González', '4C'],
      ['Audio Engineer', '5A'],
      ['MUA', '5C'],
    ],
  },
  {
    file: 'AV_Group_BOG-LIM_2025-10-14.pdf',
    airline: 'Avianca',
    confTitle: 'Itinerary Confirmation',
    pnr: 'PQRS44',
    flightNumber: 'AV 247',
    from: 'BOG',
    fromCity: 'Bogotá — El Dorado Intl',
    to: 'LIM',
    toCity: 'Lima — Jorge Chávez Intl',
    date: 'Tuesday, 14 October 2025',
    depart: '11:50',
    arrive: '15:18',
    cabin: 'Economy — group booking',
    passengers: [
      ['Elsa Carvajal', '7B'],
      ['Julian Bernal', '7C'],
      ['J. Apellido', '8A'],
      ['Daniel', '8B'],
      ['D. Apellido', '8C'],
      ['Manuel González', '9A'],
      ['L. Llamas', '9B'],
      ['New Audio Sub', '9C'],
    ],
  },
];

async function build(f) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${f.airline} — Flight Confirmation ${f.pnr}`);
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.13, 0.12, 0.1);
  const muted = rgb(0.45, 0.43, 0.39);
  const accent = rgb(0.72, 0.22, 0.17);
  const rule = rgb(0.84, 0.83, 0.8);
  const W = 612;
  const M = 56;

  const t = (s, x, y, size, fnt = font, color = ink) =>
    page.drawText(String(s), { x, y, size, font: fnt, color });
  const line = (y) =>
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: rule });

  page.drawRectangle({ x: 0, y: 792 - 96, width: W, height: 96, color: rgb(0.96, 0.95, 0.93) });
  t(f.airline, M, 792 - 52, 23, bold);
  t(f.confTitle.toUpperCase(), M, 792 - 72, 9, font, muted);
  t('BOOKING REFERENCE', W - M - 150, 792 - 44, 8, font, muted);
  t(f.pnr, W - M - 150, 792 - 66, 19, bold, accent);

  let y = 792 - 136;
  t('FLIGHT', M, y, 8.5, font, muted);
  y -= 23;
  t(`${f.flightNumber}    ${f.from} - ${f.to}`, M, y, 18, bold);
  y -= 17;
  t(`${f.fromCity}   to   ${f.toCity}`, M, y, 9.5, font, muted);
  y -= 34;

  t('DEPART', M, y, 8, font, muted);
  t('ARRIVE', M + 175, y, 8, font, muted);
  t('DATE', M + 350, y, 8, font, muted);
  y -= 21;
  t(f.depart, M, y, 17, bold);
  t(f.arrive, M + 175, y, 17, bold);
  t(f.date, M + 350, y, 10.5, font);
  y -= 15;
  t(`${f.from} airport`, M, y, 8.5, font, muted);
  t(`${f.to} airport`, M + 175, y, 8.5, font, muted);
  t(f.cabin, M + 350, y, 8.5, font, muted);
  y -= 32;

  line(y);
  y -= 26;
  t(`PASSENGERS (${f.passengers.length})`, M, y, 9, font, muted);
  y -= 20;
  t('NAME', M, y, 8, font, muted);
  t('SEAT', W - M - 70, y, 8, font, muted);
  y -= 8;
  line(y);
  y -= 19;
  for (const [name, seat] of f.passengers) {
    t(name, M, y, 11.5, font);
    t(seat, W - M - 70, y, 11.5, bold);
    y -= 23;
  }
  y -= 6;
  line(y);
  y -= 22;
  t('Mock flight-confirmation document, generated for the Central-Hub prototype.', M, y, 8, font, muted);
  y -= 12;
  t('Not a real ticket — passenger and flight data mirror the tour mock data.', M, y, 8, font, muted);

  writeFileSync(join(PUBLIC, f.file), await doc.save());
  console.log('wrote', f.file);
}

for (const f of flights) await build(f);
