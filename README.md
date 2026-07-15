# Central-Hub

A prototype tour-ops hub for a tour manager: build a tour from scratch by uploading the real documents a TM actually receives — a rider PDF, a route CSV, flight confirmations, hotel bookings — and get a living calendar, day sheets, crew visibility controls, and a gear tracker out of them.

- **`web/`** — the app: React + Vite + TypeScript + Tailwind v4
- **`docs/`** — specs, research, and audits ([index](docs/README.md))
- **`CLAUDE.md`** — the working map for agent/dev sessions (architecture, conventions, state model)
- **`RIDER ELSA Y ELMAR …pdf`** — sample Spanish-language rider used as the canonical test fixture
- **`supabase/`** — schema + migrations for the cloud backend (Phase A)

## Running the app

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:5173. Tests: `npm test` (vitest). Build: `npm run build`.

## How it works

`/` is **My Shows** — every tour you run, grouped by status, with a map and a "+ New show" button. Pick or create a tour and everything else lives under `/t/:tourId/...`.

Inside a tour, the TM/PM **authors the rider directly in-app** from a 14-section consensus template — add, remove, reorder, and rename sections, with real inline editors for every section type — or falls back to uploading an existing rider PDF, parsed in-browser (`web/src/lib/pdfParser.ts`, no server) with fixture fallbacks for the known sample files. The route (CSV) and hotel bookings (PDF) are still uploaded and parsed the same way. Once the rider is in shape, it goes to each show's venue for negotiation on the **advance board** — the venue responds item by item and the TM reconciles any gaps until everything's confirmed.

**Backends:** the default is `local` (localStorage + IndexedDB, per-browser, no login). A **Supabase** backend (Google/magic-link auth, one shared tour, role-gated membership, cloud sync) is available behind `VITE_BACKEND=supabase` — see [docs/backend.md](docs/backend.md).

## Demo the visibility model

Use the **viewer switcher** in the top bar to view the same tour as the tour manager, the production manager, the artist, or a crew member. Day Detail, Day Sheets, and the Today surface re-render from that person's perspective — same data, different views.

## Tech notes

- React 18 + Vite + TypeScript + Tailwind CSS v4, `react-router-dom` v6, `date-fns`, `pdfjs-dist`
- State: React Context (`web/src/state/AppState.tsx`); persistence behind a backend seam (`web/src/lib/backend/`)
- Design language: "field notebook" — warm paper, calm ink, accent reds for show-critical. Inter / Fraunces / JetBrains Mono.
