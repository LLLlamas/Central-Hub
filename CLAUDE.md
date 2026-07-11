# CLAUDE.md

Operational notes for Claude sessions working on this repo. README.md is the human-facing intro; this file is the working map.

## What this is

A prototype tour-ops hub for one tour manager (not the industry). React + Vite + TypeScript + Tailwind v4 frontend in `web/`. **Default backend is `local`** (localStorage + IndexedDB, no login — everything mocked). A Phase-A **Supabase** backend (auth + one shared tour with role-gated membership) is implemented behind `VITE_BACKEND=supabase` — see "Backend seam" below.

## Current focus — the Start-From-Scratch experience

**The whole app is the Start From Scratch experience** — a new tour manager
landing in an empty app and building a tour by uploading sample files, with a
guided walkthrough. There is no longer a separate demo/prototype mode: the old
static 32-day `mockTour` is no longer an *active tour*, and `data/mockTour.ts`
now survives only as the fixture data the scratch uploads draw from (see "Data
modes" below).

The goal of current work is the *new-user experience*: evaluate pain points,
surface good features, and sharpen information architecture, readability, and
ease of use. See "Data modes" and "Walkthrough" below.

Source-of-truth docs (full index: `docs/README.md`):
- `docs/potential-implementation.md` — build playbook and feature scope
- `docs/tour-management-deep-research.md` — domain research, competitor landscape
- `docs/redesign-plan.md` — the clarity + mobile redesign plan (landed; kept for rationale)
- `docs/pdf.md` — the in-app PDF viewer design, the (unbuilt) text-highlighting plan, and the in-house pdfjs parser notes
- `docs/backend.md` — single source-of-truth for the backend + deployment: multi-user architecture rationale + the Supabase (Postgres + Auth + Storage + Realtime + RLS) build sheet + current implementation state. (Firebase was evaluated then retired.)
- `docs/feature-notes.md` — full operational detail for shipped features (the long version of "Recent additions" below)
- `docs/handoff-post-pdf-interpret.md` — the AI rider analysis; source of the extracted rider data + demo conflicts
- `RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf` — canonical rider test fixture
- `web/public/` holds the uploadable scratch fixtures: the rider PDF, the route CSV, the travel-agent grid CSV, two flight-confirmation PDFs, and **two per-hotel booking-confirmation PDFs (one per hotel)** — see "Fixtures & ingest surfaces" below
- `outdated/` (gitignored) — prototype-era artifacts moved out of the build: the old 32-day route CSV, the booking-agent deal memo, and the orphan AV flight PDF

## Run

```bash
cd web
npm install
npm run dev
```

Opens at `http://localhost:5173`. Vite hot-reloads on save.

There is also a launchable dev server config at `.claude/launch.json` that the preview tools (`mcp__Claude_Preview__preview_*`) hook into when running this from a Claude session.

## Project map

```
web/src/
├── main.tsx                       # AppStateProvider wraps RouterProvider here
├── router.tsx                     # All routes; /print/* is OUTSIDE the main Layout
├── index.css                      # Tailwind v4 + design tokens + @media print rules
├── state/
│   └── AppState.tsx               # tour, currentUser, lockedDays, resolvedConflicts
├── types/
│   └── index.ts                   # All domain types — Tour, Day, ScheduleItem, Visibility, RiderSection, Conflict…
├── data/
│   ├── mockTour.ts                # Fixture data source — groups + rider import + personnel the scratch uploads reuse
│   ├── scratchTour.ts             # createScratchTour() — empty shell the app boots into
│   ├── riderFixture.ts            # Rider clone + named personnel for the scratch rider import
│   ├── flightFixture.ts           # Raw flight data + buildScratchFlightImport (name-matched)
│   ├── hotelFixture.ts            # Per-hotel raw data + buildScratchHotelImport(fixtureId, personnel) — one hotel + tasks per call
│   ├── gearFixture.ts             # buildRiderGearItems() + mergeGearItems() — ~80 GearItems seeded from rider (§6/§9/§13/§14)
│   ├── mockVenues.ts              # Per-venueId mock address/promoter/house-PM info
│   ├── sources.ts                 # MOCK provenance registry (where data should come from)
│   └── realSources.ts             # REAL provenance registry (rider page refs + user entries)
├── lib/
│   ├── visibility.ts              # ABAC resolver: persons > tags > groups > default
│   ├── tourQueries.ts             # Pure tour query helpers (getDay, getScheduleItemsForDay, …)
│   ├── routeCsv.ts                # parseRouteCsv — route CSV → legs/days/schedule skeleton
│   ├── travelGridCsv.ts           # Travel-agent grid CSV → FlightImport[] (one per leg)
│   ├── fixtureMatcher.ts          # FIXTURES registry + matchFixture (filename → known fixture)
│   ├── scratchStorage.ts          # localStorage load/save for the scratch tour
│   ├── overlayStorage.ts          # localStorage load/save for AppState overlays (visibility edits, locks, history, …)
│   ├── riderPdfStore.ts           # IndexedDB `rider-pdfs` store (DB v2) — rider PDF bytes keyed by RiderImport.id
│   ├── documentStore.ts           # IndexedDB `documents` store (DB v2) — general doc bytes (hotel PDFs, future route CSVs)
│   ├── format.ts                  # Date/dayType/scheduleItem formatters
│   ├── riderSections.ts           # §N → page-number map + RiderSectionType → §N
│   ├── today.ts                   # Real clock helpers — getTodayIso() / getNowIso()
│   ├── cn.ts                      # Tailwind class joiner
│   ├── pdfCore.mjs                # Shared pure-ESM PDF helpers — constants + row/col/text utils
│   ├── pdfCore.d.mts              # TypeScript declarations for pdfCore.mjs (bundler resolution requires .d.mts)
│   └── pdfParser.ts               # In-house PDF parser — pdfjs-dist extraction → RiderImport / FlightImport / HotelImport
├── components/
│   ├── ui/                        # Card, Chip, Button, Icon, Modal, CollapsibleSection — primitives
│   ├── ingest/                    # FileDropZone, UploadResultNote — scratch-mode upload UI
│   ├── tour/                      # TourProvider + CoachMark + scratchTourSteps — the walkthrough
│   ├── layout/                    # Layout, PrintLayout, Sidebar, BottomNav, TopBar, ScratchBanner, PageHeader
│   ├── provenance/                # MockTag, MockBadge, SourceTag, DataSourcesPanel, PersonName
│   ├── CommandPalette.tsx         # Ctrl/⌘K palette + provider + hook
│   ├── ConflictFeed.tsx           # Top-level conflict list + intro text
│   ├── ConflictResolveModal.tsx   # Pick value + email PM + mark resolved
│   ├── RiderRef.tsx               # `Stage specs (p.4)` clickable link + linkifyRiderRefs helper
│   ├── RouteMap.tsx               # SVG plot of show cities with numbered legend
│   ├── LobbyCallLadder.tsx        # Back-cascade from doors → soundcheck → load-in → bus → lobby
│   ├── TodaySurface.tsx           # Role-aware "Today" surface — desktop Overview hero + mobile home
│   ├── LastUpdated.tsx            # "Last updated {date} by {name}" audit line
│   ├── PdfViewer.tsx              # In-app PDF modal — PdfViewerProvider + usePdfViewer()
│   ├── ExplainTag.tsx             # Amber "(?)" — plain-English popup for red/alert warnings
│   └── VisibilityEditor.tsx
└── routes/
    ├── TourOverview.tsx           # /
    ├── Calendar.tsx               # /calendar (List/Grid toggle; responsive month grid)
    ├── DayDetail.tsx              # /calendar/:date
    ├── Personnel.tsx              # /personnel
    ├── Plots.tsx                  # /plots (top-level rider plots grid)
    ├── Gear.tsx                   # /gear — Gear & Supplies tracker (status + cost estimates)
    ├── ScheduleAndVisibility.tsx  # /schedule
    ├── DaySheets.tsx              # /daysheet, /daysheet/:date (in-app sheet)
    ├── DaySheetPrint.tsx          # /print/daysheet/:date (printable, no chrome)
    ├── FlightIngest.tsx           # /ingest/flights — "Import route & travel" (route CSV + flights + hotels)
    ├── RiderIngest.tsx            # /ingest/riders
    └── More.tsx                   # /more (mobile overflow menu)

web/tests/                          # Unit tests (vitest) — mirrors src/ structure
├── data/
│   └── scratchTour.test.ts        # createScratchTour shell + scratchUsers derivation
└── lib/
    ├── fixtureMatcher.test.ts     # filename → known fixture matching
    ├── flightImportDiff.test.ts   # duplicate-flight diff (passengers + seats + metadata)
    ├── routeCsv.test.ts           # route CSV parser → legs/days/schedule skeleton
    ├── scratchStorage.test.ts     # localStorage load/save round-trip
    ├── tourQueries.test.ts        # pure tour query helpers (getDay, getScheduleItemsForDay, …)
    ├── travelGridCsv.test.ts      # travel-agent grid CSV → FlightImport[]
    └── visibility.test.ts         # ABAC resolver (persons > tags > groups > default)
```

## Data modes — there is only the scratch tour

There used to be a `dataMode` toggle (`'demo' | 'scratch'`). **Demo mode was
removed.** The app now always runs the build-from-scratch tour; there is no
`/prototype` route, no `enterScratchMode`/`exitScratchMode`, no mode flag.
`data/mockTour.ts` is **not deleted** — it is the fixture data source that
`riderFixture.ts` (rider import + personnel) and `scratchTour.ts` (`groups`)
clone from. Its assembled 32-day `mockTour` object is dead weight kept only so
those `.riderImports` / `.personnel` reads still resolve; it could be slimmed to
a pure fixture module later.

How the scratch tour works:
- `createScratchTour()` (`data/scratchTour.ts`) builds a **minimal shell** — named tour,
  the standard `groups`, one Tour Manager, everything else empty. The app boots into
  this shell when localStorage has no stored tour. (A "blank + setup form" variant —
  TM fills name/artist/dates first — was considered as a future fallback.)
- Rider uploads go through the live parser (`lib/pdfParser.ts`) first; the fixture is
  the fallback when parsing throws AND the filename matches a known rider in `FIXTURES`
  (`lib/fixtureMatcher.ts`). Flight uploads are still filename-matched against `FIXTURES`.
  Route CSVs are genuinely parsed (`parseRouteCsv`). `Fixture.aliases?: string[]` lets one
  fixture entry match multiple filenames — used to map the English-translation and
  side-by-side rider PDFs to the canonical rider fixture so the fallback still resolves.
- Tour mutators live in `AppState`: `applyRouteToScratch`, `addRiderImportToScratch`,
  `addFlightImportToScratch`, `commitFlightImportToScratch`; `resetScratchTour()` wipes
  back to the empty shell. `setActiveRider(id)` promotes any stored rider revision to
  position `[0]` without clearing section approvals/edits.
- **Persistence:** two localStorage keys + IndexedDB, all per-browser. (1) `tour-hub:scratch-tour`
  via `scratchStorage.ts` holds the `Tour` (including the full `riderImports[]` version
  history, `routeImportHistory[]`, and `hotelImportHistory[]`). (2) `tour-hub:scratch-overlays` via
  `overlayStorage.ts` holds every AppState overlay — `lockedDays`, `visibilityEdits`,
  `pendingVisibilityEdits`, `visibilityEditHistory`, `scheduleItemEditHistory`,
  `sectionEdits`, `pendingEdits`,
  `sectionEditHistory`, `sectionApprovals`, `resolvedConflicts`,
  `pendingConflictResolutions`, `dayUpdates`, `dayLockHistory`,
  `flightPassengerResolutions`, plus `userKey`. Maps serialise as entry arrays,
  Sets as plain arrays — both JSON-safe. One `useEffect` watches every overlay
  and writes the whole bundle on any change; `resetScratchTour` clears both keys
  and resets every Map/Set in-memory. (3) IndexedDB `tour-hub` DB (v2, two stores):
  `rider-pdfs` keyed by `RiderImport.id` holds raw PDF bytes for **every** imported
  rider version (not just the active one); on boot AppStateProvider rehydrates Blob
  URLs for all riders missing a `pdfObjectUrl`. `documents` (DB v2 addition) is
  reserved for hotel PDFs and other binary attachments via `lib/documentStore.ts`.
  **Multi-user note:** still per-browser; for a real demo, all three payloads need
  server-side, per-user storage.
- The viewer switcher (`allUsers`) is derived from the tour's own personnel — starts as
  just the TM, grows when the rider import adds the band + crew (`scratchUsers`).

**Fixtures & ingest surfaces** (summary — full detail in `docs/feature-notes.md` § "Ingest deep detail"):

- `web/public/` fixtures: the rider PDF, `mock-tour-route-mexico-7day.csv` (7-day Mexico route, Sep 22–28 2026), `mock-travel-grid-mexico.csv` (travel-agent grid — the bulk flight path), `AM19_…` + `VB1014_…` per-flight e-ticket PDFs, and two per-hotel booking PDFs (`Hotel_CDMX_NH_Reforma_…`, `Hotel_MTY_Fiesta_Americana_…`). Generated by `scripts/gen-flight-pdfs.mjs` — keep the parser anchor labels (`BOOKING REFERENCE / FLIGHT / NAME / SEAT / HOTEL / CHECK-IN …`) and the x-band column constants in `parseFlightPages` (`lib/pdfParser.ts`) in sync with any layout change. This is the "follow along exactly" set the walkthrough references — keep filenames, the `FIXTURES` registry, and the `*Fixture.ts` / `travelGridCsv.ts` files in sync.
- **Flights — two import paths, one review queue.** The grid CSV (one `FlightImport` per leg) and per-flight PDFs both feed `/ingest/flights` Step 2; both dropzones accept multi-file drops. Duplicate detection on `(airline, flightNumber, departDate)` offers **Replace** / **Merge**; additive-only merges into an already-committed import fast-path straight into Travel with no re-approval. Unmatched passenger names get per-row Assign / Add new / Skip at commit (`flightPassengerResolutions`). **Discard** (pre-approve) removes the import + its `tr_${id}_*` Travel + pending resolutions.
- **Hotels — one PDF per hotel**, multi-drop; each runs `parseHotelPdf` (or the fixture fallback) → one `Hotel` + advance `Task`s. Direct import, no review step.
- **Re-upload = update.** Route and hotel summaries have a Re-upload toggle instead of Cancel: a new file replaces live data, bumps `UpdateStamp.updates` (audit line flips "Imported" → "Updated"), and pushes the old stamp into `routeImportHistory[]` / `hotelImportHistory[]` (surfaced as history panels in `FlightIngest`). `cancelRouteImport` / `cancelHotelImport` exist on AppState but aren't surfaced — the global Reset in `ScratchBanner` is the wipe path.

The four imports each have a data file + an AppState mutator: route
(`routeCsv.ts` → `applyRouteToScratch`), rider (`riderFixture.ts` →
`addRiderImportToScratch`), flights (`flightFixture.ts` →
`addFlightImportToScratch` + `commitFlightImportToScratch`), hotels
(`hotelFixture.ts` → `addHotelImportToScratch`). The hotel import is direct (no
review step) — it adds `Hotel` records keyed to check-in days plus a few
hotel-advance `Task`s, so the Day Sheet's Hotel and Tasks panels have content.

## Walkthrough (coach-mark tour)

`components/tour/` is an interactive coach-mark walkthrough over the onboarding
(structure modelled on the iOS app's llama-intro tour):

- `TourProvider.tsx` — mounted inside `Layout` so it persists across routes and can
  read both `useApp()` and the router. Tracks the active step, **auto-navigates** to
  each step's route, and **auto-advances** a hands-on step once its `advanceWhen(tour)`
  predicate is satisfied (e.g. route imported → days appear). Auto-starts once for a
  new scratch user; `tour-hub:walkthrough-seen` suppresses re-nagging. `useTour()` hook.
- `CoachMark.tsx` — the overlay: a box-shadow spotlight cut-out + halo on the step's
  `data-tour` target, with an instruction bubble (Back / Next / Skip / dots). The dim is
  `pointer-events-none` so the user interacts with the real UI through it. Centered
  bubble for transition steps. Respects `prefers-reduced-motion`.
- `scratchTourSteps.ts` — the 15 steps: the 4 hands-on imports (route → rider → flights
  → hotels), each with a spotlit dropzone, interleaved with transition beats; then 6
  centered feature steps that tour the post-ingest surfaces (Calendar, Day Sheet, **day-sheet
  Edit mode**, day locking, conflicts, schedule permissions); then a closing step.
- Targets are `data-tour="…"` attributes (`FileDropZone` has a `tourAnchor` prop; plus
  `flight-approve`, `rider-sections`). Feature steps omit `target` and use a centered
  bubble. The `/` intro screen (`ScratchGetStarted` in `TourOverview`) and the
  `ScratchBanner` both expose a "Start the walkthrough" button.
- **Anchor on the actual element the user should interact with, then drive surrounding
  state so it's visible.** Earlier we anchored `hotel-dropzone` on the outer wrapper of
  the Hotels `CollapsibleSection` so the spotlight wouldn't collapse when the section
  was closed — but that pointed the spotlight at the *header* instead of the dropzone.
  The right pattern: anchor on the inner `FileDropZone` (via `tourAnchor`) and force
  the section open while the step is active. `FlightIngest` does this by reading
  `useTour().step?.id` and OR-ing it into each section's `defaultOpen` (route → `route`,
  flights → `flight` / `flight-approve`, hotels → `hotel`). `CollapsibleSection` re-runs
  an effect on `defaultOpen` flips, so the section auto-expands as the walkthrough
  advances. If the user back-navigates after the import completed (dropzone replaced by
  a summary card), the spotlight falls back to centered — acceptable trade-off.

When adding a tour step, add its `data-tour` anchor on the element to spotlight, make
sure any surrounding collapsible/conditional state is opened while the step is active,
and add a step to `scratchTourSteps.ts`. Keep step copy short and warm.

## The fixture data at a glance

`data/mockTour.ts` is the fixture source the scratch uploads draw from — its
`riderImports[0]` + `personnel` feed `riderFixture.ts`, its `groups` feed
`scratchTour.ts`. It is no longer rendered as a tour itself.

- **Real clock:** `lib/today.ts` exports `getTodayIso()` and `getNowIso()` — both use `new Date()` (local time). Every "today" lookup goes through these helpers, never inline `new Date()`. The sample route CSV covers Sep 22–28 2026; since that's a future tour, the Today surface shows nothing until those dates arrive — the correct pre-tour state.
- **Personnel (13):** 5 named from rider (Elsa Carvajal, Julian Bernal, Juan, Daniel, Manuel González PM) + 8 placeholders (Tour Manager, Audio Engineer, Lighting Engineer, VJ, MUA, Personal Asst, Staff #1, Staff #2). Last names for Juan/Daniel and full names for every placeholder are pending user input.
- **Lock state:** the scratch tour starts with **nothing locked** — the user builds lock state up themselves. (Demo mode used to pre-lock Sep 22–25; that seed is gone.)

## Data quirks (worth knowing)

- **Hotels are keyed to check-in day**, not subsequent show nights. So `getHotelsForDay('day_2026-09-25')` returns nothing even though the band is staying somewhere; check `day_2026-09-22` for the CDMX block. This is a real data-model issue, not a bug to silently fix — surface to user before changing.
- **Conflicts ARE real.** They were extracted from `docs/handoff-post-pdf-interpret.md` (the AI analysis of the rider PDF). Only the *detector* is automated; the contradictions themselves exist in the actual rider.
- **Schedule item TIMES are mock**, but some constraints attached to them are real (e.g., the soundcheck `6h min from load-in` rule comes from rider §10 and is rendered as an `(i)` next to the soundcheck row).
- **Venue addresses + promoter contacts in `mockVenues.ts` are mock.** The rider never contains venue routing — that's the booking agent's deal-memo job.

## Provenance system (load-bearing)

> **Mock provenance flags were REMOVED app-wide.** `MockTag`, `MockBadge`, and
> `DataSourcesPanel` now early-`return null` (call sites kept, zero layout risk,
> reversible via git history) — there is no more grey "(mock)" text or
> "where this data comes from" panel. The blue real-source **`SourceTag`** `(i)`
> citation is **kept**. `data/sources.ts` stays (only the 3 null'd components
> imported it). The text below describes the original paired system for context;
> only the `SourceTag` half is live today.

Two registries + two visual components, **always paired**:

| Kind | Registry | Component | Visual | Click result |
|---|---|---|---|---|
| Mock data | `data/sources.ts` (`SourceKey`) | `<MockTag source="..." />` | Small grey `(mock)` text | Modal explaining where the data WOULD come from in production |
| Real data | `data/realSources.ts` (`RealSourceKey`) | `<SourceTag source="..." />` | Tiny ocean-blue `(i)` circle | Modal showing document/section/page + verbatim quote + link to source |

Rules:
- **Every visible value should have one or the other.** If you add a UI surface, tag the data.
- **Provenance copy is plain English, no jargon.** The `source` / `detail` / `productionNote` strings in `sources.ts` (and the modal chrome in `MockTag`/`SourceTag`/`DataSourcesPanel`) are written for a non-technical tour manager: say *which file or input* fills a value and *who* enters it — not "structured-output extractor", "R2", "ABAC", "Claude Sonnet". `realSourceLabels` reads "Read from an uploaded file" / "Typed in by the team" etc. Keep new entries in that voice.
- Both tags are `print:hidden` so they don't clutter physical printouts.
- Section-level tagging (e.g. `<MockTag source="schedule_item">` on the "Show clock" section title) is preferred over per-row when the source is uniform.
- For free-text strings that mention `§N` (rider sections), use `linkifyRiderRefs(text)` from `components/RiderRef.tsx` — it converts each `§N` substring into a clickable `p.N` link that opens the rider PDF at that page.

`<LastUpdated stamp={...} />` (`components/LastUpdated.tsx`) is a paired surface for the `audit_trail` mock source — it renders a "{label} {date} by {name}" line (label defaults to "Last updated"; pass `label="Approved"` for sign-offs) and carries its own `<MockTag source="audit_trail">`. The line itself prints; only the MockTag self-hides.

`<ExplainTag>` (`components/ExplainTag.tsx`) is a sibling pattern for *warnings*, not provenance: a small amber "(?)" next to any red/alert element opens a plain-English, non-jargon explanation (with a rider-page link where relevant). Presets `SensitiveExplain` / `ConflictExplain` / `ExcludedBrandExplain` single-source the repeated copy.

## Rider section references (`§N`)

Display rule: **don't show `§N` in the visible UI** (it's industry jargon). Use `<RiderRef>` to render `Stage specs (p.4)` (name + parenthesized page link) for structured refs, or `linkifyRiderRefs(text)` to swap inline `§N` substrings → `p.N` links inside descriptions/suggestions.

`§N` → page mapping is in `lib/riderSections.ts`. Pages come from the actual PDF (e.g., §8 lighting starts on page 9, not 8).

## Visibility model

ABAC. Each schedule item / travel / hotel / task / doc carries a `Visibility` blob with `default + groups + tags + persons` overrides. **Most specific wins.** Levels: `blocked < sees < needs < owns`. The resolver lives in `lib/visibility.ts`.

Key facts (full UI detail in `docs/feature-notes.md` § "Visibility deep detail"):

- **Seed policy — everyone-sees, managers-edit** (`lib/visibilityDefaults.ts`): every type seeds `{ default: 'sees', groups: { grp_mgmt: 'owns', grp_production: 'owns' } }` — members view, TM/PM edit. localStorage caveat: `visibilityDefaultsByType` is baked in at tour creation, so changing the seed only affects tours created afterward (Reset picks it up).
- **Saves cascade by type** on `/schedule`: a manager's Save writes the same visibility into every existing item of that type AND bumps `Tour.visibilityDefaultsByType[type]` for future items (`saveVisibilityForType`). Non-managers propose per-item. Per-item drift isn't expressible from this surface (escape hatch not built).
- **"Defaults by type"** opens `TypeDefaultsEditor` (compact editor) to edit the per-type template; **"Sync to all N existing items"** pushes it into existing items via `applyTypeTemplateToAllItems` (writes through `visibilityEdits`, so each item gets history + the live effect flips).
- **`VisibilityEditor`** (non-compact): Set-all floor row + pinned `grp_mgmt`/`grp_production` rows that survive bulk actions; group rows expand to tag/person overrides; inherited levels render with a soft highlight.

The TopBar viewer switcher (Tour Manager / Manuel / Audio / Elsa / Julian / MUA) re-renders the Day Detail and Day Sheets pages from that user's perspective. This is the killer demo for the visibility model — same data, different views.

## State (AppState)

Lives in React Context (`state/AppState.tsx`). The single provider is mounted **in `main.tsx`** (inside `AuthProvider` → `AuthGate`) so it wraps both `Layout` and `PrintLayout` — that's why locking a day in `/daysheet` updates `/print/daysheet` instantly.

Currently exposes:
- `tour`, `user`, `userKey`, `setUserKey`, `allUsers` — `tour` is the build-from-scratch tour (restored from localStorage, or a fresh shell); `allUsers` is derived from the tour's personnel. `userKey` is a plain `string` (scratch keys aren't compile-time known)
- `resetScratchTour()` and the tour mutators `applyRouteToScratch` / `addRiderImportToScratch` / `addFlightImportToScratch` / `commitFlightImportToScratch` / `addHotelImportToScratch` — see "Data modes" above
- `gearItems`, `updateGearItem(id, patch)`, `addGearItem(init)`, `deleteGearItem(id)` — gear & supplies list; persisted in `overlayStorage`; seeded from rider on first import
- The tour query helpers `getDay` / `getDayById` / `getScheduleItemsForDay` / `getTravelForDay` / `getHotelsForDay` / `getTasksForDay` / `getTourPersonById` / `getGroupById` / `getGroupTagById` / `getAllConflicts` — pure functions in `lib/tourQueries.ts`, re-exposed here **bound to the active tour**. Always call them via `useApp()`, never import from `mockTour.ts`. **`getScheduleItemsForDay` layers the in-memory `visibilityEdits` overlay onto each item before returning** so `it.visibility` resolves against the manager's saved edits — never the seed. Every read site (`DayDetail`, `DaySheets`, `TodaySurface`) gets this transparently; do not bypass the helper by reading `tour.scheduleItems` directly when filtering by visibility.
- `updateScheduleItem(itemId, patch)` / `addScheduleItem(dayId, init?)` / `deleteScheduleItem(itemId)` / `getScheduleItemHistory(itemId)` — manager edits to schedule-item content (times / title / location / notes / type) plus add + delete. **These mutate the tour directly** (rebuild `tour.scheduleItems` + persist), not an overlay, so every read site reflects them — including the two that read `tour.scheduleItems` directly (`CommandPalette`, `ScheduleAndVisibility`). Each call live-stamps the day (`stampDay`) and appends a `ScheduleItemEditRecord` to the `scheduleItemEditHistory` overlay (`status: 'direct' | 'created' | 'deleted'`), mirroring `VisibilityEditRecord`. Manager-only surface today — no propose/approve yet. `addScheduleItem` seeds visibility from `getScheduleTypeDefault(type)` and returns the new id.
- `lockedDays`, `isDayLocked(id)`, `toggleDayLocked(id)`, `setDayLocked(id, locked)`
- `getDayLastUpdated(day)` — resolves a `Day`'s last-updated `UpdateStamp` against an in-memory `dayUpdates` overlay (falls back to seeded `day.lastUpdated`); locking/unlocking a day live-stamps it with `MOCK_NOW` + current viewer
- `resolvedConflicts`, `resolveConflict(id, {chosenValue, source?, note?})`, `unresolveConflict(id)` — `resolveConflict` stamps `MOCK_NOW`
- `isSectionApproved(key)` / `getSectionApproval(key)` / `approveSection(key)` / `reopenSection(key)` — rider-section sign-off, keyed `${type}-${index}`; approvals seed from sections whose mock status is `approved` and stamp `MOCK_NOW` + current viewer
- `getSectionEdit(key)` / `updateSectionEdit(key, patch)` — inline corrections (`RiderSectionEdit`) layered over the AI extraction

When backend lands, replace with TanStack Query + Zustand or similar; the context shape is intentionally stable so callers don't have to change.


## Backend seam (auth + cloud sync)

> Summary — schema, RLS policies, auth flow, membership model, and AppState wiring live in `docs/backend.md` (Parts 2–3). Read it before touching `lib/backend/*`, `lib/supabase/*`, or `supabase/`.

All persistence routes through one interface: `lib/backend/types.ts` → `Backend` (`subscribeTour` / `saveTour` / `loadOverlays` / `saveOverlays` / `loadPdf` / `savePdf` / `deletePdf` / `clearAll`, plus optional membership methods). `lib/backend/index.ts` selects the impl from `VITE_BACKEND` (default **`local`**): `local.ts` wraps today's localStorage + IndexedDB modules verbatim; `supabase.ts` persists the shared `Tour` + overlays as JSONB rows and PDF bytes to tour-scoped Storage paths (`{tourId}/{scope}/{id}.pdf`). **The `local` path is byte-for-byte unchanged** — every supabase behavior is gated on `BACKEND_KIND === 'supabase'`, and the Supabase SDK only loads via dynamic import.

The supabase model is **one shared tour** set up by the TM/PM; crew join by email (`tour_members`, role-gated, `claim_membership()` RPC on login) and see the app filtered to their role. Managers may preview-as via the TopBar switcher; non-managers are pinned to their membership identity, and manager-only writes are gated by `isManagerMember`. `/access` → `AppUserPermissions` is the manager roster (assign role+group, add by email, revoke; TM/PM cannot be revoked — UI + DB trigger). Overlays are tour-shared; only the per-user `userKey` stays client-side. `AuthProvider` / `AuthGate` gate only on supabase — `local` reports a synthetic active-TM membership and is never gated; on supabase the tour cloud-boots (`booting` flag on `useApp()`, spinner in `Layout`) and writes are debounced ~500ms.

**⚠️ Client-side privacy caveat (accepted this milestone):** privacy *between active members* is UI-only — the full Tour JSONB reaches every member's browser. Safe for a trusted-crew demo; before untrusted members, do the Phase B per-row `readable_by` RLS decomposition drafted in `supabase/migrations/0001_init.sql`.

## Routing

```
/                          Tour Overview — Start From Scratch homepage by default
/calendar                  Month grid
/calendar/:date            Day Detail
/personnel                 Crew + groups
/plots                     Top-level rider plots grid (stage plot + lightplot thumbnails)
/gear                      Gear & Supplies tracker — all rider items, status + cost estimates
/me                        My Travel & Info — every member's personal page (flights/hotel/schedule/plots + their submissions + Submit a document)
/submissions               Submissions inbox — manager-only review of crew-submitted documents (approve → persists / reject)
/schedule                  Visibility editor
/daysheet                  In-app day sheet (defaults to first show)
/daysheet/:date            In-app day sheet for a date
/ingest/flights            Import route & travel (route CSV + flight PDFs)
/ingest/riders             Rider ingest (the differentiator)
/more                      Mobile overflow menu (links not in the bottom-nav)
/print/daysheet/:date      PRINT route (no sidebar/topbar) — outside Layout
```

Two layout wrappers in `router.tsx`:
- `<Layout>` — sidebar (desktop) + mobile bottom-nav + topbar + main content
- `<PrintLayout>` — bare wrapper, just paper background + Outlet (no chrome)

If you add a route that should be printable / shareable / chrome-free, put it under `/print/...`.

## Conventions

- **`managerView` pattern for role-gating UI.** Management-only controls (lock/publish buttons, Edit mode toggle, viewer switcher, attention links) are gated with `const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production'`. Non-managers are always in their personal/filtered view — they never see TM publishing tools. Apply this consistently: `TodaySurface`, `DaySheets`, `DayDetail`, and `RiderIngest` all use it. The check intentionally lives at the component level (derived from `user` in AppState), not in the router, because the role-switcher is a demo tool that changes the viewer mid-session.
- **Pending-edit approval workflow.** Non-managers can propose corrections to rider sections; managers review and approve/reject. Edits on ingest pages go through `proposeSectionEdit(key, patch)` for non-managers (stored in `pendingEdits` Map in AppState with an `UpdateStamp`) vs `updateSectionEdit(key, patch)` for managers (immediate effect). Approving via `approvePendingEdit(key)` merges the patch into `sectionEdits` atomically and stamps with the manager's name + `MOCK_NOW`. Rejecting via `rejectPendingEdit(key)` discards the proposal. The pending state is surfaced in `RiderIngest` as an amber banner on the section detail and an amber dot on the section list item. The pattern: check `managerView` and route to the right action — `editOrPropose` helper in `SectionView` does this in one line.
- **Pending conflict resolution workflow.** The same approval pattern applies to rider conflicts. Non-managers call `proposeConflictResolution(id, {chosenValue, source?, note?})` (stored in `pendingConflictResolutions` Map in AppState with `proposedAt: UpdateStamp`). Managers can call `approvePendingConflictResolution(id)` — which internally calls `resolveConflict` stamping `proposedAt` from the proposal and `resolvedAt/resolvedBy` from the approving manager. Rejecting via `rejectPendingConflictResolution(id)` clears the proposal. `ConflictResolveModal` has three branches: resolved (re-open gated to managers), pending (Approve/Reject for managers; Cancel for non-managers), and the form (Mark resolved for managers; Propose resolution for non-managers). `ConflictFeed` (on Tour Overview) shows a "pending" label and role-appropriate button labels. The `ConflictResolution` type carries an optional `proposedAt?: UpdateStamp` so the full two-person audit trail is preserved in the resolved record.
- **Tailwind only**, no styled-components or CSS Modules. Tokens defined in `index.css` `@theme` block.
- **Inline SVG icons** in `components/ui/Icon.tsx` — add new icons there, not via an icon library.
- **Modals always portal to `document.body`** via `createPortal` — needed because day-sheet rows are inside `<Link>` and a modal inside an anchor is invalid HTML. Same applies to floating tooltips/popovers anchored to a trigger inside a card with `overflow:hidden` (e.g. `MockBadge` popover): portal to body + position with `fixed` + viewport-aware top/left from `getBoundingClientRect`. See `components/ui/Modal.tsx`, `CommandPalette.tsx`, and `components/provenance/MockBadge.tsx` for the pattern.
- **PDF references open in-app, never a new tab.** Call `usePdfViewer().openPdf({ url, page?, title? })` (`components/PdfViewer.tsx`). The active rider PDF is whatever the user uploaded. `useActiveRiderPdfUrl()` is local to `RiderIngest.tsx` (not exported); other files read `tour.riderImports[0]?.pdfObjectUrl` directly (e.g. `RiderRef`, `ExplainTag`) or go through `resolveProvenanceUrl` (`SourceTag`, `MockTag`). When the URL is undefined (no rider imported yet), HIDE the open-PDF affordance — don't fake a disabled link, don't fall back to a canonical fixture. `RIDER_PDF_PATH` from `lib/riderSections.ts` is fixture-seed only: the canonical Spanish PDF path that `data/riderFixture.ts` and `hydrateRiderPlotImages` use on the fixture-fallback path. **PDF persistence:** localStorage strips `pdfObjectUrl` on save (Blob URLs are session-scoped); raw bytes are persisted to IndexedDB via `lib/riderPdfStore.ts` (one object store, keyed by `RiderImport.id`, native API no deps). `saveRiderPdf` runs after parse and on fixture-fallback (fetches `RIDER_PDF_PATH`); `AppStateProvider` has a boot effect keyed on `riderImports[0].id` that calls `loadRiderPdf`, mints a `Blob` URL, and patches `pdfObjectUrl` back onto the import. `cancelRiderImport` calls `deleteRiderPdf`; `resetScratchTour` calls `clearAllRiderPdfs`. Don't add `<a href="….pdf" target="_blank">`.
- **Click handlers inside provenance tags + RiderRef use `e.stopPropagation()`** so they work when nested inside parent links.
- **CSS Grid items that hold variable-width content need `min-w-0`** to prevent the column blowing out the grid (this bit us in `RiderIngest`'s section detail column — fixed but worth remembering).
- **Print sheet is letter-size (8.5" wide, 816px @ 96 DPI).** `@media print` in `index.css` strips paper grain, gradients, action bar, and provenance markers. `print:hidden` on Tailwind utilities handles per-element hiding.
- **Dense routes provide a real mobile layout, not a squeezed desktop one.** Personnel pairs a `md:hidden` card list with a `hidden md:table` table; DaySheets splits `lg:hidden` mobile vs `hidden lg:grid` desktop; Calendar exposes a user-facing List/Grid toggle (defaults to List on mobile). Navigation follows the same idea — desktop `Sidebar` vs mobile `BottomNav`.
- **Don't write multi-line comments** unless explaining non-obvious WHY (project-wide style — keep code lean).

## How to add common things

**A new route in the main app:**
1. Create `web/src/routes/Foo.tsx` exporting a named component
2. Register in `web/src/router.tsx` under the `/` Layout children
3. Add a sidebar nav entry in `web/src/components/layout/Sidebar.tsx` if it's a top-level surface
4. Add to the Cmd+K index in `web/src/components/CommandPalette.tsx` (`buildIndex` → pages array)

**A new mocked entity:**
1. Add data to `web/src/data/mockTour.ts` with a comment noting REAL vs MOCK
2. Add an entry to `web/src/data/sources.ts` if it's a new category
3. Wrap visible values with `<MockTag source="your_key" />` or section-level `mockSource` prop

**A new real-data field (rider extraction):**
1. Add the value to `mockTour.ts` (sourced from `docs/handoff-post-pdf-interpret.md` analysis)
2. Add an entry to `web/src/data/realSources.ts` with `document/section/pages/quote`
3. Render the value with `<SourceTag source="your_key" field="..." />` next to it

**A new conflict source page in the rider:**
1. Update `RIDER_SECTIONS` in `web/src/lib/riderSections.ts` (it's the canonical map)
2. `<RiderRef>` and `linkifyRiderRefs()` will auto-pick it up

## Recent additions (most likely to need extension)

> One-liners only — the full operational note for each lives in `docs/feature-notes.md`. Read the matching entry there before extending any of these.

- **Shareable day sheet link** — tokenized `/print/daysheet/:date?token=…` via `lib/shareToken.ts` (mock tokens; recipient needs the tour in their own browser).
- **In-house PDF parser** (`lib/pdfParser.ts` + shared `lib/pdfCore.mjs`) — TOC-driven rider sectioning, flight/hotel parsers, plot-page detection, per-page free text with chrome strip; CLI mirror `scripts/parse-rider.mjs` (keep in sync). Design + quirks: `docs/pdf.md`.
- **Clarity + mobile redesign** — `TodaySurface` (desktop Overview hero + mobile home), `BottomNav`, `/more` overflow.
- **Day-sheet Edit mode** — manager-only inline schedule editing with batch Save/Discard, add/delete, per-day edit history; time helpers in `lib/time.ts`; `EditableText`/`EditableSelect` in `components/ui/`.
- **Schedule Permissions add/delete** — `NewScheduleItemModal` + Delete on the item-header card on `/schedule`.
- **Density toggle removed** — one default layout; Tour Overview secondary surfaces are collapsed-by-default `CollapsibleSection`s (`RouteMap` takes `embedded`).
- **Last-updated audit line** — `<LastUpdated>` on Today / DaySheets / print / DayDetail; lock + conflict-resolve actions live-stamp the day.
- **Printable day sheet** (`/print/daysheet/:date`) — venue/promoter info from `mockVenues.ts`; a new show city needs an entry there.
- **Per-day lock state** — chips in DaySheets/Calendar/Overview; `DayLockRecord` history with reason prompt + "N lock events" accordion.
- **Conflict feed + resolution flow** — conflicts model *cross-document* disagreement (new rider version vs on-file), not intra-rider contradictions; resolve modal pre-fills mailto to the PM; `pp. N` page links open the rider PDF in-app.
- **Rider section review** — TOC-driven two-pane surface on `/ingest/riders`: unapproved sections in the rail + "Plots" entry, embedded PDF left / editable extraction right; plot-type sections get an image-stack review (no text pane).
- **Document submissions (Milestone 2)** — `/me` (every member's personal page + "Submit a document") and `/submissions` (manager inbox: approve → attach + parse into Travel/Hotels, or reject with reason). `/ingest/*` are manager-gated.
- **Plots** — `/plots` top-level thumbnail grid + rider-ingest Plots tab; PNGs rendered via pdfjs, stripped from localStorage and re-derived on boot.
- **In-app PDF viewer** — `usePdfViewer().openPdf(...)` modal + `PdfViewerInline` for embedding; never open PDFs in a new tab. See `docs/pdf.md`.
- **Warning explainers** — `<ExplainTag>` amber "(?)" popovers on every red/alert element.
- **Gear & Supplies tracker** (`/gear`) — ~80 items seeded from the rider, status cycling, cost totals; smart merge on rider re-upload (`mergeGearItems` keeps user edits).
- **Hotel import** — 4th uploadable fixture; one PDF per hotel, direct import (no review step).
- **Travel-agent grid CSV** — bulk flight import (`lib/travelGridCsv.ts`), one `FlightImport` per leg; the walkthrough spotlights it as the fast path.
- **Generated fixture PDFs** — `scripts/gen-flight-pdfs.mjs` (pdf-lib); WinAnsi caveat: Helvetica can't encode `→`, use `›`.
- **Cmd+K palette**; **Route map** (hard-coded city lat/lngs in `RouteMap.tsx`); **Calendar List/Grid toggle**; **Lobby-call ladder** (anchors on the `doors` item).
- **Multi-rider version history** — uploads prepend to `riderImports[]`; `setActiveRider(id)` promotes without clearing approvals; route/hotel upload history panels in `FlightIngest`.

## Pending user-blocked items

The tour roster still has placeholder names waiting for user input:
- Juan, Daniel — last names (drummer + bassist, named in rider §6 monitor mixes but no surnames)
- Tour Manager — real name + contact info. The scratch TM is the placeholder name **"Tour Manager"** (`scratchTour.ts`); the flight/hotel fixtures use the same literal string so passenger/rooming name-matching connects.
- Audio Engineer (FOH + Monitors), Lighting Engineer, VJ, MUA, Personal Assistant, Staff #1, Staff #2 — full names

Once provided, update `persons[]` in `web/src/data/mockTour.ts` and remove `isPlaceholder: true` from the corresponding `TourPerson` entries. For the TM, also update the scratch TM name in `web/src/data/scratchTour.ts` and the matching passenger/rooming names in `flightFixture.ts` / `hotelFixture.ts` (and re-run `gen-flight-pdfs.mjs`), and re-add a `realSources` entry if you want the `(i)` provenance modal to point to "user entry".

## What's still on the gap list (from the audit)

Tier 1 untouched: *(all shipped)*

Tier 2:
- **i18n posture (near-term).** The rider section model now respects the source-language TOC: `RiderSection.title` carries the rider's verbatim heading ("Hospedaje", "Iluminación y Lightplot") and the review UI shows it as-is. `SECTION_LABELS` (English) is only a fallback when no `title` is present. We do NOT translate strings in the UI today; the eventual plan is separate Spanish + English locales (the app's chrome translates, the rider content stays verbatim in its source language). When wiring locale switching, target `SECTION_LABELS`, the section detail descriptions ("44 channels…"), and the conflict copy — but leave anything sourced from a `RiderSection.title` / `.freeText` alone.
- PDF text highlighting — the viewer + jump-to-page are done, but auto-highlighting the cited text is blocked on a data issue (Spanish PDF vs. English citations). Plan + fix in `docs/pdf.md`.
- Inline editing for the nested rider sections — Backline, Catering, and Lodging are still review-only; only the tabular sections (Input List, Monitor Mix, FOH Outputs) and free-text sections are inline-editable today. Eventually every section type should be correctable.
- Diff between rider versions
- Catering allergy/diet aggregator
- Promoter contact card as a first-class entity
- Timezone-aware times throughout
- Flight passenger matching + Personnel edits: when these surfaces are wired, apply the pending/approval + history pattern (`PendingEdit` + `SectionEditRecord`-style log). TODOs are in the source files (`FlightIngest.tsx`, `Personnel.tsx`).

Shipped (recent):
- Multi-rider version history, route/hotel upload history, general `documentStore.ts`, gear smart-merge on re-import, flight additive-only merge fast-path — see "Recent additions" above.
- `DayLockRecord` pattern — day lock records a reason + full per-day history via `getDayLockHistory(dayId)`. `toggleDayLocked`/`setDayLocked` take an optional `reason?` and push a record on every change. Surfaced in `DaySheets` as a reason prompt + a "N lock events" accordion.
- Visibility edit workflow — `/schedule` visibility edits persist to AppState with the pending/approval workflow and `VisibilityEditRecord` history (same shape as `SectionEditRecord`). `computeVisibilityChanges` diffs the Default / Group / Tag / Person levels. Managers edit directly via `updateVisibilityEdit`; non-managers `proposeVisibilityEdit` and a manager approves/rejects. Keyed by schedule-item id.

(Shipped from earlier backlogs — see "Recent additions": the mobile-shaped day sheet, mobile bottom-nav, Today screen, last-updated indicator, and tap-to-call / WhatsApp / maps deep links on the Today surface, mobile day sheet, and print sheet. The Simple/Pro density toggle was later removed.)

See the original audit output / `docs/potential-implementation.md` §9 for the full backlog.
