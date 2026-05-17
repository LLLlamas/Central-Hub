# DEAL MEMO — Elsa y Elmar · Full Band 2025

> **MOCK DOCUMENT** — This file is a stand-in for the artist-agent deal memos
> the Tour Manager would receive in Phase 1 (Booking). In production, the
> Central-Hub TM Setup Wizard would import the show schedule below into the
> tour calendar via manual entry or CSV import. The Central-Hub does *not*
> generate this — it consumes it.

---

**To:** Lorenzo Llamas, Tour Manager — Elsa y Elmar
**From:** Sofía Restrepo, Agent · WMA-LATAM (mock)
**Date issued:** 2025-06-15
**Tour:** Full Band 2025
**Artist:** Elsa y Elmar
**Management contact:** Camila Vega, Costa Norte Music (mock)
**Production Manager:** Manuel González · `magcs81@gmail.com` · `+52 55 54 74 70 48`

---

## Deal summary

| Item | Value |
|---|---|
| Tour length | 32 days |
| Leg 1 — Mexico | 4 shows |
| Leg 2 — USA | 3 shows |
| Leg 3 — South America | 4 shows |
| Total confirmed | 11 shows |
| Guarantee floor | USD 35,000 / show (Tier A venues) |
| Backend split | 85/15 over breakeven |
| Hold dates | None |
| Routing window | 2025-09-22 → 2025-10-23 |

## Confirmed routing

See attached spreadsheet [`mock-tour-route.csv`](mock-tour-route.csv) for the
full schedule. Summary of show days:

| Date | City | Country | Venue | Capacity | Guarantee |
|---|---|---|---|---|---|
| 2025-09-25 | Mexico City | MX | Auditorio Nacional | 9,683 | USD 65,000 |
| 2025-09-28 | Monterrey | MX | Auditorio Banamex | 8,500 | USD 45,000 |
| 2025-09-30 | Guadalajara | MX | Auditorio Telmex | 11,000 | USD 50,000 |
| 2025-10-03 | Los Angeles | US | The Greek Theatre | 5,900 | USD 75,000 |
| 2025-10-07 | Oakland | US | Fox Theater | 2,800 | USD 38,000 |
| 2025-10-09 | Miami | US | James L. Knight Center | 4,500 | USD 45,000 |
| 2025-10-12 | Bogotá | CO | Movistar Arena | 14,000 | USD 55,000 |
| 2025-10-15 | Lima | PE | Anfiteatro Parque de la Exposición | 6,500 | USD 35,000 |
| 2025-10-18 | Santiago | CL | Movistar Arena | 14,800 | USD 50,000 |
| 2025-10-21 | Buenos Aires | AR | Movistar Arena | 15,000 | USD 60,000 |

## Conditions

1. **Carnet required** for cross-border equipment movement (MX/US/CO/PE/CL/AR).
2. **Visa support:** all crew on tour personnel list must have passports valid
   through 2026-04-30 at minimum. Visa letters provided on request.
3. **Tech rider** to be advanced ≥6 weeks before each show with the local PM.
   Current rider: `RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf`
   (revision 2 — Sept 2025).
4. **Promoter reps** travel with the tour for settlement (LATAM legs).
5. **Curfew enforcement** strictly per venue contract. Overage = fines.
6. **Force majeure** clauses apply per individual venue agreements.

## Production notes (from PM)

- Tour brings own audio console; alternates per rider §5.
- Tour brings own RF stack (8× PSM 1000 IEM + 2× Sennheiser EW300 G4).
- Lighting tour-spec'd per rider §8 (43× Robe MegaPointe, 61× Chorus Line 16).
- 50' LED wall (12m × 5m, 16:9) — local supply required.
- 6h closed-door soundcheck on show days.
- Stage size ≥ 14m × 10m at 1.50m height; ground support required.
- 3 generators (rider §8): 200kVA + 150kVA + 200kVA. **Note:** rider §4 says 2;
  §8 supersedes. Confirm with local promoter rep.

## Travel scaffold (advance phase)

- **Air:** 8 tickets per intra-tour leg (rider §11). Travel agent will source.
- **Ground:** 2× Sprinter 20-pax + 1× cargo van per show city.
- **Hotels:** 10-room block per city (1 JR Suite, 7 singles incl. one shared
  for MUA + Personal, 2 doubles). Total 13 occupants.
- **Per diems:** USD 50/day artist; USD 40/day crew. Higher for cities >
  $200/day index.

## Settlement

- Cash to TM (Lorenzo) at each settlement, deposited within 48h.
- Wires for guarantee shortfalls within 7 business days.
- Tax forms filed per country of show.

## Signatures

| | |
|---|---|
| Agent (WMA-LATAM) | _Sofía Restrepo · signed 2025-06-15_ |
| Artist management | _Camila Vega · signed 2025-06-18_ |
| Tour manager ack. | _Lorenzo Llamas · ack'd 2025-06-22_ |

---

## How this would be ingested

1. TM receives the deal memo + routing spreadsheet via email from the agent.
2. TM opens the Central-Hub *Tour Setup Wizard* (`/tour/new` — not built yet).
3. TM either:
   - Imports the routing CSV directly (`mock-tour-route.csv`), or
   - Types in show dates + venues + cities manually if the agent sent it as
     a Word doc / PDF.
4. The Hub auto-generates a Day row for every date in the range, defaulting
   to `dayType: hold`. TM sets each one to its real type.
5. Show dates auto-link to the rider PDF (rider §6-13 specs apply per show).

> **In v2**, the Hub would partner with booking platforms (Eventric, Prism)
> for direct API import. v1 is manual entry / CSV.

---

*This is a mock document. It represents what would arrive from the booking
agent in the Booking phase (Phase 1 of the tour lifecycle, per
`tour-management-deep-research.md` §2). All numbers, names, and conditions
above are illustrative.*
