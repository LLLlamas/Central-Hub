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

The app boots into an **empty tour shell** and a guided walkthrough leads you through four uploads (route CSV → rider PDF → flights → hotels) using the sample files in `web/public/`. Everything is parsed in-browser (`web/src/lib/pdfParser.ts`, no server) with fixture fallbacks for the known sample files.

**Backends:** the default is `local` (localStorage + IndexedDB, per-browser, no login). A **Supabase** backend (Google/magic-link auth, one shared tour, role-gated membership, cloud sync) is available behind `VITE_BACKEND=supabase` — see [docs/backend.md](docs/backend.md).

## Demo the visibility model

Use the **viewer switcher** in the top bar to view the same tour as the tour manager, the production manager, the artist, or a crew member. Day Detail, Day Sheets, and the Today surface re-render from that person's perspective — same data, different views.

## Tech notes

- React 18 + Vite + TypeScript + Tailwind CSS v4, `react-router-dom` v6, `date-fns`, `pdfjs-dist`
- State: React Context (`web/src/state/AppState.tsx`); persistence behind a backend seam (`web/src/lib/backend/`)
- Design language: "field notebook" — warm paper, calm ink, accent reds for show-critical. Inter / Fraunces / JetBrains Mono.
