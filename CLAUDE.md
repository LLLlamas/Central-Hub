# CLAUDE.md

Operational notes for Claude sessions working on this repo. README.md is the human-facing intro; this file is the working map.

## What this is

A multi-tour production/logistics hub for touring professionals. React + Vite + TypeScript + Tailwind v4 frontend in `web/`. **Default backend is `local`** (localStorage + IndexedDB, no login — everything client-side). A Phase-A **Supabase** backend (auth + one shared tour with role-gated membership) is implemented behind `VITE_BACKEND=supabase` — see "Backend seam" below. Note: the supabase backend does not yet support multiple tours per account (`MyShows.tsx` redirects straight into the caller's one membership tour on that backend) — multi-tour is a `local`-only capability today.

`/` is **My Shows** (`routes/MyShows.tsx`) — every tour a TM/PM runs, grouped by status (on tour / upcoming / drafts / completed) with a map, plus "+ New show". Every other surface lives nested under `/t/:tourId/...`. Within a tour, the TM/PM:
- **Authors the rider directly in-app** from a 14-section consensus table of contents (`routes/RiderBuilder.tsx`, `lib/riderBuilder.ts`) — add/remove/reorder/rename sections, with real inline editors for every section type including the three that used to be review-only (Backline, Lodging, Catering: `components/rider/*Editor.tsx`). The old "upload a PDF and extract it" path still exists as a fallback (`lib/pdfParser.ts`), used when there's no time to author from scratch or the TM has an existing rider PDF.
- **Sends the rider to each show's venue and negotiates it** — a venue-advance board (`routes/Advance.tsx` + `routes/AdvanceDetail.tsx`) per show, the venue responds per item (have/partial/don't-have/acknowledged/issue) via a simulated venue persona (`grp_venue`, using the existing viewer-switcher mechanism), and the TM reconciles any gap (`components/ReconcileModal.tsx`) until every item is confirmed.
- **Attaches stage-design media** — a gallery of pasted Dropbox/YouTube/Vimeo links or uploaded photos/video on the rider's "Stage design" section (`components/StageMediaEditor.tsx` / `StageMediaGallery.tsx`), with a persistent "peek" strip while authoring any other section.
- Gives crew a **derived "recent updates" feed** (`lib/updatesFeed.ts`, `components/UpdatesFeed.tsx`) that folds every edit-history overlay into one plain-English, no-asking-required timeline, plus simple last-updated lines on Gear and Plots.

**Flights are de-scoped, not deleted** — the flight-import/review workflow is hidden behind `lib/features.ts`'s `FLIGHTS_ENABLED = false` flag. The code, the flight-PDF/travel-grid-CSV fixtures, and the flight tests all still exist; flip the flag to re-enable. `/ingest/flights` is now framed as "Import route & hotels".

There is **no coach-mark walkthrough** (`components/tour/` was deleted entirely, no replacement) and **no "mock data" provenance system** (`MockTag`/`MockBadge`/`DataSourcesPanel`/`data/sources.ts` were deleted entirely — not null'd, gone). See "Provenance system" below for what's left (the real-source `SourceTag`).

This is the seventh and final phase of a product overhaul that, across six prior phases on this branch, turned the app from a single-tour "upload a rider PDF and review it" prototype into the shape described above. This phase is a closing pass only: copy coherence, this doc, and end-to-end verification — no new features.

Source-of-truth docs (full index: `docs/README.md`):
- `docs/potential-implementation.md` — build playbook and feature scope (original spec; several sections predate the rider-authoring/venue-negotiation/multi-tour work)
- `docs/tour-management-deep-research.md` — domain research, competitor landscape
- `docs/redesign-plan.md` — the clarity + mobile redesign plan (landed; kept for rationale)
- `docs/pdf.md` — the in-app PDF viewer design, the (unbuilt) text-highlighting plan, and the in-house pdfjs parser notes
- `docs/backend.md` — single source-of-truth for the backend + deployment: multi-user architecture rationale + the Supabase (Postgres + Auth + Storage + Realtime + RLS) build sheet + current implementation state
- `docs/feature-notes.md` — full operational detail for shipped features (the long version of "Recent additions" below)
- `docs/handoff-post-pdf-interpret.md` — the AI rider analysis; source of the extracted rider data + the conflicts the fixture rider carries
- `RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf` (+ English translation + side-by-side variants) at repo root — canonical rider test fixture, also mirrored into `web/public/` for in-app upload
- `web/public/` holds the uploadable fixtures a new tour is built from: the rider PDF (+ translation variants), `sample-tour-route-mexico-7day.csv` (7-day Mexico route), `sample-travel-grid-mexico.csv` (travel-agent grid — dormant while `FLIGHTS_ENABLED` is false), per-flight e-ticket PDFs (dormant, same reason), and two per-hotel booking-confirmation PDFs

## Run

```bash
cd web
npm install
npm run dev
```

Opens at `http://localhost:5173`. Vite hot-reloads on save. `npm run typecheck` runs `tsc -b --noEmit` (project references — a bare `tsc --noEmit` checks zero files, always "succeeds").

There is also a launchable dev server config at `.claude/launch.json` that the preview tools (`mcp__Claude_Preview__preview_*`) hook into when running this from a Claude session.

## Project map

```
web/src/
├── main.tsx                       # MigrationGate → AuthProvider → AuthGate → PdfViewerProvider → RouterProvider
├── router.tsx                     # '/' = MyShows; everything else nested under /t/:tourId (Layout + print sub-tree)
├── index.css                      # Tailwind v4 + design tokens + @media print rules
├── state/
│   ├── AppState.tsx                # tour, booting, user, every overlay Map + mutator — see "State (AppState)"
│   └── AuthProvider.tsx            # Auth context; no-op passthrough on `local`, real Supabase auth state on `supabase`
├── types/
│   └── index.ts                   # All domain types — Tour, Day, ScheduleItem, RiderImport/RiderSection, ShowAdvance,
│                                   #   NegotiationThread, StageMediaItem, TourSummary, Membership, GearItem…
├── data/
│   ├── fixtures/
│   │   └── riderSeed.ts           # Raw over-split rider fixture content (personnel + sections) — riderFixture.ts's source
│   ├── riderFixture.ts            # Collapses riderSeed into the 14-entry TOC + hydrateRiderPlotImages (PDF-fallback path)
│   ├── scratchTour.ts             # createScratchTour(tourId, name?) — empty per-tour shell; scratchUsers/scratchDefaultUserKey
│   ├── groups.ts                  # Standard department taxonomy (Artist/A Party/Mgmt/Production/Audio/Lighting/Video/Staff/Venue)
│   ├── venues.ts                  # Venue directory (address/promoter/house-PM) + getVenueForTour (tour override > directory)
│   ├── flightFixture.ts           # Raw flight data + buildScratchFlightImport (dormant while FLIGHTS_ENABLED=false)
│   ├── hotelFixture.ts            # Per-hotel raw data + buildScratchHotelImport(fixtureId, personnel)
│   ├── gearFixture.ts             # buildRiderGearItems() + mergeGearItems() — gear seeded from the fixture rider only
│   ├── realSources.ts             # REAL provenance registry (rider page refs + user entries) — feeds <SourceTag>
│   └── riderExtracted.json        # Generated debugging snapshot — written by `scripts/parse-rider.mjs`, not read by any test
├── lib/
│   ├── riderBuilder.ts            # RIDER_TOC_TEMPLATE (14 types) + createRiderDraft + normalizeRider (legacy migration) + sectionKey
│   ├── riderItems.ts               # deriveRiderItems — flattens rider sections into negotiable RiderItemSnapshot[]
│   ├── negotiation.ts             # Pure state transitions for a NegotiationThread (venue response / TM reconcile / reopen)
│   ├── media.ts                   # Stage-media URL classification + Dropbox/YouTube/Vimeo embed helpers
│   ├── updatesFeed.ts             # collectRecentUpdates — folds every edit-history overlay into one sorted FeedEntry[]
│   ├── tourSummary.ts             # summarizeTour/deriveTourStatus — Tour → TourSummary for My Shows
│   ├── migrateLegacyTour.ts       # One-time migration: old fixed-key storage → per-tour keyed storage (gated on a flag)
│   ├── routing.ts                 # tourPath(tourId, path?) — the one place that builds `/t/:tourId/...` strings
│   ├── mapProjection.ts           # Shared lat/lng → SVG projection (CITY_COORDS), used by RouteMap + MyShowsMap
│   ├── idbTourRange.ts            # deleteAllForTour — shared IndexedDB cursor-delete for [tourId, id]-keyed stores
│   ├── useToursIndex.ts           # Hook: reads the tours-index, re-reads on tab focus/visibilitychange
│   ├── features.ts                # FLIGHTS_ENABLED = false — hide-not-delete flag for the flight-import feature
│   ├── access.ts                  # ABAC ↔ Membership bridge — computeReadableBy, groupForMember, isOwnerFloorRole
│   ├── visibility.ts              # ABAC resolver: persons > tags > groups > default (3 levels: blocked < sees < owns)
│   ├── visibilityDefaults.ts      # Per-schedule-item-type seed Visibility + SCHEDULE_TYPE_OWNER hint map
│   ├── tourQueries.ts             # Pure tour query helpers (getDay, getScheduleItemsForDay, …)
│   ├── routeCsv.ts                # parseRouteCsv — route CSV → legs/days/schedule skeleton
│   ├── travelGridCsv.ts           # Travel-agent grid CSV → FlightImport[] (dormant while FLIGHTS_ENABLED=false)
│   ├── flightImportDiff.ts        # Duplicate-flight diff (passengers + seats + metadata)
│   ├── fixtureMatcher.ts          # FIXTURES registry + matchFixture (filename → known fixture)
│   ├── scratchStorage.ts          # Per-tour localStorage load/save (tourKey) + the "My Shows" tours-index + createTourId
│   ├── overlayStorage.ts          # Per-tour localStorage load/save for AppState overlays (overlayKey)
│   ├── riderPdfStore.ts           # IndexedDB `rider-pdfs` store, keyed [tourId, RiderImport.id] — raw rider PDF bytes
│   ├── documentStore.ts           # IndexedDB `documents` store, keyed [tourId, id] — hotel PDFs, stage-media uploads
│   ├── shareToken.ts              # Mock tokens for the shareable day-sheet print link
│   ├── format.ts                  # Date/dayType/scheduleItem formatters
│   ├── time.ts                    # Time-string helpers for the day-sheet Edit mode
│   ├── riderSections.ts           # §N → page-number map + RIDER_PDF_PATH (fixture-seed canonical PDF path)
│   ├── today.ts                   # Real clock helpers — getTodayIso() / getNowIso()
│   ├── cn.ts                      # Tailwind class joiner
│   ├── pdfCore.mjs / pdfCore.d.mts # Shared pure-ESM PDF helpers — constants + row/col/text utils
│   ├── pdfParser.ts               # In-house PDF parser — pdfjs-dist extraction → RiderImport / FlightImport / HotelImport
│   ├── backend/
│   │   ├── types.ts               # Backend interface — subscribeTour/saveTour/loadOverlays/saveOverlays/loadPdf/savePdf/
│   │   │                          #   deletePdf/clearAll, + optional membership + submissions methods
│   │   ├── index.ts               # Selects impl from VITE_BACKEND (default 'local')
│   │   ├── local.ts               # Wraps scratchStorage/overlayStorage/riderPdfStore/documentStore verbatim
│   │   └── supabase.ts            # Persists Tour+overlays as JSONB, PDF bytes to tour-scoped Storage paths
│   └── supabase/
│       ├── client.ts              # Supabase client singleton (dynamic import — never loaded on `local`)
│       └── auth.ts                # Supabase auth state wiring for AuthProvider
├── components/
│   ├── ui/                        # Card, Chip, Button, Icon, Modal, CollapsibleSection, EditableText/EditableSelect,
│   │                               #   SelectableRow, LoadingSpinner — primitives
│   ├── ingest/                    # FileDropZone, UploadResultNote, CancelImportButton, ResolveUnmatchedModal
│   ├── layout/                    # Layout, PrintLayout, Sidebar, BottomNav, TopBar, ScratchBanner, PageHeader
│   ├── auth/                      # AuthGate, LoginScreen, WaitingForAccess — supabase-only gating (no-op on local)
│   ├── provenance/                # SourceTag (real-source (i) citation), PersonName — MockTag/MockBadge/DataSourcesPanel are gone
│   ├── rider/                     # BacklineEditor, LodgingEditor, CateringEditor — inline authoring editors + shared.tsx helpers
│   ├── CommandPalette.tsx         # Ctrl/⌘K palette + provider + hook — tour-scoped page index via tourPath
│   ├── ConflictFeed.tsx           # Top-level conflict list + intro text
│   ├── ConflictResolveModal.tsx   # Pick value + email PM + mark resolved
│   ├── ReconcileModal.tsx         # Venue-negotiation gap resolution — resolved / awaiting-TM-form / waiting-on-venue branches
│   ├── StageMediaEditor.tsx       # Authoring side of the stage-media gallery (paste a link or upload a file)
│   ├── StageMediaGallery.tsx      # Read-facing gallery — images/video inline, links open in a new tab
│   ├── UpdatesFeed.tsx            # Crew-facing "what changed recently" feed, ungated by managerView
│   ├── MyShowsMap.tsx             # Map for the My Shows home page — one pin per tour at its primaryCity
│   ├── MigrationGate.tsx          # Runs migrateLegacyTourIfNeeded() before anything else mounts
│   ├── RiderRef.tsx               # `Stage specs (p.4)` clickable link + linkifyRiderRefs helper
│   ├── RouteMap.tsx               # SVG plot of one tour's show cities with numbered legend
│   ├── LobbyCallLadder.tsx        # Back-cascade from doors → soundcheck → load-in → bus → lobby
│   ├── TodaySurface.tsx           # Role-aware "Today" surface — desktop Overview hero + mobile home
│   ├── LastUpdated.tsx            # "Last updated {date} by {name}" audit line
│   ├── PdfViewer.tsx              # In-app PDF modal — PdfViewerProvider + usePdfViewer()
│   ├── ExplainTag.tsx             # Amber "(?)" — plain-English popup for red/alert warnings
│   └── VisibilityEditor.tsx / TypeDefaultsEditor.tsx
└── routes/
    ├── MyShows.tsx                 # / — multi-tour switcher (or a straight redirect into the one tour, on supabase)
    ├── TourScope.tsx               # /t/:tourId — loads-or-404s the tour, then key={tourId}-remounts AppStateProvider
    ├── TourNotFoundRedirect.tsx    # /t/:tourId/* catch-all — bounces an unknown in-tour path back to the tour root
    ├── LegacyPathRedirect.tsx      # Un-scoped pre-migration paths (old bookmarks) → /t/:tourId/... if exactly one tour exists
    ├── TourOverview.tsx           # /t/:tourId (index)
    ├── Calendar.tsx               # /t/:tourId/calendar (List/Grid toggle; responsive month grid)
    ├── DayDetail.tsx              # /t/:tourId/calendar/:date
    ├── Personnel.tsx              # /t/:tourId/personnel — roster + groups, direct add/edit/remove
    ├── Plots.tsx                  # /t/:tourId/plots (top-level rider plots grid)
    ├── Gear.tsx                   # /t/:tourId/gear — Gear & Supplies tracker (status + cost estimates)
    ├── Advance.tsx                # /t/:tourId/advance — venue-advance board, one row per show
    ├── AdvanceDetail.tsx          # /t/:tourId/advance/:dayId — per-show item-by-item negotiation
    ├── ScheduleAndVisibility.tsx  # /t/:tourId/schedule
    ├── AppUserPermissions.tsx     # /t/:tourId/access — manager roster (assign role+group, add by email, revoke)
    ├── MyTravelInfo.tsx           # /t/:tourId/me — every member's personal page + "Submit a document"
    ├── SubmissionsInbox.tsx       # /t/:tourId/submissions — manager review queue for crew-submitted documents
    ├── DaySheets.tsx              # /t/:tourId/daysheet, /t/:tourId/daysheet/:date (in-app sheet)
    ├── DaySheetPrint.tsx          # /t/:tourId/print/daysheet/:date (printable, no chrome)
    ├── FlightIngest.tsx           # /t/:tourId/ingest/flights — "Import route & hotels" (route CSV + dormant flights + hotels)
    ├── RiderBuilder.tsx           # /t/:tourId/rider — author-or-import the rider (was RiderIngest.tsx)
    └── More.tsx                   # /t/:tourId/more (mobile overflow menu)

web/tests/                          # Unit tests (vitest) — mirrors src/ structure
├── data/
│   └── scratchTour.test.ts        # createScratchTour shell + scratchUsers derivation
└── lib/
    ├── access.test.ts             # ABAC ↔ Membership bridge
    ├── extractPageText.test.ts    # PDF per-page free-text extraction
    ├── fixtureMatcher.test.ts     # filename → known fixture matching
    ├── flightImportDiff.test.ts   # duplicate-flight diff (passengers + seats + metadata)
    ├── media.test.ts              # stage-media URL classification + embed helpers
    ├── migrateLegacyTour.test.ts  # legacy fixed-key storage → per-tour storage migration
    ├── negotiation.test.ts        # venue-negotiation thread state transitions
    ├── pdfCoreToc.test.ts         # TOC-driven rider sectioning
    ├── riderBuilder.test.ts       # createRiderDraft / normalizeRider / sectionKey
    ├── riderItems.test.ts         # deriveRiderItems — rider sections → negotiable item snapshots
    ├── routeCsv.test.ts           # route CSV parser → legs/days/schedule skeleton
    ├── scratchStorage.test.ts     # per-tour localStorage load/save round-trip
    ├── tourQueries.test.ts        # pure tour query helpers (getDay, getScheduleItemsForDay, …)
    ├── tourSummary.test.ts        # Tour → TourSummary derivation
    ├── travelGridCsv.test.ts      # travel-agent grid CSV → FlightImport[]
    ├── updatesFeed.test.ts        # collectRecentUpdates fold + sort
    └── visibility.test.ts         # ABAC resolver (persons > tags > groups > default)
```

## Multi-tour architecture

`/` no longer boots straight into a tour — it's **My Shows** (`routes/MyShows.tsx`), a switcher across every tour on this browser:

- **`TourSummary`** (`types/index.ts`) is the lightweight per-tour card shape (`id`, `name`, `artistName`, `status`, date range, show/day counts, `updatedAt`) — derived from a full `Tour` by `summarizeTour`/`deriveTourStatus` (`lib/tourSummary.ts`). Status (`draft` / `upcoming` / `on_tour` / `completed`) is computed from `tour.days` vs `getTodayIso()`, not stored.
- **The tours-index** — one extra localStorage key (`tour-hub:tours-index`) holding `TourSummary[]`, read by `useToursIndex()` (`lib/useToursIndex.ts`, re-reads on tab focus/`visibilitychange`) and written by `scratchStorage.ts`'s `saveScratchTour` (upserts a fresh summary on every tour save) and `clearScratchTour` (removes the entry on delete/reset).
- **Per-tour storage keying** — every persistence layer is keyed by `tourId`, not a single fixed key: `scratchStorage.ts`'s `tourKey(tourId)` → `tour-hub:tour:${tourId}` (localStorage), `overlayStorage.ts`'s `overlayKey(tourId)` → `tour-hub:overlays:${tourId}` (localStorage), and `riderPdfStore.ts` / `documentStore.ts` key IndexedDB rows by a compound `[tourId, id]` array key (`lib/idbTourRange.ts`'s `deleteAllForTour` is the shared cursor-delete both stores use to wipe just one tour on reset). `createTourId()` mints `tour_${crypto.randomUUID()}`.
- **`migrateLegacyTourIfNeeded()`** (`lib/migrateLegacyTour.ts`) — a one-time migration from the pre-multi-tour scheme (a single fixed-key tour + overlay bundle, bare-string IndexedDB keys) to the per-tour scheme above. Gated by the `tour-hub:migrated-v2` localStorage flag; no-ops entirely on `supabase` (which never had the old scheme); self-healing (doesn't set the flag if any step throws, so a failed migration just retries next load). Runs inside `components/MigrationGate.tsx`, mounted in `main.tsx` **above** `AuthProvider`/`AppStateProvider` so migration completes before anything reads per-tour storage.
- **`TourScope`** (`routes/TourScope.tsx`) is the `/t/:tourId` route element: on `local`, it synchronously checks `loadScratchTour(tourId)` and renders a "Tour not found" screen instead of silently fabricating a fresh blank tour for a stale bookmark or typo'd id (which `AppStateProvider`'s initializer would otherwise do); on `supabase` this check is skipped (the shared tour resolves from membership, not a bookmarkable id). It then renders `<AppStateProvider key={tourId} tourId={tourId}>` wrapping `<Outlet />` — **the `key={tourId}` forces a full remount of `AppStateProvider` (and everything under it) on every tour switch**, which is why AppState's plot-image render cache (`hydratedPlotsCache`) is deliberately module-scope, not component state — it needs to survive that remount.
- **`tourPath(tourId, path?)`** (`lib/routing.ts`) is the single place that builds `/t/:tourId/...` strings — every cross-tour link (My Shows cards, the sidebar exit link, `UpdatesFeed` hrefs, `CommandPalette`) goes through it rather than hand-rolling the template string.
- **Relative-nav convention**: every link *within* a tour's own nested routes (`Sidebar`, `BottomNav`, `More`) uses a **bare relative `to`** (e.g. `to="calendar"`, `to=""` for the index) rather than `tourPath(tour.id, 'calendar')` — React Router resolves it against the current `/t/:tourId` match. Only cross-tour or tour-id-carrying links (anything built outside the currently-active nested route tree, or any link constructed from a `tourId` value rather than "the tour I'm already inside") need `tourPath`.
- **`LegacyPathRedirect`** (`routes/LegacyPathRedirect.tsx`) catches un-scoped pre-migration paths (`/calendar`, `/daysheet/:date`, etc. — old bookmarks/printed sheets/shared links) and forwards into `/t/:tourId/...` if there's exactly one tour on this browser, else sends to `/`. **`TourNotFoundRedirect`** (`routes/TourNotFoundRedirect.tsx`) is the in-tour catch-all (`/t/:tourId/*`) for an unrecognized path within a known tour — bounces to the tour root rather than a 404.

## Data modes — rider authoring, not upload-only

A new tour still starts as an empty shell (`createScratchTour(tourId, name?)`, `data/scratchTour.ts`) — named, the standard `groups` (`data/groups.ts`), one Tour Manager, everything else empty. "+ New show" on My Shows prompts for a name up front (so multiple drafts aren't indistinguishable) and creates one immediately.

**The rider is now authored in-app, not just uploaded.** `createRiderDraft()` (AppState mutator, wrapping the pure `lib/riderBuilder.ts` builder) seeds a brand-new `RiderImport` with **14 blank sections** from `RIDER_TOC_TEMPLATE` — the same section-type list and order the fixture rider and `riderSections.ts` page-map use (cover & contacts, production control, permits, stage specs, stage design, audio PA, input list, lighting equipment, backline, soundcheck, ground transport, lodging, dressing rooms, catering). The TM/PM then:
- Fills each section in with real inline editors — tabular editors for Input List / Monitor Mix / FOH Outputs (pre-existing), and dedicated editors for Backline / Lodging / Catering (`components/rider/BacklineEditor.tsx` etc — these three used to be review-only).
- Can `addRiderSection(type, title)` / `removeRiderSection(id)` / `moveRiderSection(id, dir)` / `renameRiderSection(id, title)` — all direct manager writes (no propose/approve), each logging a `SectionEditRecord` (`status: 'created' | 'deleted'` for add/remove) so the audit trail and the crew-facing updates feed both pick it up.
- The reserved **"Stage design"** section (type stays `stage_plot` for compatibility with the plot-review code, but its authored-context title is "Stage design") is where the stage-media gallery attaches — see "Stage design media" below.

**Every `RiderSection` and `RiderImport` carries a stable `id`** (`crypto.randomUUID()`-based) instead of the old fragile `${type}-${index}` composite key. `sectionKey(section)` (`lib/riderBuilder.ts`) is the **single choke point** every overlay (`sectionApprovals`, `sectionEdits`, `pendingEdits`, `sectionEditHistory`) keys off — always call it rather than reconstructing a key by hand. `normalizeRider(ri)` backfills a legacy section's missing `id` as `${type}-${index}` (the exact old composite key, so pre-existing overlay entries in a persisted tour keep resolving) and defaults `RiderImport.origin` to `'imported'` when absent; `AppState`'s `normalizeTourRiders` runs every rider through it the instant a tour is obtained (fresh, from localStorage, or from the supabase subscription) so nothing downstream ever sees an id-less section.

**`RiderImport.origin: 'authored' | 'imported'`** distinguishes an in-app-authored rider from one extracted from an uploaded PDF. It gates real behavior, not just labeling:
- Gear seeding (`buildRiderGearItems()`, keyed off specific rider text) only runs for `origin === 'imported'` — an authored rider has no PDF for the hardcoded fixture gear list to derive from, so gear-seeding is skipped (the effect in `AppState.tsx` marks the rider "seeded" without adding anything). A future phase adds a manager-triggered "sync gear from rider" action that derives gear from authored content instead.
- Plot-image hydration, `pdfObjectUrl`, `sourceLanguage`, `pageCount` are all meaningless/absent for an authored rider (no source PDF) — every "open the rider PDF" affordance already hides itself when `pdfObjectUrl` is undefined, which is true by construction for an authored rider.

**The PDF-upload path still exists as a fallback** (`lib/pdfParser.ts` genuinely parses; `matchFixture` + `data/fixtures/riderSeed.ts` → `data/riderFixture.ts` is the fixture fallback when parsing throws and the filename matches the canonical rider). Route CSVs are still genuinely parsed (`parseRouteCsv`). Hotels are still one-PDF-per-hotel, direct import, no review step.

- **Persistence** — per-tour, as described in "Multi-tour architecture" above. Two localStorage keys per tour (the `Tour` itself, including full `riderImports[]` / `routeImportHistory[]` / `hotelImportHistory[]` version history; and the overlay bundle) plus IndexedDB rows keyed `[tourId, id]` for rider PDF bytes and general document bytes (hotel PDFs, stage-media uploads). `resetScratchTour()` wipes one tour back to its empty shell (localStorage + IndexedDB + every overlay Map/Set) without touching any other tour.
- **The viewer switcher** (`allUsers`) is derived from the active tour's own personnel via `scratchUsers(tour)` — starts as just the TM, grows as the rider adds band/crew and as `Advance`'s venue-persona flow adds a `grp_venue` `TourPerson` per show.

## The fixture data at a glance

`data/fixtures/riderSeed.ts` is the raw over-split rider content (§6 split into 3 rows, §8 into 2) that `data/riderFixture.ts` collapses into the 14 TOC entries the authoring/review surface expects — this fixture only comes into play on the PDF-upload fallback path (an authored rider never touches it). `data/venues.ts` is the real venue directory (address/promoter/house-PM) keyed by venue id, with `Tour.venues` as an optional per-tour override layer.

- **Real clock:** `lib/today.ts` exports `getTodayIso()` and `getNowIso()` — both use `new Date()` (local time). Every "today" lookup goes through these helpers, never inline `new Date()`.
- **Personnel (13) in the fixture rider:** 5 named (Elsa Carvajal, Julian Bernal, Juan, Daniel, Manuel González PM) + 8 placeholders (Tour Manager, Audio Engineer, Lighting Engineer, VJ, MUA, Personal Asst, Staff #1, Staff #2). See "Pending user-blocked items" below — this is no longer a hard blocker since Personnel now supports direct add/edit/remove.
- **Lock state:** a new tour starts with **nothing locked** — the user builds lock state up themselves.

## Data quirks (worth knowing)

- **Hotels are keyed to check-in day**, not subsequent show nights. So `getHotelsForDay('day_2026-09-25')` returns nothing even though the band is staying somewhere; check `day_2026-09-22` for the CDMX block. This is a real data-model issue, not a bug to silently fix — surface to user before changing.
- **Conflicts ARE real** (for the fixture/imported-PDF rider). They were extracted from `docs/handoff-post-pdf-interpret.md` (the AI analysis of the rider PDF). Only the *detector* is automated; the contradictions themselves exist in the actual rider. An authored rider has no equivalent conflict source (nothing to cross-check against).
- **Schedule item TIMES are seed data**, but some constraints attached to them are real (e.g., the soundcheck `6h min from load-in` rule comes from rider §10 and is rendered as an `(i)` next to the soundcheck row).
- **Venue promoter/house-PM contacts in `data/venues.ts` are seed data for the sample cities** — `getVenueForTour` prefers a tour's own `Tour.venues` override when present. The rider itself never contains venue routing.

## Provenance system

> **The old paired mock-provenance system was REMOVED entirely** (not null'd) — `MockTag`, `MockBadge`, `DataSourcesPanel`, and `data/sources.ts` are all gone from the codebase (a prior phase deleted them; there is no grey "(mock)" text or "where this data comes from" panel anywhere, and no reversible stub left behind). Only the real-source half remains.

- **`<SourceTag source="..." field="..." />`** (`components/provenance/SourceTag.tsx`) is the tiny ocean-blue `(i)` circle — click opens a modal showing document/section/page + verbatim quote + a link to the source, keyed against `data/realSources.ts` (`RealSourceKey` registry).
- **Provenance copy is plain English, no jargon.** The `document` / `section` / `quote` strings in `realSources.ts` are written for a non-technical tour manager — say *which file* a value came from and *who* entered it, never implementation terms ("structured-output extractor", "ABAC", "Claude Sonnet").
- `<SourceTag>` is `print:hidden` so it doesn't clutter physical printouts.
- For free-text strings that mention `§N` (rider sections), use `linkifyRiderRefs(text)` from `components/RiderRef.tsx` — it converts each `§N` substring into a clickable `p.N` link that opens the rider PDF at that page.

`<LastUpdated stamp={...} />` (`components/LastUpdated.tsx`) renders a "{label} {date} by {name}" line (label defaults to "Last updated"; pass `label="Approved"` for sign-offs, `label="Last activity"` for the Advance board). It prints normally — there's no provenance tag attached to it anymore (the old `audit_trail` MockTag pairing is gone along with the rest of the mock system).

`<ExplainTag>` (`components/ExplainTag.tsx`) is a sibling pattern for *warnings*, not provenance: a small amber "(?)" next to any red/alert element opens a plain-English, non-jargon explanation (with a rider-page link where relevant). Presets `SensitiveExplain` / `ConflictExplain` / `ExcludedBrandExplain` single-source the repeated copy.

## Rider section references (`§N`)

Display rule: **don't show `§N` in the visible UI** (it's industry jargon). Use `<RiderRef>` to render `Stage specs (p.4)` (name + parenthesized page link) for structured refs, or `linkifyRiderRefs(text)` to swap inline `§N` substrings → `p.N` links inside descriptions/suggestions. This only applies to a rider with source PDF pages (`origin: 'imported'`) — an authored section has no `pages`/`endPage` to link to.

`§N` → page mapping is in `lib/riderSections.ts` (`RIDER_SECTIONS`). Pages come from the actual PDF (e.g., §8 lighting starts on page 9, not 8). `RIDER_PDF_PATH` there is the fixture-seed canonical Spanish PDF path used only by the fixture-fallback / plot-hydration code path — never treat it as "the" rider PDF; the real one is whatever `tour.riderImports[0].pdfObjectUrl` resolves to.

## Visibility model

ABAC. Each schedule item / travel / hotel / task / doc carries a `Visibility` blob with `default + groups + tags + persons` overrides. **Most specific wins.** **Levels: `blocked < sees < owns`** (3 levels — the `VisibilityLevel` type has no `needs` tier). The resolver lives in `lib/visibility.ts`.

Key facts (full UI detail in `docs/feature-notes.md` § "Visibility deep detail"):

- **Seed policy — everyone-sees, managers-edit** (`lib/visibilityDefaults.ts`): every schedule-item type seeds `{ default: 'sees', groups: { grp_mgmt: 'owns', grp_production: 'owns' } }` — members view, TM/PM edit. localStorage caveat: `visibilityDefaultsByType` is baked in at tour creation, so changing the seed only affects tours created afterward (Reset picks it up).
- **Saves cascade by type** on `/t/:tourId/schedule`: a manager's Save writes the same visibility into every existing item of that type AND bumps `Tour.visibilityDefaultsByType[type]` for future items (`saveVisibilityForType`). Non-managers propose per-item.
- **"Defaults by type"** opens `TypeDefaultsEditor` (compact editor) to edit the per-type template; **"Sync to all N existing items"** pushes it into existing items via `applyTypeTemplateToAllItems` (writes through `visibilityEdits`, so each item gets history + the live effect flips).
- **`VisibilityEditor`** (non-compact): Set-all floor row + pinned `grp_mgmt`/`grp_production` rows that survive bulk actions; group rows expand to tag/person overrides; inherited levels render with a soft highlight.

The TopBar viewer switcher (manager-only) re-renders every tour surface from that user's perspective. This is the killer demo for the visibility model — same data, different views. On `supabase`, a manager may still preview-as anyone; a non-manager is pinned to their own membership identity and the switcher becomes a disabled, non-interactive identity badge (the button itself still renders the current user's avatar/name/role; only the chevron and dropdown are omitted).

## Venue negotiation model

The rider gets negotiated per show, not just handed over:

- **`deriveRiderItems(sections)`** (`lib/riderItems.ts`, pure) flattens the merged rider sections into a flat `RiderItemSnapshot[]` — most section types (cover & contacts, stage specs, transport, lodging, permits, …) collapse to a single `kind: 'section_ack'` item ("the venue acknowledges this whole section"); only **Input List, Backline, and Catering** get broken into individual `kind: 'item'` negotiable line items.
- **`sendRiderToVenue(showDayId)`** (AppState mutator) snapshots the *current* derived item list onto a `ShowAdvance` (keyed by `showDayId`) at send-time — later rider edits don't retroactively change what was sent; re-sending creates a fresh snapshot and flags `riderStale` items that no longer appear as `stale: true` (carried forward for the record, excluded from "fully confirmed"). It also creates the show's `grp_venue` `TourPerson` (`tp_venue_${venueId}`) if one doesn't exist yet, so the TopBar viewer switcher can preview as that venue.
- **The venue persona** is simulated, not a separate login: switching the viewer to the `grp_venue` user scopes `routes/Advance.tsx` to just that persona's own show(s) and hides every manager action (send/confirm buttons, reconcile). `recordVenueResponse(showDayId, itemKey, answer, qtyOffered?, note?)` is the venue-side mutator; a full `have`/`acknowledged` auto-confirms the thread, anything short lands on `awaiting_tm`.
- **`NegotiationThread`** (keyed by `threadKey(showDayId, itemKey)` — `lib/negotiation.ts`) accumulates stamped `NegotiationEntry` records (`venue_response` / `tm_reconcile` / `note` / `reopened`); `applyVenueResponse` / `applyReconcile` / `reopenThread` are the pure transition functions AppState's `recordVenueResponse` / `reconcileItem` / `reopenNegotiation` wrap.
- **`ReconcileModal`** (`components/ReconcileModal.tsx`) is the TM's gap-resolution UI — mirrors `ConflictResolveModal`'s three-branch shape: **resolved** (already `confirmed`, shows how + a manager-only Reopen), **awaiting_tm form** (four actions: accept the venue's count / band brings their own / substitute / drop — reworded for `section_ack` items where "the venue's count" doesn't mean anything), and **waiting-on-venue** (nothing to do yet). No propose/approve pair here (unlike section edits or conflicts) — only a manager can reconcile.
- `markShowConfirmed(showDayId)` flips the whole `ShowAdvance.status` to `'confirmed'` — a no-op (UI disables the button) unless `isShowFullyConfirmed` is true for every non-stale item.
- `routes/Advance.tsx` is the board (one row per show, sortable by date); `routes/AdvanceDetail.tsx` is the per-show item-by-item view. Both are on the manager nav, but the route itself isn't manager-gated — a venue persona lands there too, scoped to their own show.

## Stage design media + updates feed

- **Stage-media gallery** — the rider's reserved "Stage design" section (type `stage_plot`, retitled) holds a lightweight attachment list, not a spec form: paste a Dropbox/YouTube/Vimeo/any link, or upload an image/video file (25 MB soft cap). `lib/media.ts` (pure) classifies a pasted URL (`classifyMediaUrl`) and rewrites Dropbox share links to serve raw bytes (`dropboxDirectUrl`) or YouTube/Vimeo links to embeddable player URLs. `components/StageMediaEditor.tsx` is the authoring UI; `components/StageMediaGallery.tsx` is the read-facing gallery (any role), reusing the rider-plots fullscreen lightbox (`PlotImageLightbox`, exported from `routes/RiderBuilder.tsx`) for images. AppState's `addStageMedia`/`removeStageMedia` mutators are synchronous — a local upload's bytes go through the existing document-storage seam (`backend.savePdf(tourId, 'doc', docId, bytes)`) *before* the mutator call, which just records the already-stored `docId`. `StageDesignPeek` (in `RiderBuilder.tsx`) is a persistent collapsed-by-default preview of this media that stays visible while any *other* section is open, so the TM can reference the stage layout without navigating away.
- **Crew-facing updates feed** — `lib/updatesFeed.ts`'s `collectRecentUpdates(sources, limit?)` (pure) folds every edit-history overlay AppState tracks (schedule, rider sections, visibility, day locks, resolved conflicts, venue advances + negotiations) into one flat list sorted by recency, each entry a plain-English `FeedEntry` with an optional relative `href`. `components/UpdatesFeed.tsx` renders it — **ungated by `managerView`**: the whole point is a crew member can see what changed without asking anyone.
- **Freshness lines on Gear + Plots** — `Gear.tsx` shows `gearUpdatedAt` (a single tour-wide stamp bumped by every gear mutator) via `<LastUpdated>`; `Plots.tsx` shows a similar stamp derived from the active rider.

## State (AppState)

Lives in React Context (`state/AppState.tsx`, ~3100 lines — the largest file in the app). One provider per tour: `TourScope` mounts `<AppStateProvider key={tourId} tourId={tourId}>`, remounting fully on every tour switch. Wraps both `Layout` and the in-tour `PrintLayout` sub-tree so locking a day updates the print route instantly.

Selected surface (not exhaustive — read the interface block at the top of the file for the full, current list; it's kept meticulously commented):

- `tour`, `booting` (true only mid-cloud-load on supabase), `user`, `userKey`, `setUserKey`, `allUsers` — `allUsers` is derived from the tour's own personnel via `scratchUsers`.
- `resetScratchTour()`, `renameTour(patch)` — wipe-to-shell and rename/re-artist a tour.
- **Route/rider/flight/hotel import mutators** — `applyRouteToScratch`, `addRiderImportToScratch`, `setActiveRider`, `addFlightImportToScratch` + `commitFlightImportToScratch` (dormant behind `FLIGHTS_ENABLED`), `addHotelImportToScratch`; cancel/discard counterparts (`cancelRouteImport`, `cancelRiderImport`, `discardFlightImport`, `cancelHotelImport`); flight duplicate handling (`replaceFlightImport`, `mergeFlightImport`) and per-passenger cleanup/resolution (`editFlightImportPassenger`, `removeFlightImportPassenger`, `flightPassengerResolutions` + get/set).
- **Rider authoring mutators** — `createRiderDraft`, `addRiderSection`, `removeRiderSection`, `moveRiderSection`, `renameRiderSection`, `updateRiderMeta` (cover-page metadata — direct write, not negotiable); `addStageMedia` / `removeStageMedia`.
- **Visibility** — `getScheduleTypeDefault`/`setScheduleTypeDefault`, `applyTypeTemplateToAllItems`, `saveVisibilityForType`; per-item `visibilityEdits`/`getVisibilityEdit`/`updateVisibilityEdit` + the pending/approve/reject/history quartet (`pendingVisibilityEdits`, `proposeVisibilityEdit`, `approvePendingVisibilityEdit`, `rejectPendingVisibilityEdit`, `visibilityEditHistory`).
- **Tour query helpers** bound to the active tour — `getDay`/`getDayById`/`getScheduleItemsForDay`/`getTravelForDay`/`getHotelsForDay`/`getTasksForDay`/`getTourPersonById`/`getGroupById`/`getGroupTagById`/`getAllConflicts` (pure fns in `lib/tourQueries.ts`, re-exposed here). **`getScheduleItemsForDay` layers the in-memory `visibilityEdits` overlay onto each item** — always call it via `useApp()`, never read `tour.scheduleItems` directly when filtering by visibility (two call sites intentionally bypass this for non-visibility reasons: `CommandPalette`, `ScheduleAndVisibility`).
- **Day lock + conflicts** — `lockedDays`/`isDayLocked`/`toggleDayLocked`/`setDayLocked` (+ `dayLockHistory`/`getDayLockHistory`), `getDayLastUpdated`, `resolvedConflicts`/`resolveConflict`/`unresolveConflict` + the pending/approve/reject trio for non-manager proposals.
- **Rider section review** — `isSectionApproved`/`getSectionApproval`/`approveSection`/`reopenSection` (keyed by `sectionKey`, i.e. `RiderSection.id`), `getSectionEdit`/`updateSectionEdit`, the pending/approve/reject/history quartet, and `sectionEditHistory` exposed raw (folded by `UpdatesFeed`).
- **Schedule-item content edits** — `updateScheduleItem`/`addScheduleItem`/`deleteScheduleItem`/`getScheduleItemHistory` (+ `scheduleItemEditHistory`) — direct tour mutation (not an overlay), manager-only, no propose/approve yet.
- **Personnel + groups** — `addTourPerson`/`removeTourPerson`/`updateTourPerson` (direct, no propose/approve, mirroring schedule-item edits), `addGroup(name, color)`.
- **Venue negotiation** — `showAdvances`/`negotiations` (tour-shared overlays), `sendRiderToVenue`, `recordVenueResponse`, `reconcileItem`, `reopenNegotiation`, `markShowConfirmed`, `getShowAdvance`, `getNegotiationThread` — see "Venue negotiation model" above.
- **Gear & supplies** — `gearItems`/`updateGearItem`/`addGearItem`/`deleteGearItem`/`gearUpdatedAt`; `updateHotelCost`/`updateTravelCost` for inline cost edits on the Supplies & Costs page.
- **Document submissions (Milestone 2)** — `submissions`, `refreshSubmissions` (supabase only), `proposeSubmission`, `approveSubmission`, `rejectSubmission`, `loadSubmissionFileUrl`, `addDocument`.

Every propose/approve pair in this file follows the same shape: a non-manager proposal stored keyed the same way as the direct-edit overlay (`pendingEdits`, `pendingConflictResolutions`, `pendingVisibilityEdits`), an `UpdateStamp`-carrying approve that merges the patch and appends a history record, and a reject that just discards the proposal. When adding a new negotiable surface, follow this shape rather than inventing a new one.

When backend lands fully, replace with TanStack Query + Zustand or similar; the context shape is intentionally stable so callers don't have to change.

## Backend seam (auth + cloud sync)

> Summary — schema, RLS policies, auth flow, membership model, and AppState wiring live in `docs/backend.md` (Parts 2–3). Read it before touching `lib/backend/*`, `lib/supabase/*`, or `supabase/`.

All persistence routes through one interface: `lib/backend/types.ts` → `Backend` (`subscribeTour` / `saveTour` / `loadOverlays` / `saveOverlays` / `loadPdf` / `savePdf` / `deletePdf` / `clearAll`, plus optional membership + submissions methods). `lib/backend/index.ts` selects the impl from `VITE_BACKEND` (default **`local`**): `local.ts` wraps today's per-tour localStorage + IndexedDB modules verbatim; `supabase.ts` persists the shared `Tour` + overlays as JSONB rows and PDF bytes to tour-scoped Storage paths (`{tourId}/{scope}/{id}.pdf`). **The `local` path is byte-for-byte unchanged** — every supabase behavior is gated on `BACKEND_KIND === 'supabase'`, and the Supabase SDK only loads via dynamic import (`lib/supabase/client.ts`).

**Supabase now supports a caller belonging to more than one tour** — the model is still one *shared* tour per tour set up by its own TM/PM (crew join by email via `tour_members`, role-gated, `claimMembership()` on login, filtered to their role), but a single email can hold an active `tour_members` row in several tours (the table's PK was always `(tour_id, email)`, not `email` alone) and switch between them. `MyShows.tsx` special-cases `BACKEND_KIND === 'supabase'`: exactly one active membership still redirects straight into that tour (`tourPath(membership.tourId)`, unchanged fast path); more than one renders `MembershipSwitcher`, a card list built from `backend.listMyMemberships()` (`Membership[]`, not the `local`-only `TourSummary[]`/`useToursIndex()`). Creating a brand-new shared tour on supabase (who becomes its TM/PM, billing/tenancy) is still unbuilt — the switcher only moves between tours the caller is already an active member of. See `docs/backend.md`'s "Multi-tour on supabase" for the full detail. Managers may preview-as via the TopBar switcher; non-managers are pinned to their membership identity, and manager-only writes are gated by `isManagerMember` (`lib/access.ts`'s `isOwnerFloorRole`). Overlays are tour-shared; only the per-user `userKey` stays client-side. `AuthProvider`/`AuthGate` gate only on supabase — `local` reports a synthetic active-TM membership and is never gated; on supabase the tour cloud-boots (`booting` flag on `useApp()`, spinner in `Layout`) and writes are debounced ~500ms.

**⚠️ Client-side privacy caveat (accepted this milestone):** privacy *between active members* is UI-only — the full Tour JSONB reaches every member's browser. Safe for a trusted-crew demo; before untrusted members, do the Phase B per-row `readable_by` RLS decomposition drafted in `supabase/migrations/0001_init.sql`. `lib/access.ts`'s `computeReadableBy` is the pure bridge that reuses `resolveVisibility` so the eventual server-side denormalization has exactly one copy of the rank logic to import.

## Routing

```
/                                     My Shows — multi-tour switcher (redirects straight into the one tour on supabase)
/t/:tourId                            Tour Overview — this tour's homepage
/t/:tourId/calendar                   Month grid
/t/:tourId/calendar/:date             Day Detail
/t/:tourId/personnel                  Crew + groups
/t/:tourId/plots                      Top-level rider plots grid (stage plot + lightplot thumbnails)
/t/:tourId/gear                       Gear & Supplies tracker — all rider items, status + cost estimates
/t/:tourId/advance                    Venue-advance board — one row per show
/t/:tourId/advance/:dayId             Per-show item-by-item negotiation detail
/t/:tourId/schedule                   Visibility editor
/t/:tourId/access                     App User Permissions — manager roster (assign role+group, add by email, revoke)
/t/:tourId/me                         My Travel & Info — every member's personal page + "Submit a document"
/t/:tourId/submissions                Submissions inbox — manager-only review of crew-submitted documents
/t/:tourId/daysheet                   In-app day sheet (defaults to first show)
/t/:tourId/daysheet/:date             In-app day sheet for a date
/t/:tourId/ingest/flights             "Import route & hotels" (route CSV + dormant flight PDFs + hotel PDFs)
/t/:tourId/rider                      Rider Builder — author-or-import the rider (the differentiator)
/t/:tourId/ingest/riders              Redirects to /t/:tourId/rider (old bookmark compat)
/t/:tourId/more                       Mobile overflow menu (links not in the bottom-nav)
/t/:tourId/print/daysheet/:date       PRINT route (no sidebar/topbar) — outside Layout, nested under TourScope
/t/:tourId/*                          Unrecognized in-tour path → redirects to /t/:tourId
/*                                    Unrecognized top-level path (old un-scoped bookmark) → LegacyPathRedirect
```

Three layout layers in `router.tsx`: `TourScope` (loads the tour, remounts `AppStateProvider` per tourId) wraps two children — `<Layout>` (sidebar (desktop) + mobile bottom-nav + topbar + main content) and a `print` sub-route with `<PrintLayout>` (bare wrapper, just paper background + Outlet, no chrome). If you add a route that should be printable/shareable/chrome-free, put it under the `print` child, not `Layout`'s children.

## Conventions

- **`managerView` pattern for role-gating UI.** Management-only controls (lock/publish buttons, Edit mode toggle, viewer switcher, attention links, Advance's send/confirm buttons) are gated with `const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production'`. Non-managers are always in their personal/filtered view. Apply this consistently — `TodaySurface`, `DaySheets`, `DayDetail`, `RiderBuilder`, `Advance`, `ReconcileModal` all use it. The check intentionally lives at the component level (derived from `user` in AppState), not in the router, because the role-switcher is a demo/preview tool that changes the viewer mid-session. A `grp_venue` persona is a second, narrower role check (`isVenuePersona`) used only by the Advance surfaces.
- **`sectionKey(section)` is the single choke point for keying rider-section overlays** — see "Data modes" above; never reconstruct the key by hand.
- **Per-tour storage keying discipline.** Any new persisted state must be keyed by `tourId` (localStorage: append to the `Tour` or the `OverlayBundle`, both already tour-keyed at the storage layer; IndexedDB: key `[tourId, id]` and register the store's wipe in `deleteAllForTour`'s callers). Never add a fixed, non-tourId-keyed storage key — that's exactly the pre-multi-tour bug `migrateLegacyTour.ts` had to clean up after.
- **Relative-path nav within a tour, `tourPath()` across tours.** See "Multi-tour architecture" above.
- **Pending-edit approval workflow.** Non-managers can propose corrections to rider sections; managers review and approve/reject. Edits go through `proposeSectionEdit(key, patch)` for non-managers (stored in `pendingEdits` Map with an `UpdateStamp`) vs `updateSectionEdit(key, patch)` for managers (immediate effect). Approving via `approvePendingEdit(key)` merges the patch into `sectionEdits` atomically and stamps with the manager's name + `getNowIso()`. Rejecting via `rejectPendingEdit(key)` discards the proposal. The pending state is surfaced in `RiderBuilder` as an amber banner on the section detail and an amber dot on the section list item.
- **Pending conflict resolution workflow.** The same approval pattern applies to rider conflicts (`proposeConflictResolution`/`approvePendingConflictResolution`/`rejectPendingConflictResolution`). `ConflictResolveModal` has three branches: resolved (re-open gated to managers), pending (Approve/Reject for managers; Cancel for non-managers), and the form (Mark resolved for managers; Propose resolution for non-managers). `ReconcileModal` mirrors this resolved/form shape for venue negotiation, but has no propose/approve pair (only a manager acts there at all).
- **Tailwind only**, no styled-components or CSS Modules. Tokens defined in `index.css` `@theme` block.
- **Inline SVG icons** in `components/ui/Icon.tsx` — add new icons there, not via an icon library.
- **Modals always portal to `document.body`** via `createPortal` — needed because day-sheet rows are inside `<Link>` and a modal inside an anchor is invalid HTML. Same applies to floating tooltips/popovers anchored to a trigger inside a card with `overflow:hidden`. See `components/ui/Modal.tsx` and `CommandPalette.tsx` for the pattern.
- **PDF references open in-app, never a new tab.** Call `usePdfViewer().openPdf({ url, page?, title? })` (`components/PdfViewer.tsx`). The active rider PDF is whatever the user uploaded — `origin: 'authored'` riders have no PDF at all, so hide the affordance rather than fake one. `RIDER_PDF_PATH` from `lib/riderSections.ts` is fixture-seed only. **PDF persistence:** localStorage strips `pdfObjectUrl` (and stage-media `objectUrl`) on save (Blob URLs are session-scoped); raw bytes persist to IndexedDB (`lib/riderPdfStore.ts`, `lib/documentStore.ts`), keyed `[tourId, id]`. `AppStateProvider` has boot effects that rehydrate Blob URLs for riders and for locally-uploaded stage-media items missing one. Don't add `<a href="….pdf" target="_blank">`.
- **Click handlers inside provenance tags + RiderRef use `e.stopPropagation()`** so they work when nested inside parent links.
- **CSS Grid items that hold variable-width content need `min-w-0`** to prevent the column blowing out the grid.
- **Print sheet is letter-size (8.5" wide, 816px @ 96 DPI).** `@media print` in `index.css` strips paper grain, gradients, action bar, and provenance markers. `print:hidden` on Tailwind utilities handles per-element hiding.
- **Dense routes provide a real mobile layout, not a squeezed desktop one.** Personnel pairs a `md:hidden` card list with a `hidden md:table` table; DaySheets splits `lg:hidden` mobile vs `hidden lg:grid` desktop; Calendar exposes a user-facing List/Grid toggle (defaults to List on mobile). Navigation follows the same idea — desktop `Sidebar` vs mobile `BottomNav`.
- **Don't write multi-line comments** unless explaining non-obvious WHY (project-wide style — keep code lean).
- **Hide-not-delete for de-scoped features.** `FLIGHTS_ENABLED` (`lib/features.ts`) is the pattern: gate the surface behind a flag, keep the code/fixtures/tests intact, flip the flag back to re-enable. Don't delete a feature's code just because it's out of scope for the current focus — this repo has done that once already (see the flights precedent) and it's the reason a "final phase" audit like this one is cheap to run.

## How to add common things

**A new route inside a tour:**
1. Create `web/src/routes/Foo.tsx` exporting a named component
2. Register it under the `/t/:tourId` → `<Layout>` children in `web/src/router.tsx` (or the `print` children if it's chrome-free)
3. Add a sidebar nav entry in `web/src/components/layout/Sidebar.tsx` (relative `to`, no `tourPath`) if it's a top-level surface; add `MANAGER_ONLY` / `VENUE_VISIBLE` set membership if it should be role-gated
4. Add to the Cmd+K index in `web/src/components/CommandPalette.tsx` (the `pages` array, relative `to`)

**A new rider section type:**
1. Add the type to `RiderSectionType` in `types/index.ts`, `RIDER_TOC_TEMPLATE`/`TOC_TYPES` in `lib/riderBuilder.ts` if it belongs in the default 14, and `RIDER_SECTIONS` in `lib/riderSections.ts` if it has a rider-page mapping
2. If it needs a dedicated inline editor (like Backline/Lodging/Catering), add it under `components/rider/` following `BacklineEditor.tsx`'s dumb-controlled-component shape (value in, onChange out, `disabled` prop) and wire it into `RiderBuilder.tsx`'s `SectionView`
3. If it should be individually negotiable (not just a whole-section acknowledgment), add a `deriveXItems` branch to `lib/riderItems.ts`'s `deriveSectionItems` switch

**A new venue field:**
1. Add to `Venue` in `types/index.ts` and `data/venues.ts`'s `VENUE_DIRECTORY` (or leave it for `Tour.venues` per-tour overrides)
2. Read via `getVenueForTour(tour, venueId)`, never `VENUE_DIRECTORY[venueId]` directly, so per-tour overrides win

**A new real-data field (rider extraction citation):**
1. Add an entry to `web/src/data/realSources.ts` with `document/section/pages/quote`
2. Render the value with `<SourceTag source="your_key" field="..." />` next to it

## Recent additions (most likely to need extension)

> One-liners only — the full operational note for each lives in `docs/feature-notes.md` where it predates this phase; the multi-tour/rider-authoring/venue-negotiation/stage-media items below are this overhaul's own additions and aren't in that doc yet.

- **Multi-tour architecture** — My Shows home page, `/t/:tourId` nesting, per-tour storage keying, one-time legacy-tour migration. See "Multi-tour architecture" above.
- **In-app rider authoring** — 14-section consensus TOC template, add/remove/reorder/rename, inline editors for every section type including Backline/Lodging/Catering. PDF upload/extraction is now the fallback path, not primary. See "Data modes" above.
- **Venue negotiation** — advance board + per-show detail + reconcile flow, simulated venue persona. See "Venue negotiation model" above.
- **Stage-design media gallery + crew updates feed** — see "Stage design media + updates feed" above.
- **Flights de-scoped behind `FLIGHTS_ENABLED`** — hidden, not deleted; `/ingest/flights` reframed as "Import route & hotels".
- **Coach-mark walkthrough removed entirely** — `components/tour/` deleted, no replacement. Onboarding relies on empty-state copy + the Rider Builder / Advance board's own inline guidance.
- **Mock-provenance system removed entirely** — `MockTag`/`MockBadge`/`DataSourcesPanel`/`data/sources.ts` deleted (not null'd). `SourceTag` is the only surviving provenance surface.
- **Shareable day sheet link** — tokenized `/t/:tourId/print/daysheet/:date?token=…` via `lib/shareToken.ts` (mock tokens; recipient needs the tour in their own browser).
- **In-house PDF parser** (`lib/pdfParser.ts` + shared `lib/pdfCore.mjs`) — TOC-driven rider sectioning, flight/hotel parsers, plot-page detection, per-page free text with chrome strip; CLI mirror `scripts/parse-rider.mjs` (keep in sync). Design + quirks: `docs/pdf.md`.
- **Clarity + mobile redesign** — `TodaySurface` (desktop Overview hero + mobile home), `BottomNav`, `/more` overflow.
- **Day-sheet Edit mode** — manager-only inline schedule editing with batch Save/Discard, add/delete, per-day edit history; time helpers in `lib/time.ts`; `EditableText`/`EditableSelect` in `components/ui/`.
- **Last-updated audit line** — `<LastUpdated>` on Today / DaySheets / print / DayDetail / Gear / Plots / Advance; lock, conflict-resolve, and negotiation actions live-stamp their surfaces.
- **Printable day sheet** (`/t/:tourId/print/daysheet/:date`) — venue/promoter info from `data/venues.ts`.
- **Per-day lock state** — chips in DaySheets/Calendar/Overview; `DayLockRecord` history with reason prompt + "N lock events" accordion.
- **Conflict feed + resolution flow** — conflicts model *cross-document* disagreement (new rider version vs on-file), not intra-rider contradictions; resolve modal pre-fills mailto to the PM; `p. N` page links open the rider PDF in-app.
- **Document submissions (Milestone 2)** — `/t/:tourId/me` (every member's personal page + "Submit a document") and `/t/:tourId/submissions` (manager inbox: approve → attach + parse into Travel/Hotels, or reject with reason). Ingest/authoring routes are manager-gated.
- **App User Permissions** (`/t/:tourId/access`) — manager roster: assign role+group, add by email, revoke (TM/PM can't be revoked). Assigning a role also ensures a linked `TourPerson` exists.
- **Plots** — `/t/:tourId/plots` top-level thumbnail grid + Rider Builder's Plots tab; PNGs rendered via pdfjs, stripped from localStorage and re-derived on boot.
- **In-app PDF viewer** — `usePdfViewer().openPdf(...)` modal + `PdfViewerInline` for embedding; never open PDFs in a new tab. See `docs/pdf.md`.
- **Warning explainers** — `<ExplainTag>` amber "(?)" popovers on every red/alert element.
- **Gear & Supplies tracker** (`/t/:tourId/gear`) — items seeded from an imported rider (skipped for an authored one), status cycling, cost totals; smart merge on rider re-upload (`mergeGearItems` keeps user edits).
- **Personnel CRUD** — direct add/edit/remove of crew + groups from `/t/:tourId/personnel` (`addTourPerson`/`updateTourPerson`/`removeTourPerson`/`addGroup`), no propose/approve.
- **Cmd+K palette**; **Route map** (hard-coded city lat/lngs, now shared via `lib/mapProjection.ts` with the new My Shows map); **Calendar List/Grid toggle**; **Lobby-call ladder** (anchors on the `doors` item).
- **Multi-rider version history** — uploads/authored versions prepend to `riderImports[]`; `setActiveRider(id)` promotes without clearing approvals.

## Pending user-blocked items

The scratch/fixture personnel data still carries placeholder names in `data/fixtures/riderSeed.ts` — but **this is no longer a hard blocker for real usage**: since Personnel CRUD shipped, a TM can rename any `TourPerson` directly from `/t/:tourId/personnel` (`updateTourPerson`) the moment they start a real tour, without needing an engineering change. The placeholders below only matter if you want the *seed/fixture data itself* (what a demo or the PDF-upload fallback path produces) to carry real names:

- Juan, Daniel — last names (drummer + bassist, named in rider §6 monitor mixes but no surnames)
- Tour Manager — real name + contact info. The scratch TM is the placeholder name **"Tour Manager"** (`data/scratchTour.ts`'s `SCRATCH_TOUR_NAME`/`scratchTmPerson`); the dormant flight/hotel fixtures use the same literal string so passenger/rooming name-matching connects.
- Audio Engineer (FOH + Monitors), Lighting Engineer, VJ, MUA, Personal Assistant, Staff #1, Staff #2 — full names

To update the seed data: edit `riderSeedPersonnel` in `web/src/data/fixtures/riderSeed.ts` and remove `isPlaceholder: true` from the corresponding entries. For the TM, also update `SCRATCH_TM_PERSON_ID`'s name in `web/src/data/scratchTour.ts` and the matching passenger/rooming names in `flightFixture.ts`/`hotelFixture.ts` (re-run `scripts/gen-flight-pdfs.mjs` if you touch flight PDFs), and add a `realSources.ts` entry if you want the `(i)` provenance modal to point to "user entry".

## What's still on the gap list

Resolved since the last pass (verified against current code, not assumed):
- **Inline editing for nested rider sections** — Backline, Lodging, and Catering now have real inline editors (`components/rider/*Editor.tsx`); every rider section type is correctable in-app.
- **Personnel edits** — `addTourPerson`/`updateTourPerson`/`removeTourPerson`/`addGroup` ship with a full CRUD UI on `/t/:tourId/personnel`, following the same pending/approval-free direct-write pattern as schedule-item content edits.
- **Flight passenger matching** — moot for now: flights are de-scoped behind `FLIGHTS_ENABLED = false`. The matching code + `flightPassengerResolutions` overlay still exist and would need no changes if the flag flips back on.
- **Diff between rider versions** — `RiderVersionHistory` now shows a field-by-field diff between two versions, not just "View PDF" / "Make active" per entry.
- **Catering allergy/diet aggregator + hotel special-requests tracking** — cross-menu `dietaryTags` aggregation view shipped, alongside per-room hotel special-requests tracking (snacks/beverages/amenities).
- **Rider-to-gear sync for an authored rider** — the manager-triggered "sync gear from rider" action now derives gear from authored content; gear seeding is no longer skipped for `origin: 'authored'` riders.

Still open:
- **i18n posture (near-term).** The rider section model still respects the source-language TOC: `RiderSection.title` carries the rider's verbatim heading ("Hospedaje", "Iluminación y Lightplot") for an *imported* rider; an *authored* rider's titles are always the English `SECTION_LABELS` fallback (now defined in `routes/RiderBuilder.tsx`, moved from the old `RiderIngest.tsx`) since there's no source-language heading to draw from. We do NOT translate UI chrome strings today; the eventual plan is separate Spanish + English locales (chrome translates, rider content stays verbatim in its source language). Leave anything sourced from `RiderSection.title`/`.freeText` alone when wiring locale switching.
- **PDF text highlighting** — the viewer + jump-to-page are done, but auto-highlighting the cited text is blocked on a data issue (Spanish PDF vs. English citations). Plan + fix in `docs/pdf.md`.
- **Promoter contact card as a first-class entity** — promoter fields live on `Venue` (`data/venues.ts`) but there's no dedicated promoter-contact surface; `AdvanceDetail`/`Advance` don't currently surface promoter info at all, only venue name/city.
- **Timezone-aware times throughout (next up)** — still untouched; no `timezone`/`timeZone` handling anywhere in the codebase.
- **Tour creation on the supabase backend** — a caller can now switch between every tour they're an active member of (`listMyMemberships()` + `MembershipSwitcher` in `MyShows.tsx`), but creating a brand-new *shared* tour there (who becomes its TM/PM, billing/tenancy) is still unbuilt; the `local` tours-index/per-tour-storage model's "+ New show" has no supabase equivalent yet.

See `docs/potential-implementation.md` §9 for the original full backlog (predates this overhaul; treat as historical context, not a current TODO list).
