// Generates the mock confirmation PDFs served from web/public/ — the flight
// confirmations and the hotel-block confirmation the scratch onboarding has
// the user upload. One-off build script — run with `node scripts/gen-flight-pdfs.mjs`.
// Flight data mirrors `flightFixture.ts`, hotel data mirrors `hotelFixture.ts`.
// pdf-lib is a devDependency used only here; the output PDFs are committed assets.
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
      ['Tour Manager', '4A'],
      ['Manuel González', '4C'],
      ['Audio Engineer', '5A'],
      ['MUA', '5C'],
    ],
  },
  {
    // Scratch-mode fixture — the CDMX→Monterrey leg (mirrors mockTour travel).
    file: 'VB1014_Group_MEX-MTY_2025-09-27.pdf',
    airline: 'VivaAerobus',
    confTitle: 'Booking Confirmation',
    pnr: 'XYZ987',
    flightNumber: 'VB 1014',
    from: 'MEX',
    fromCity: 'Mexico City — Benito Juárez Intl',
    to: 'MTY',
    toCity: 'Monterrey — Mariano Escobedo Intl',
    date: 'Saturday, 27 September 2025',
    depart: '11:00',
    arrive: '12:35',
    cabin: 'Economy — group booking',
    passengers: [
      ['Elsa Carvajal', '2A'],
      ['Julian Bernal', '2C'],
      ['Juan', '3A'],
      ['Daniel', '3C'],
      ['Tour Manager', '4A'],
      ['Manuel González', '4C'],
      ['Audio Engineer', '5A'],
      ['MUA', '5C'],
    ],
  },
];

// Hotel-block confirmation — one PDF, two hotel blocks (the CDMX stay and the
// Monterrey stay), mirroring hotelFixture.ts.
const hotelDoc = {
  file: 'Hotel_Block_Mexico_2025-09.pdf',
  agency: 'Andante Travel — Touring Desk',
  confTitle: 'Hotel Block Confirmation',
  reference: 'AND-MX-3391',
  blocks: [
    {
      name: 'NH Collection Mexico City Reforma',
      address: 'Paseo de la Reforma 122, Juárez, 06600 Ciudad de México',
      phone: '+52 55 1167 1900',
      confirmation: 'NHX-558210',
      checkIn: 'Mon, 22 September 2025 — 15:00',
      checkOut: 'Sat, 27 September 2025 — 12:00',
      nights: 5,
      rooms: [
        ['Elsa Carvajal', '1204 — King suite'],
        ['Julian Bernal', '1108 — King'],
        ['Juan', '1110 — Double'],
        ['Daniel', '1112 — Double'],
        ['Tour Manager', '1106 — King'],
        ['Manuel González', '1102 — King'],
        ['Audio Engineer', '1009 — Double'],
        ['MUA', '1011 — Double'],
      ],
    },
    {
      name: 'Fiesta Americana Monterrey Valle',
      address: 'Av. Lázaro Cárdenas 2305, Valle Oriente, 66260 Monterrey',
      phone: '+52 81 8133 8000',
      confirmation: 'FA-MTY-77431',
      checkIn: 'Sat, 27 September 2025 — 15:00',
      checkOut: 'Sun, 28 September 2025 — 12:00',
      nights: 1,
      rooms: [
        ['Elsa Carvajal', '808 — King suite'],
        ['Julian Bernal', '810 — King'],
        ['Juan', '812 — Double'],
        ['Daniel', '814 — Double'],
        ['Tour Manager', '806 — King'],
        ['Manuel González', '804 — King'],
        ['Audio Engineer', '709 — Double'],
        ['MUA', '711 — Double'],
      ],
    },
  ],
};

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

async function buildHotels(h) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${h.agency} — Hotel Block Confirmation ${h.reference}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.13, 0.12, 0.1);
  const muted = rgb(0.45, 0.43, 0.39);
  const accent = rgb(0.16, 0.36, 0.46);
  const rule = rgb(0.84, 0.83, 0.8);
  const W = 612;
  const H = 792;
  const M = 56;

  let page = doc.addPage([W, H]);
  const t = (s, x, y, size, fnt = font, color = ink) =>
    page.drawText(String(s), { x, y, size, font: fnt, color });
  const line = (y) =>
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: rule });

  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: rgb(0.96, 0.95, 0.93) });
  t(h.agency, M, H - 52, 19, bold);
  t(h.confTitle.toUpperCase(), M, H - 72, 9, font, muted);
  t('BOOKING REFERENCE', W - M - 150, H - 44, 8, font, muted);
  t(h.reference, W - M - 150, H - 66, 17, bold, accent);

  let y = H - 136;
  for (const b of h.blocks) {
    t('HOTEL', M, y, 8.5, font, muted);
    y -= 22;
    t(b.name, M, y, 16, bold);
    y -= 16;
    t(b.address, M, y, 9.5, font, muted);
    y -= 13;
    t(`Tel ${b.phone}    ·    Confirmation ${b.confirmation}`, M, y, 9, font, muted);
    y -= 30;

    t('CHECK-IN', M, y, 8, font, muted);
    t('CHECK-OUT', M + 230, y, 8, font, muted);
    t('NIGHTS', W - M - 60, y, 8, font, muted);
    y -= 18;
    t(b.checkIn, M, y, 10, font);
    t(b.checkOut, M + 230, y, 10, font);
    t(String(b.nights), W - M - 60, y, 13, bold);
    y -= 26;

    line(y);
    y -= 22;
    t(`ROOMING LIST (${b.rooms.length})`, M, y, 9, font, muted);
    y -= 19;
    t('GUEST', M, y, 8, font, muted);
    t('ROOM', M + 230, y, 8, font, muted);
    y -= 8;
    line(y);
    y -= 18;
    for (const [name, room] of b.rooms) {
      t(name, M, y, 11, font);
      t(room, M + 230, y, 11, font);
      y -= 21;
    }
    y -= 22;
  }

  t('Mock hotel-block confirmation, generated for the Central-Hub prototype.', M, 70, 8, font, muted);
  t('Not a real booking — hotel and rooming data mirror the tour mock data.', M, 58, 8, font, muted);

  writeFileSync(join(PUBLIC, h.file), await doc.save());
  console.log('wrote', h.file);
}

for (const f of flights) await build(f);
await buildHotels(hotelDoc);
