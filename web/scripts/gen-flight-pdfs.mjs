// Generates the mock confirmation PDFs served from web/public/ — the flight
// e-tickets and the per-hotel booking confirmations the scratch onboarding has
// the user upload. One-off build script — run with `node scripts/gen-flight-pdfs.mjs`.
// Flight data mirrors `flightFixture.ts`, hotel data mirrors `hotelFixture.ts`.
// pdf-lib is a devDependency used only here; the output PDFs are committed assets.
//
// Visual targets:
//   Flights — a real airline group e-ticket / boarding-pass-style confirmation
//             (Delta-style header strip, prominent booking reference, route
//             arrow, depart/arrive blocks with date + class + bags, passenger
//             table with seat + zone + boarding time).
//   Hotels  — a real hotel booking confirmation invoice (business header,
//             booking #, check-in/out, room-type + guests, rate table with
//             totals, additional info). One PDF per hotel — the TM drops them
//             in batch.
//
// Parser anchors preserved: BOOKING REFERENCE, FLIGHT, DEPART, ARRIVE, NAME,
// SEAT (flights); HOTEL, CHECK-IN, CHECK-OUT, NIGHTS, ROOMING LIST, GUEST,
// ROOM (hotels). See lib/pdfParser.ts.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const flights = [
  {
    file: 'AM19_Group_LAX-MEX_2026-09-22.pdf',
    airline: 'Aeroméxico',
    airlineCode: 'AM',
    confTitle: 'Group E-Ticket Itinerary',
    pnr: 'ABCD12',
    flightNumber: 'AM 19',
    from: 'LAX',
    fromCity: 'Los Angeles',
    fromAirport: 'Los Angeles International',
    to: 'MEX',
    toCity: 'Mexico City',
    toAirport: 'Benito Juárez Intl',
    date: 'Tue, 22 Sep 2026',
    depart: '09:35',
    arrive: '15:20',
    boarding: '09:05',
    gate: '54B',
    cabin: 'Economy (L)',
    cabinShort: 'L · Main',
    bags: '1 checked / pax',
    duration: '5h 45m',
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
    file: 'VB1014_Group_MEX-MTY_2026-09-27.pdf',
    airline: 'VivaAerobus',
    airlineCode: 'VB',
    confTitle: 'Booking Confirmation',
    pnr: 'XYZ987',
    flightNumber: 'VB 1014',
    from: 'MEX',
    fromCity: 'Mexico City',
    fromAirport: 'Benito Juárez Intl',
    to: 'MTY',
    toCity: 'Monterrey',
    toAirport: 'Mariano Escobedo Intl',
    date: 'Sun, 27 Sep 2026',
    depart: '11:00',
    arrive: '12:35',
    boarding: '10:30',
    gate: '21',
    cabin: 'Economy (Y)',
    cabinShort: 'Y · Main',
    bags: '1 checked / pax',
    duration: '1h 35m',
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

// One booking confirmation per hotel — mirrors a typical hotel-confirmation
// email/PDF a TM receives in their inbox.
const hotels = [
  {
    file: 'Hotel_CDMX_NH_Reforma_2026-09-22.pdf',
    name: 'NH Collection Mexico City Reforma',
    brand: 'NH Collection Hotels',
    address: 'Paseo de la Reforma 122, Juárez, 06600 Ciudad de México',
    phone: '+52 55 1167 1900',
    email: 'reservations.nhcreforma@nh-hotels.com',
    website: 'www.nh-collection.com',
    confTitle: 'Booking Confirmation',
    confirmation: 'NHX-558210',
    bookedBy: 'Andante Travel — Touring Desk',
    bookedByContact: 'touring@andantetravel.com',
    bookingDate: 'Mon, 17 Aug 2026',
    checkInDate: 'Tue, 22 Sep 2026',
    checkInTime: '15:00',
    checkOutDate: 'Sun, 27 Sep 2026',
    checkOutTime: '12:00',
    nights: 5,
    guests: '8 adults',
    currency: 'USD',
    nightlyRate: 218,
    additionalInfo: [
      'Check-in from 15:00; check-out until 12:00.',
      'Group breakfast included in main restaurant (06:30 — 10:30).',
      'Self-parking included. Valet on request.',
    ],
    rooms: [
      ['Elsa Carvajal', '1204', 'King Suite'],
      ['Julian Bernal', '1108', 'King'],
      ['Juan', '1110', 'Double'],
      ['Daniel', '1112', 'Double'],
      ['Tour Manager', '1106', 'King'],
      ['Manuel González', '1102', 'King'],
      ['Audio Engineer', '1009', 'Double'],
      ['MUA', '1011', 'Double'],
    ],
  },
  {
    file: 'Hotel_MTY_Fiesta_Americana_2026-09-27.pdf',
    name: 'Fiesta Americana Monterrey Valle',
    brand: 'Fiesta Americana Hotels & Resorts',
    address: 'Av. Lázaro Cárdenas 2305, Valle Oriente, 66260 Monterrey',
    phone: '+52 81 8133 8000',
    email: 'reservaciones.mtyvalle@posadas.com',
    website: 'www.fiestamericana.com',
    confTitle: 'Booking Confirmation',
    confirmation: 'FA-MTY-77431',
    bookedBy: 'Andante Travel — Touring Desk',
    bookedByContact: 'touring@andantetravel.com',
    bookingDate: 'Mon, 17 Aug 2026',
    checkInDate: 'Sun, 27 Sep 2026',
    checkInTime: '15:00',
    checkOutDate: 'Mon, 28 Sep 2026',
    checkOutTime: '12:00',
    nights: 1,
    guests: '8 adults',
    currency: 'USD',
    nightlyRate: 196,
    additionalInfo: [
      'Check-in from 15:00; check-out until 12:00.',
      'Buffet breakfast included.',
      'Late check-out on request, subject to availability.',
    ],
    rooms: [
      ['Elsa Carvajal', '808', 'King Suite'],
      ['Julian Bernal', '810', 'King'],
      ['Juan', '812', 'Double'],
      ['Daniel', '814', 'Double'],
      ['Tour Manager', '806', 'King'],
      ['Manuel González', '804', 'King'],
      ['Audio Engineer', '709', 'Double'],
      ['MUA', '711', 'Double'],
    ],
  },
];

async function buildFlight(f) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${f.airline} — ${f.confTitle} ${f.pnr}`);
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.10, 0.10, 0.10);
  const muted = rgb(0.42, 0.40, 0.38);
  const subtle = rgb(0.62, 0.60, 0.57);
  const accent = rgb(0.72, 0.22, 0.17);
  const rule = rgb(0.84, 0.83, 0.80);
  const band = rgb(0.14, 0.16, 0.22);
  const bandText = rgb(0.97, 0.96, 0.93);
  const tint = rgb(0.97, 0.95, 0.91);
  const W = 612;
  const H = 792;
  const M = 48;

  const t = (s, x, y, size, fnt = font, color = ink) =>
    page.drawText(String(s), { x, y, size, font: fnt, color });
  const line = (y, color = rule, thickness = 0.75) =>
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness, color });

  // ── Header strip (dark airline band) ─────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: band });
  t(f.airlineCode, M, H - 44, 26, bold, bandText);
  t(f.airline, M + 60, H - 38, 14, bold, bandText);
  t(f.confTitle.toUpperCase(), M + 60, H - 56, 8, font, rgb(0.78, 0.78, 0.74));
  t('BOOKING REFERENCE', W - M - 130, H - 32, 7, font, rgb(0.78, 0.78, 0.74));
  t(f.pnr, W - M - 130, H - 56, 20, bold, bandText);

  // ── Route block ──────────────────────────────────────────────────────────
  let y = H - 110;
  t('FLIGHT', M, y, 8, font, muted);
  t('DATE', W - M - 130, y, 8, font, muted);
  y -= 22;
  // Parser anchor row: "AM 19    LAX - MEX"
  t(`${f.flightNumber}    ${f.from} - ${f.to}`, M, y, 19, bold);
  t(f.date, W - M - 130, y, 12, bold);
  y -= 16;
  t(`${f.fromAirport}  ›  ${f.toAirport}`, M, y, 9.5, font, muted);
  t(`${f.duration} · nonstop`, W - M - 130, y, 9, font, muted);

  // ── Depart / arrive panel (paper tint card) ──────────────────────────────
  y -= 22;
  const panelTop = y;
  const panelH = 96;
  page.drawRectangle({
    x: M, y: y - panelH, width: W - 2 * M, height: panelH,
    color: tint, borderColor: rule, borderWidth: 0.6,
  });
  const col1 = M + 18;
  const col2 = M + 200;
  const col3 = M + 360;

  y -= 18;
  t('DEPART', col1, y, 8, font, muted);
  t('ARRIVE', col2, y, 8, font, muted);
  t('CLASS', col3, y, 8, font, muted);
  y -= 22;
  t(f.depart, col1, y, 22, bold);
  t(f.arrive, col2, y, 22, bold);
  t(f.cabin, col3, y, 13, bold);
  y -= 14;
  t(`${f.from} · ${f.fromCity}`, col1, y, 9, font, muted);
  t(`${f.to} · ${f.toCity}`, col2, y, 9, font, muted);
  t(`Gate ${f.gate}   ·   ${f.bags}`, col3, y, 9, font, muted);
  y = panelTop - panelH - 24;

  // ── Boarding strip ───────────────────────────────────────────────────────
  t('BOARDING', M, y, 8, font, muted);
  t('GATE', M + 110, y, 8, font, muted);
  t('CABIN', M + 200, y, 8, font, muted);
  t('BAGGAGE', M + 320, y, 8, font, muted);
  y -= 17;
  t(f.boarding, M, y, 14, bold);
  t(f.gate, M + 110, y, 14, bold);
  t(f.cabinShort, M + 200, y, 11, font);
  t(f.bags, M + 320, y, 11, font);
  y -= 24;

  line(y);
  y -= 22;

  // ── Passenger table ──────────────────────────────────────────────────────
  // Boarding time is a flight-level value (one row for the whole flight, shown
  // in the BOARDING strip above), not per-passenger — every passenger on a
  // given flight boards at the same time. Same goes for zone in practice for
  // a small touring group, so the table is just NAME + SEAT.
  t(`PASSENGERS (${f.passengers.length})`, M, y, 9, font, muted);
  y -= 18;
  t('NAME', M, y, 8, font, muted);
  t('SEAT', M + 270, y, 8, font, muted);
  y -= 8;
  line(y);
  y -= 19;
  let rowI = 0;
  for (const [name, seat] of f.passengers) {
    if (rowI % 2 === 0) {
      page.drawRectangle({
        x: M - 4, y: y - 6, width: W - 2 * (M - 4), height: 20,
        color: rgb(0.985, 0.975, 0.955),
      });
    }
    t(name, M, y, 11.5, font);
    t(seat, M + 270, y, 12, bold);
    y -= 22;
    rowI += 1;
  }
  y -= 4;
  line(y);
  y -= 22;

  // ── Footer ───────────────────────────────────────────────────────────────
  t(`Issued by ${f.airline} · Confirmation ${f.pnr}`, M, y, 8.5, font, subtle);
  y -= 12;
  t('Mock flight confirmation — generated for the Central-Hub prototype.', M, y, 8, font, subtle);
  y -= 11;
  t('Not a real ticket; data mirrors the tour mock data.', M, y, 8, font, subtle);

  writeFileSync(join(PUBLIC, f.file), await doc.save());
  console.log('wrote', f.file);
}

async function buildHotel(h) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${h.name} — ${h.confTitle} ${h.confirmation}`);
  const W = 612;
  const H = 792;
  const M = 48;
  const FOOTER = 90;

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.10, 0.10, 0.10);
  const muted = rgb(0.42, 0.40, 0.38);
  const subtle = rgb(0.62, 0.60, 0.57);
  const accent = rgb(0.13, 0.30, 0.50);
  const rule = rgb(0.84, 0.83, 0.80);
  const tableHead = rgb(0.92, 0.94, 0.98);

  let page = doc.addPage([W, H]);
  const t = (s, x, y, size, fnt = font, color = ink) =>
    page.drawText(String(s), { x, y, size, font: fnt, color });
  const line = (y, color = rule, thickness = 0.7) =>
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness, color });
  const nextPage = () => { page = doc.addPage([W, H]); return H - 56; };
  let y;
  const ensure = (n) => { if (y - n < FOOTER) y = nextPage(); };

  // ── Business header ──────────────────────────────────────────────────────
  // Right block reserves 170pt; hotel name area is the remaining width.
  const rightW = 170;
  const rightX = W - M - rightW;
  t(h.name, M, H - 60, 18, bold, accent);
  t(h.brand, M, H - 76, 9.5, font, muted);
  t(h.address, M, H - 92, 9, font, muted);
  t(`Tel ${h.phone}   ·   ${h.email}`, M, H - 106, 8.5, font, muted);
  t(h.website, M, H - 118, 8.5, font, muted);

  // Right column — "BOOKING CONFIRMATION" at 12pt fits in 170pt.
  t(h.confTitle.toUpperCase(), rightX, H - 60, 12, bold, accent);
  t('CONFIRMATION', rightX, H - 80, 7.5, font, muted);
  t(h.confirmation, rightX, H - 94, 12, bold);
  t('BOOKING DATE', rightX, H - 110, 7.5, font, muted);
  t(h.bookingDate, rightX, H - 122, 10, font);

  y = H - 145;
  line(y, accent, 1.2);
  y -= 22;

  // ── Booking details two-column ───────────────────────────────────────────
  // Left band: CHECK-IN | CHECK-OUT | NIGHTS / GUESTS / ROOMS
  // Right band: BOOKED BY (agent + contact + status)
  const colA = M;
  const colCheckOut = M + 145;
  const colNights = M + 290;
  const colB = M + 345;
  t('BOOKING DETAILS', colA, y, 9, bold, accent);
  t('BOOKED BY', colB, y, 9, bold, accent);
  y -= 18;

  // Parser-anchor row: CHECK-IN, CHECK-OUT, NIGHTS labels remain on one row.
  t('CHECK-IN', colA, y, 8, font, muted);
  t('CHECK-OUT', colCheckOut, y, 8, font, muted);
  t('NIGHTS', colNights, y, 8, font, muted);
  t('Agent', colB, y, 8, font, muted);
  y -= 16;
  // Stack date + time vertically so columns can't collide.
  t(h.checkInDate, colA, y, 10, font);
  t(h.checkOutDate, colCheckOut, y, 10, font);
  t(String(h.nights), colNights, y, 14, bold);
  t(h.bookedBy, colB, y, 9.5, font);
  y -= 13;
  t(h.checkInTime, colA, y, 9, font, muted);
  t(h.checkOutTime, colCheckOut, y, 9, font, muted);
  t(h.bookedByContact, colB, y, 9, font, muted);
  y -= 22;

  t('GUESTS', colA, y, 8, font, muted);
  t('ROOMS', colCheckOut, y, 8, font, muted);
  t('STATUS', colB, y, 8, font, muted);
  y -= 16;
  t(h.guests, colA, y, 10, font);
  t(`${h.rooms.length} rooms`, colCheckOut, y, 10, font);
  t('Confirmed', colB, y, 10, font, accent);
  y -= 26;

  line(y);
  y -= 22;

  // ── Rooming list (table) ─────────────────────────────────────────────────
  // Parser anchors: "ROOMING LIST (N)" then GUEST / ROOM column headers.
  t(`ROOMING LIST (${h.rooms.length})`, M, y, 10, bold, accent);
  y -= 18;
  page.drawRectangle({
    x: M - 4, y: y - 6, width: W - 2 * (M - 4), height: 20, color: tableHead,
  });
  t('GUEST', M, y, 8, font, muted);
  t('ROOM', M + 230, y, 8, font, muted);
  t('TYPE', M + 320, y, 8, font, muted);
  y -= 8;
  line(y);
  y -= 19;
  for (const [name, room, type] of h.rooms) {
    ensure(22);
    t(name, M, y, 11, font);
    // The parser splits room/type on "—", so emit "1204 — King Suite" in the
    // ROOM column (kept for backwards compatibility with parseHotelPdf).
    t(`${room} — ${type}`, M + 230, y, 11, font);
    y -= 21;
  }
  y -= 4;
  line(y);
  y -= 22;

  // ── Rate summary ─────────────────────────────────────────────────────────
  const subtotal = h.nightlyRate * h.nights * h.rooms.length;
  const tax = Math.round(subtotal * 0.16);
  const total = subtotal + tax;
  ensure(80);
  t('RATE SUMMARY', M, y, 9, bold, accent);
  y -= 17;
  t(`${h.rooms.length} rooms × ${h.nights} night${h.nights === 1 ? '' : 's'} × ${h.currency} ${h.nightlyRate}`, M, y, 10, font, muted);
  t(`${h.currency} ${subtotal.toLocaleString()}`, W - M - 80, y, 10, font);
  y -= 16;
  t('Tax (16% IVA)', M, y, 10, font, muted);
  t(`${h.currency} ${tax.toLocaleString()}`, W - M - 80, y, 10, font);
  y -= 6;
  line(y);
  y -= 17;
  t('TOTAL', M, y, 11, bold);
  t(`${h.currency} ${total.toLocaleString()}`, W - M - 80, y, 12, bold, accent);
  y -= 26;

  // ── Additional info ──────────────────────────────────────────────────────
  ensure(20 + h.additionalInfo.length * 13 + 32);
  t('ADDITIONAL INFORMATION', M, y, 9, bold, accent);
  y -= 16;
  for (const note of h.additionalInfo) {
    t(`·  ${note}`, M, y, 9.5, font, muted);
    y -= 13;
  }

  // Footer at page bottom (last page only).
  t(`${h.name} · ${h.confTitle} · Reference ${h.confirmation}`, M, 70, 8, font, subtle);
  t('Mock hotel booking confirmation — generated for the Central-Hub prototype.', M, 58, 8, font, subtle);
  t('Not a real reservation; data mirrors the tour mock data.', M, 46, 8, font, subtle);

  writeFileSync(join(PUBLIC, h.file), await doc.save());
  console.log('wrote', h.file);
}

for (const f of flights) await buildFlight(f);
for (const h of hotels) await buildHotel(h);
