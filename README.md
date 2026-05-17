# Central-Hub

Tour-ops central hub — a prototype based on `potential-implementation.md` and `tour-management-deep-research.md`.

This repo contains:

- **`web/`** — React + Vite + TypeScript + Tailwind v4 frontend (this is the app)
- **`potential-implementation.md`** — implementation playbook
- **`tour-management-deep-research.md`** — domain research (info architecture, lifecycle, competitors)
- **`RIDER ELSA Y ELMAR …pdf`** — sample Spanish-language rider used as a test fixture for the rider-ingest pipeline

## Running the app

From the repo root:

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:5173.

## What's mocked, and what isn't

Everything visible in the app is **mocked**. There is no backend, auth, or database yet.

- Mock data lives in [`web/src/data/mockTour.ts`](web/src/data/mockTour.ts) with comments on every block explaining what it is and where it should come from in production.
- The provenance registry in [`web/src/data/sources.ts`](web/src/data/sources.ts) maps each data category → real-system source (manual entry, AI extraction, external API, etc.) + lifecycle phase + detail.
- Every page surfaces this provenance through:
  - A **PROTOTYPE / Mock data** chip in the top bar
  - Inline `<MockBadge />` chips near every mocked entity
  - A `<DataSourcesPanel />` collapsible at the bottom of every page, listing the real-system source for each piece of data shown

## Six features that are wired up

Matching the build order in `potential-implementation.md` §4:

1. **Calendar** — every date on the tour with DayType (show / off / travel / rehearsal / promo / hold)
2. **Personnel** — Groups + Group Tags (Daysheets-style sub-groups)
3. **Schedule & Visibility** — schedule items with the ABAC visibility editor (default + group/tag/person overrides, most-specific-wins)
4. **Day Sheets** — Edit view (everything) + Personalized view (filtered by viewer's visibility)
5. **AI Ingest · Flights** — side-by-side review of Claude-extracted flight data
6. **AI Ingest · Riders** — section classifier + per-section structured-output review (input list, labor call, free-text bilingual)

Plus a **Tour Overview** dashboard at `/`.

## Demo the visibility model

Use the **viewer / role switcher** in the top right to view the same data as a TM, FOH engineer, artist, security lead, etc. The Day Detail and Day Sheet pages re-render based on the selected viewer.

## Tech notes

- **Frontend stack:** React 18 + Vite 5 + TypeScript + Tailwind CSS 4
- **Routing:** `react-router-dom` v6
- **Dates:** `date-fns`
- **State:** React Context (sufficient for prototype; would swap for TanStack Query + Zustand or similar when backend lands)
- **Design language:** "Field notebook" — warm paper, calm ink, accent reds for show-critical, restrained department palette. Inter / Fraunces / JetBrains Mono.

## What's not built

Deferred per `potential-implementation.md` §9:

- Backend, auth, database (Postgres + RLS for visibility, Clerk for auth)
- PDF export of day sheets (Puppeteer server-side)
- Push notifications on day-sheet publish
- Settlement / accounting
- Truck telemetry integration
- Native iOS / Android apps (PWA is fine for v1)
