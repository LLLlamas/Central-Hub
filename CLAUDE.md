# CLAUDE.md

Operational notes for Claude sessions working on this repo. README.md is the human-facing intro; this file is the working map.

## What this is

A prototype tour-ops hub for one tour manager (not the industry). React + Vite + TypeScript + Tailwind v4 frontend in `web/`. **No backend yet — everything is mocked.**

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

Source-of-truth docs in repo root:
- `potential-implementation.md` — build playbook and feature scope
- `tour-management-deep-research.md` — domain research, competitor landscape
- `redesign-plan.md` — active plan for the clarity + mobile redesign (read before UI work)
- `pdf-highlighter.md` — the in-app PDF viewer's design + the (unbuilt) text-highlighting plan
- `PDF-Parser-In-House.md` — design notes for the in-house pdfjs-based parser (`lib/pdfParser.ts`)
- `RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf` — canonical rider test fixture
- `web/public/` holds the uploadable scratch fixtures: the rider PDF, the route CSV, the travel-agent grid CSV, two flight-confirmation PDFs, and a hotel-block confirmation PDF
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
│   ├── hotelFixture.ts            # Raw hotel-block data + buildScratchHotelImport (hotels + tasks)
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
│   ├── format.ts                  # Date/dayType/scheduleItem formatters
│   ├── riderSections.ts           # §N → page-number map + RiderSectionType → §N
│   ├── today.ts                   # Pinned demo clock — MOCK_TODAY / MOCK_NOW
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
- Uploads are **matched by filename** against `FIXTURES` in `lib/fixtureMatcher.ts` — there
  is no real PDF/CSV parsing backend. A matching route CSV is genuinely parsed
  (`parseRouteCsv`); rider/flight uploads pull canned data (`riderFixture`/`flightFixture`).
  Unknown files get a "sample only" note. **When a real ingest backend exists this needs
  rethinking** — discuss the upload→parse contract then.
- Tour mutators live in `AppState`: `applyRouteToScratch`, `addRiderImportToScratch`,
  `addFlightImportToScratch`, `commitFlightImportToScratch`; `resetScratchTour()` wipes
  back to the empty shell.
- **Persistence:** two localStorage keys, both per-browser. (1) `tour-hub:scratch-tour`
  via `scratchStorage.ts` holds the `Tour`. (2) `tour-hub:scratch-overlays` via
  `overlayStorage.ts` holds every AppState overlay — `lockedDays`, `visibilityEdits`,
  `pendingVisibilityEdits`, `visibilityEditHistory`, `scheduleItemEditHistory`,
  `sectionEdits`, `pendingEdits`,
  `sectionEditHistory`, `sectionApprovals`, `resolvedConflicts`,
  `pendingConflictResolutions`, `dayUpdates`, `dayLockHistory`,
  `flightPassengerResolutions`, plus `userKey`. Maps serialise as entry arrays,
  Sets as plain arrays — both JSON-safe. One `useEffect` watches every overlay
  and writes the whole bundle on any change; `resetScratchTour` clears both keys
  and resets every Map/Set in-memory. The uploaded PDF/CSV is never stored — only
  parsed metadata. **Multi-user note:** still per-browser; for a real demo, both
  payloads need server-side, per-user storage.
- The viewer switcher (`allUsers`) is derived from the tour's own personnel — starts as
  just the TM, grows when the rider import adds the band + crew (`scratchUsers`).

The uploadable scratch fixtures in `web/public/`: the rider PDF,
`mock-tour-route-mexico-7day.csv` (a 7-day Mexico-leg route — Sep 22–28),
`mock-travel-grid-mexico.csv` (the travel-agent grid — every passenger × leg
in one file, the bulk path for flights), `AM19_…` + `VB1014_…` per-flight
confirmation PDFs (the boarding-pass path), and `Hotel_Block_Mexico_2025-09.pdf`
(the CDMX + Monterrey hotel blocks). The PDFs are generated by
`scripts/gen-flight-pdfs.mjs`. The sample data is deliberately the "follow
along exactly" set the walkthrough references — keep filenames, the `FIXTURES`
registry, and the `*Fixture.ts` / `travelGridCsv.ts` files in sync if it changes.

**Two flight-import paths, one review queue.** The travel-agent grid (CSV) and
per-flight confirmation PDFs both produce `FlightImport`s and feed the same
review-before-approve surface on `/ingest/flights`. The grid is parsed by
`lib/travelGridCsv.ts` (`buildFlightImportsFromGrid` — one `FlightImport` per
distinct *(airline, flightNumber, date)*); the PDFs are parsed by
`data/flightFixture.ts` (`buildScratchFlightImport`). This mirrors how real
tours work: the agent emails a grid for the whole tour, then individual
confirmations trickle in for additions/swaps. Name-matching against the roster
is best-effort hint only — unmatched rows still appear in review.

**Re-upload + "Updated" audit semantics.** Route and hotel steps don't have a
"Cancel import" button — in practice the user doesn't cancel, they *update*
(re-upload a corrected file). Each summary has a **Re-upload** toggle that
re-opens the dropzone in place; dropping a new file replaces the data and
bumps `UpdateStamp.updates` on the relevant stamp (`Tour.routeImport` /
`Tour.hotelImport`). The audit line then flips from "Imported by X" → "Updated
by X" once `updates > 0`. `cancelRouteImport` / `cancelHotelImport` mutators
still exist on `AppState` (for the rare wipe case) but are not surfaced in the
UI — for "start over from empty," use the global Reset in the ScratchBanner.

The FlightImport review surface still has a **Discard** button — that one IS a
real cancellation (the import is pre-approve and hasn't created any Travel
records yet). `discardFlightImport(id)` removes the FlightImport + any Travel
in its namespace (`tr_${id}_*`) + any pending passenger resolutions.

Audit stamps are sourced from `Tour.routeImport` / `Tour.hotelImport` (typed as
`UpdateStamp` with optional `updates?: number`) and from
`RiderImport.uploadedBy` / `FlightImport.uploadedBy` (stamped with `MOCK_NOW` +
current viewer when the mutator runs).

**FlightImport re-uploads.** Flights don't need a separate "Re-upload" toggle
— the grid + PDF dropzones at the top of Step 2 are always visible, so the
update path is: drop the new file → duplicate-detection flags it → Replace or
Merge. `FlightImport.updates?: number` tracks how many times an import has
been replaced/merged; the queue-card audit line flips from "imported {date}
by X" → **"updated {date} by X"** once `updates > 0`. Three paths bump it:
  - `addFlightImportToScratch` when a same-id re-upload lands (same fixture
    filename uploaded again). If the previous version was already `imported`,
    the stale Travel records (`tr_${id}_*`) are dropped so the user re-approves.
  - `replaceFlightImport` — incoming becomes canonical with `updates =
    existing.updates + 1`.
  - `mergeFlightImport` — bumps the existing import's `updates`; if the
    existing was `imported`, status reverts to `review` and its Travel is
    cleared so the merged data goes through the approve gate.

**Per-passenger resolution for unmatched flights.** Each `FlightImport` that
has `unmatchedNames` exposes a **"Resolve N unmatched"** button on its review
header, opening `components/ingest/ResolveUnmatchedModal.tsx`. For every
unmatched row the reviewer picks one of:
  - **Assign** to an existing `TourPerson` (the common spelling / legal-name
    case — e.g. "L. Llamas" → the existing Tour Manager record);
  - **Add new** — `commitFlightImportToScratch` creates a placeholder
    `TourPerson` (`tp_auto_${slug}` / `p_auto_${slug}`, `groupId: 'grp_band'`,
    `isPlaceholder: true`) and links the passenger to it;
  - **Skip** — passenger is dropped from the Travel record (the v1 default).
Resolutions live in `AppState.flightPassengerResolutions` keyed by
`${importId}::${name.toLowerCase()}` and are applied at commit-time so the
review surface remains the single source of truth.

**Duplicate-flight detection + Replace / Merge.** When two `FlightImport`s
describe the same leg — same `(airline, flightNumber, departDate)` — the later
one is flagged as a **Duplicate**. Computed locally in `FlightIngest.tsx` via
`findFlightDuplicates` (no extra state — recomputed on render from the current
import list). Surfaces as: a red "Duplicate" chip in the queue, and a banner on
the review surface that **diffs** the two imports — added / removed passengers
+ per-passenger seat changes + a "metadata differs" flag for time/PNR/airport
changes (`lib/flightImportDiff.ts` :: `diffFlightImports`). The banner offers
two actions:
- **Replace existing** → `replaceFlightImport(existingId, incomingId)` —
  discards the older import; the new upload becomes canonical (for full-flight
  updates: a corrected grid replaces an old one).
- **Merge into existing** → `mergeFlightImport(existingId, incomingId)` —
  applies the new passengers onto the existing import (updates seats for
  matched names, appends new names, re-stamps `uploadedBy` / `uploadedAt`),
  then discards the duplicate (for partial updates: one passenger's seat
  changed, a single sub was added). Hidden when the diff is empty.
The user can still **Discard** either copy manually. The dedupe in
`commitFlightImportToScratch` only namespaces within an import
(`tr_${importId}_*`), so approving two duplicates would create two Travel
records for the same flight — the banner explicitly warns about this.

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
  `flight-approve`, `rider-sections`, `hotel-dropzone`). Feature steps omit `target` and
  use a centered bubble. The `/` intro screen (`ScratchGetStarted` in `TourOverview`)
  and the `ScratchBanner` both expose a "Start the walkthrough" button.

When adding a tour step, add its `data-tour` anchor on the real element and a step to
`scratchTourSteps.ts`. Keep step copy short and warm.

## The fixture data at a glance

`data/mockTour.ts` is the fixture source the scratch uploads draw from — its
`riderImports[0]` + `personnel` feed `riderFixture.ts`, its `groups` feed
`scratchTour.ts`. It is no longer rendered as a tour itself.

- **Pinned demo clock:** `lib/today.ts` hard-codes "today" as `MOCK_TODAY = 2025-09-25` (and `MOCK_NOW` 09:00). Every "today" lookup reads from it — never `new Date()`. The sample route CSV (Sep 22–28) is built around this date.
- **Personnel (13):** 5 named from rider (Elsa Carvajal, Julian Bernal, Juan, Daniel, Manuel González PM) + 8 placeholders (Tour Manager, Audio Engineer, Lighting Engineer, VJ, MUA, Personal Asst, Staff #1, Staff #2). Last names for Juan/Daniel and full names for every placeholder are pending user input.
- **Lock state:** the scratch tour starts with **nothing locked** — the user builds lock state up themselves. (Demo mode used to pre-lock Sep 22–25; that seed is gone.)

## Data quirks (worth knowing)

- **Hotels are keyed to check-in day**, not subsequent show nights. So `getHotelsForDay('day_2025-09-25')` returns nothing even though the band is staying somewhere; check `day_2025-09-23` for the CDMX block. This is a real data-model issue, not a bug to silently fix — surface to user before changing.
- **Conflicts ARE real.** They were extracted from `handoff-post-pdf-interpret.md` (the AI analysis of the rider PDF). Only the *detector* is automated; the contradictions themselves exist in the actual rider.
- **Schedule item TIMES are mock**, but some constraints attached to them are real (e.g., the soundcheck `6h min from load-in` rule comes from rider §10 and is rendered as an `(i)` next to the soundcheck row).
- **Venue addresses + promoter contacts in `mockVenues.ts` are mock.** The rider never contains venue routing — that's the booking agent's deal-memo job.

## Provenance system (load-bearing)

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

**Type defaults — locked by default** (`lib/visibilityDefaults.ts`): `SCHEDULE_TYPE_OWNER` maps each `ScheduleItemType` → its *suggested* owning group (`load_in/doors/curfew/load_out → grp_production`, `soundcheck → grp_audio`, `set/rehearsal → grp_artist`, `bus_call/lobby_call/meals/press/meet_greet → grp_mgmt`). This is a hint only — `defaultVisibilityForType` no longer reads it. The seed Visibility is `{ default: 'blocked', groups: { grp_mgmt: 'owns', grp_production: 'owns' } }` for every type: nobody outside Management/Production can see anything until the TM grants them explicitly. The owner group renders as a "Suggested owner" chip in the type-defaults editor so the TM knows who *would* normally edit each kind of item. **localStorage caveat:** an existing scratch tour has its `visibilityDefaultsByType` baked in at creation, so flipping `defaultVisibilityForType` only affects tours created after the change — Reset from the scratch banner to pick up the new locked-by-default seed.

**Schedule grouping — Save cascades by type.** On `/schedule`, a manager's Save does not edit just the selected item: `saveVisibilityForType(type, patch)` writes the same visibility into every existing schedule item of that type AND bumps `Tour.visibilityDefaultsByType[type]` so future items of the type inherit it. One save configures every `lobby_call` / `lunch` / `dinner` etc. The Save button label reflects the scope (`Save (× N)` when N > 1), and the eyebrow above the editor reads "Visibility is grouped by item type. Edit one … the same permissions apply to all N." Non-managers still propose per-item via `proposeVisibilityEdit` — only manager direct saves cascade. Per-item drift is not currently expressible from this surface; rare exceptions need an "override for this item only" escape hatch (not built). Sidebar visual cues: (a) the active row uses the ink-black background, OR a **dark forest green `#2d4a2a`** (via inline style — Tailwind's arbitrary-hex scanner skipped it) when the active row is also edited; (b) every other item with a saved visibility edit gets a **soft `#5a8a55/15` green tint** so the manager sees configured types at a glance; (c) every other item of the same type as the selected one gets a tan `paper-2/70` tint to preview the cascade scope. The bottom-right `PermissionsStatus` card tracks `configured / total` types — when not all done it lists remaining types with their item counts; clicking a type jumps the editor to its first item so the manager can configure-and-cascade with one Save. The item-header card above the visibility editor is a `<Link to="/daysheet/:date">` showing the eyebrow `{type} · {time} · {EEE MMM d}` with a "Day sheet ›" affordance — one click jumps to that day's day sheet. `Tour.visibilityDefaultsByType` holds the editable template (seeded by `buildScheduleTypeDefaults()` on a fresh scratch tour); `getScheduleTypeDefault` / `setScheduleTypeDefault` on `AppState` read/write it. `routeCsv.ts` uses the static defaults when seeding ScheduleItems from the route CSV. UI: "Defaults by type" button on `/schedule` opens `TypeDefaultsEditor` modal — pick a type on the left, edit its Visibility on the right; per-item edits still override. The modal also exposes **"Sync to all N existing items"** — pushes the edited template down into every existing schedule item of that type via the `applyTypeTemplateToAllItems(type)` mutator. It writes through the same `visibilityEdits` Map a manual edit would, so each affected item gets a history entry and the "live" effective visibility flips immediately. Future items still pick up the template at creation; existing items only sync on demand.

**Visibility editor levels** (`components/VisibilityEditor.tsx`): the non-compact editor has no "Default for everyone" header card. Group rows show full-word `BLOCKED / SEES / OWNS` pickers (click active to clear). A right-aligned **Set-all** row of three colored circles sits above the regular groups — clicking a circle sets the floor to that level *and* wipes every override, EXCEPT for the pinned `grp_mgmt` + `grp_production` rows (`PINNED_GROUP_IDS`), which sit above the Set-all row and survive the bulk action. The currently-active floor's circle has a ring around it. Rows with no override show the floor column with a 22% alpha soft highlight + a "Sees (inherited from floor)" tooltip — so the cascade is visible at a glance. Group rows expand to reveal both tags and members, each with its own picker (effective level cascades: tag uses `group ?? default`, person uses `group ?? default`). The compact mode (used by `TypeDefaultsEditor`) still renders the original "Default for everyone" picker block — its workflow is just about setting the floor per type.

The TopBar viewer switcher (Tour Manager / Manuel / Audio / Elsa / Julian / MUA) re-renders the Day Detail and Day Sheets pages from that user's perspective. This is the killer demo for the visibility model — same data, different views.

## State (AppState)

Lives in React Context (`state/AppState.tsx`). The single provider is mounted **in `main.tsx`** so it wraps both `Layout` and `PrintLayout` — that's why locking a day in `/daysheet` updates `/print/daysheet` instantly.

Currently exposes:
- `tour`, `user`, `userKey`, `setUserKey`, `allUsers` — `tour` is the build-from-scratch tour (restored from localStorage, or a fresh shell); `allUsers` is derived from the tour's personnel. `userKey` is a plain `string` (scratch keys aren't compile-time known)
- `resetScratchTour()` and the tour mutators `applyRouteToScratch` / `addRiderImportToScratch` / `addFlightImportToScratch` / `commitFlightImportToScratch` / `addHotelImportToScratch` — see "Data modes" above
- The tour query helpers `getDay` / `getDayById` / `getScheduleItemsForDay` / `getTravelForDay` / `getHotelsForDay` / `getTasksForDay` / `getTourPersonById` / `getGroupById` / `getGroupTagById` / `getAllConflicts` — pure functions in `lib/tourQueries.ts`, re-exposed here **bound to the active tour**. Always call them via `useApp()`, never import from `mockTour.ts`. **`getScheduleItemsForDay` layers the in-memory `visibilityEdits` overlay onto each item before returning** so `it.visibility` resolves against the manager's saved edits — never the seed. Every read site (`DayDetail`, `DaySheets`, `TodaySurface`) gets this transparently; do not bypass the helper by reading `tour.scheduleItems` directly when filtering by visibility.
- `updateScheduleItem(itemId, patch)` / `addScheduleItem(dayId, init?)` / `deleteScheduleItem(itemId)` / `getScheduleItemHistory(itemId)` — manager edits to schedule-item content (times / title / location / notes / type) plus add + delete. **These mutate the tour directly** (rebuild `tour.scheduleItems` + persist), not an overlay, so every read site reflects them — including the two that read `tour.scheduleItems` directly (`CommandPalette`, `ScheduleAndVisibility`). Each call live-stamps the day (`stampDay`) and appends a `ScheduleItemEditRecord` to the `scheduleItemEditHistory` overlay (`status: 'direct' | 'created' | 'deleted'`), mirroring `VisibilityEditRecord`. Manager-only surface today — no propose/approve yet. `addScheduleItem` seeds visibility from `getScheduleTypeDefault(type)` and returns the new id.
- `lockedDays`, `isDayLocked(id)`, `toggleDayLocked(id)`, `setDayLocked(id, locked)`
- `getDayLastUpdated(day)` — resolves a `Day`'s last-updated `UpdateStamp` against an in-memory `dayUpdates` overlay (falls back to seeded `day.lastUpdated`); locking/unlocking a day live-stamps it with `MOCK_NOW` + current viewer
- `resolvedConflicts`, `resolveConflict(id, {chosenValue, source?, note?})`, `unresolveConflict(id)` — `resolveConflict` stamps `MOCK_NOW`
- `isSectionApproved(key)` / `getSectionApproval(key)` / `approveSection(key)` / `reopenSection(key)` — rider-section sign-off, keyed `${type}-${index}`; approvals seed from sections whose mock status is `approved` and stamp `MOCK_NOW` + current viewer
- `getSectionEdit(key)` / `updateSectionEdit(key, patch)` — inline corrections (`RiderSectionEdit`) layered over the AI extraction

When backend lands, replace with TanStack Query + Zustand or similar; the context shape is intentionally stable so callers don't have to change.

## Routing

```
/                          Tour Overview — Start From Scratch homepage by default
/calendar                  Month grid
/calendar/:date            Day Detail
/personnel                 Crew + groups
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
- **Pending conflict resolution workflow.** The same approval pattern applies to rider conflicts. Non-managers call `proposeConflictResolution(id, {chosenValue, source?, note?})` (stored in `pendingConflictResolutions` Map in AppState with `proposedAt: UpdateStamp`). Managers can call `approvePendingConflictResolution(id)` — which internally calls `resolveConflict` stamping `proposedAt` from the proposal and `resolvedAt/resolvedBy` from the approving manager. Rejecting via `rejectPendingConflictResolution(id)` clears the proposal. `ConflictResolveModal` has three branches: resolved (re-open gated to managers), pending (Approve/Reject for managers; Cancel for non-managers), and the form (Mark resolved for managers; Propose resolution for non-managers). `ConflictFeed` and `ConflictsReview` in `RiderIngest` both show a "pending" label and role-appropriate button labels. The `ConflictResolution` type carries an optional `proposedAt?: UpdateStamp` so the full two-person audit trail is preserved in the resolved record.
- **Tailwind only**, no styled-components or CSS Modules. Tokens defined in `index.css` `@theme` block.
- **Inline SVG icons** in `components/ui/Icon.tsx` — add new icons there, not via an icon library.
- **Modals always portal to `document.body`** via `createPortal` — needed because day-sheet rows are inside `<Link>` and a modal inside an anchor is invalid HTML. Same applies to floating tooltips/popovers anchored to a trigger inside a card with `overflow:hidden` (e.g. `MockBadge` popover): portal to body + position with `fixed` + viewport-aware top/left from `getBoundingClientRect`. See `components/ui/Modal.tsx`, `CommandPalette.tsx`, and `components/provenance/MockBadge.tsx` for the pattern.
- **PDF references open in-app, never a new tab.** Call `usePdfViewer().openPdf({ url, page?, title? })` (`components/PdfViewer.tsx`); the rider PDF path is `RIDER_PDF_PATH` from `lib/riderSections.ts`. Don't add `<a href="….pdf" target="_blank">`.
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
1. Add the value to `mockTour.ts` (sourced from `handoff-post-pdf-interpret.md` analysis)
2. Add an entry to `web/src/data/realSources.ts` with `document/section/pages/quote`
3. Render the value with `<SourceTag source="your_key" field="..." />` next to it

**A new conflict source page in the rider:**
1. Update `RIDER_SECTIONS` in `web/src/lib/riderSections.ts` (it's the canonical map)
2. `<RiderRef>` and `linkifyRiderRefs()` will auto-pick it up

## Recent additions (most likely to need extension)

- **Shareable day sheet link** — "Share" button on `/daysheet/:date` and the print-preview action bar copies a tokenized URL (`/print/daysheet/:date?token=…`) to the clipboard. `lib/shareToken.ts` generates + verifies mock base64 tokens. When the token is present and valid, the print view shows "Shared day sheet" in place of "← Back to day sheet" and hides the day jumper — signals to the recipient this is a shared read-only view. Note: since tours live in localStorage, recipients need the tour loaded in their browser; real auth-gated sharing needs a server-issued token and server-side verification.
- **In-house PDF parser** (`lib/pdfParser.ts` + `lib/pdfCore.mjs`) — no LLM, no backend. pdfjs-dist text extraction + positional reconstruction. Handles Spanish and English riders. Three exports: `parseRiderPdf(file) → RiderImport`, `parseFlightPdf(file, personnel) → FlightImport | null`, `parseHotelPdf(file, personnel, days) → { hotels, tasks }`. Wired into `RiderIngest`, `FlightIngest`, and `HotelImportSection` upload handlers — each tries the real parser first, falls back to the fixture if parsing fails or returns empty. **Shared module:** `lib/pdfCore.mjs` holds all pure algorithmic helpers (constants, `groupRows`, `buildColMap`, `assignCols`, `multiPageItems`, `colAliasLookup`, etc.) imported by both `pdfParser.ts` (Vite/browser) and `scripts/parse-rider.mjs` (Node CLI). TypeScript resolves `.mjs` imports via `pdfCore.d.mts` (not `.d.ts` — `moduleResolution: "bundler"` maps `.mjs` → `.d.mts`). **Known quirks:** pdfjs-dist fragments Spanish accented chars (`producción` → `producci ó n`), so language detection uses unaccented Spanish function words instead of accent regex; column alias lookup uses prefix matching for fragmented headers. Artist name extraction uses a two-level fallback: tallest-average-height alphabetic row on the cover, then body-text scan for `producción de ARTIST`. TOC pages (pages matching ≥5 section hints) are skipped so they don't pollute section page lists. Multi-page sections use a y-offset trick (`(nPages-1-pi)*10000`) so items from different pages don't collide in `groupRows`. The `nextStarts` check in `findSections` uses `pageText(next).slice(0,300)` rather than all heading items — heading items on table pages are too broad (all h=12 rows) and caused false section boundaries when table cell text like "SMPTE TO LIGHTING" matched the lighting regex. The `input_list` regex includes `\bCH\s+SOURCE\b` so continuation pages (same table header, no section-title text) are included in the span. The canonical rider (`RIDER ELSA Y ELMAR 2025…`) extracts 44 channels, 8 monitor mixes, 5 FOH outputs (stereo pairs like "FOH 3 & 4" count as one entry), 11 sections. FOH output labels like "FOH 1", "FOH 3 & 4" are supported (bare integers only was too restrictive). **CLI:** `node scripts/parse-rider.mjs [path/to/rider.pdf]` writes `src/data/riderExtracted.json`; useful for testing extraction quality.
- **Clarity + mobile redesign** (`redesign-plan.md`, landed) — `TodaySurface` is a role-aware "Today" surface used as both the desktop Tour Overview hero and the mobile home screen; `BottomNav` is the mobile tab bar (Today / Calendar / People / More) replacing the sidebar on small screens; `/more` is the mobile overflow menu. The pinned demo clock (`lib/today.ts`) makes "today" deterministic.
- **Day-sheet Edit mode — real editing.** The `/daysheet/:date` Edit/Personal toggle is manager-only. **Edit** now actually edits: the "Show clock" list becomes inline `EditableText`/`EditableSelect` fields (start/end time, title, type, location, notes) via the `ScheduleEditor` component (in `DaySheets.tsx`, used by both the desktop and mobile sheets). Field edits collect in local draft state and commit in **one batch** via the Save / Discard bar (`updateScheduleItem` per dirty item → one history record each, day live-stamped); invalid `HH:MM` or empty title blocks Save. **Add item** (`addScheduleItem`) and per-row **Delete** (`deleteScheduleItem`, confirm) mutate the tour immediately. A "N edit events on this day" disclosure renders the aggregated `getScheduleItemHistory`. **Personal** is unchanged — filtered preview-as-a-person. Time helpers live in `lib/time.ts` (`parseHHMM` / `fmtHHMM` / `isValidHHMM`, also used by `LobbyCallLadder`). `EditableText` / `EditableSelect` were promoted out of `RiderIngest` into `components/ui/EditableText.tsx`.
- **Schedule Permissions add/delete** — on `/schedule`, the "New schedule item" header button opens `NewScheduleItemModal` (day + type + start time + title → `addScheduleItem` → selects the new item); the item-header card (the one linking to the day sheet) has a **Delete** button (`stopPropagation` since it sits inside a `<Link>`) that removes the item and reselects a neighbor.
- **Simple/Pro density mode — removed.** There is no longer a density toggle. The app runs the former "Pro" layout as the single default, but the Tour Overview's secondary surfaces (Rider conflicts, Route map, Tour-shape & rider facts) are now collapsed-by-default `CollapsibleSection`s so a new TM lands on a clean page. `RouteMap` takes an `embedded` prop to drop its card chrome when nested in a collapsible. The day sheet always shows the `ToolsRail`.
- **Last-updated audit indicator** — `<LastUpdated>` renders "Last updated {date} by {name}" from a `Day.lastUpdated` `UpdateStamp` (resolved via `getDayLastUpdated`). Surfaced on TodaySurface, Day Sheet (desktop + mobile + tools-rail "Revision" card), the print day sheet, and Day Detail. Locking a day or resolving a conflict live-stamps with `MOCK_NOW`.
- **Printable day sheet** (`/print/daysheet/:date`) — uses `mockVenues.ts` for venue/promoter info. If a new show city is added, also add a venue entry there or the print sheet's right column will be empty.
- **Per-day lock state** — chips render in DaySheets day picker, Calendar grid, Tour Overview stat. Lock state is in-memory only; resets on refresh.
- **Conflict feed + resolution flow** — surface on Tour Overview + drill-in on `/ingest/riders`. Resolve modal pre-fills mailto: with PM's email + conflict context.
- **Rider section review — inline edit + approve** — on `/ingest/riders` each section can be corrected inline and then **Approved**. The Input List, Monitor Mix, FOH Outputs tables and free-text sections have editable fields (borderless `EditableText` / `EditableSelect`); edits layer over the extraction via `updateSectionEdit` (keyed `${type}-${index}`). Approving stamps the section with an `UpdateStamp` and shows `<LastUpdated label="Approved">`; an approved section is locked until **Reopen**. The nested sections (Backline, Catering, Lodging) are review-only for now — see the gap list.
- **In-app PDF viewer** — `PdfViewerProvider` / `usePdfViewer()` (`components/PdfViewer.tsx`, mounted in `main.tsx`) shows PDFs in a popup `Modal` (size `xl`) at the cited page, instead of a new tab. Wired into every PDF reference: `RiderRef` §N/p.N links, `SourceTag` + `MockTag` artifact links, the rider filename chip, and the flight filename chips. **Full design + the unbuilt highlighting plan are in `pdf-highlighter.md` — read it before touching this.**
- **Warning explainers** — `<ExplainTag>` (`components/ExplainTag.tsx`) adds a clickable amber "(?)" to every red/alert element (rider version warning, extraction flags, conflicts, "Sensitive" markers, excluded-brand flags); each opens a plain-English explanation.
- **Start From Scratch** — the only experience (see "Data modes"). Touches `AppState` (the tour, mutators, personnel-derived `allUsers`, bound query helpers), the combined `/ingest/flights` "Import route & travel" page, `RiderIngest` upload, `TopBar`, `ScratchBanner`, and the `lib/`/`data/`/`components/ingest/` files. Unit tests live in `web/tests/` (mirroring `web/src/` structure — e.g. `tests/lib/visibility.test.ts` tests `src/lib/visibility.ts`) and run with `npm test` (vitest). Tests import the code under test via the `@/` alias (`@/lib/foo`), not relative paths — keeps imports stable if a test ever moves. The vitest config lives in `web/vitest.config.ts`; `tsconfig.app.json` includes both `src` and `tests` so the typechecker sees both. When extending an ingest surface, route through the AppState mutators.
- **Guided walkthrough** — `components/tour/` coach-mark tour over the scratch onboarding (see "Walkthrough"). The `/` intro screen frames the scenario; the overlay spotlights each step and auto-advances as the user imports each file. 15 steps: 4 hands-on imports then 6 centered feature steps touring the post-ingest surfaces (including the day-sheet Edit mode).
- **Hotel import** — the 4th uploadable fixture. A hotel-block confirmation PDF (`Hotel_Block_Mexico_2025-09.pdf`) → `hotelFixture.ts` `buildScratchHotelImport` builds `Hotel` records (keyed to check-in days, occupants name-matched to the roster) plus a few hotel-advance `Task`s. Imported via `addHotelImportToScratch` from the "Hotels & rooming" section on `/ingest/flights`. Direct import — no review/approve step, unlike flights.
- **Generated fixture PDFs** — `web/public/` holds two flight-confirmation PDFs (AM19, VB1014) and one hotel-block confirmation (`Hotel_Block_Mexico_2025-09.pdf`). They're produced by `web/scripts/gen-flight-pdfs.mjs` (one-off Node script; `pdf-lib` is a devDependency). Re-run it if `flightFixture.ts` / `hotelFixture.ts` data changes.
- **Travel-agent grid (CSV)** — bulk flight import. `mock-travel-grid-mexico.csv` (one row per passenger × leg) is parsed by `lib/travelGridCsv.ts` and produces one `FlightImport` per leg. Sits next to the per-flight PDF dropzone on `/ingest/flights` Step 2 — same review surface, two upload paths. The walkthrough's "Step 3 — Import the flights" now spotlights the grid dropzone as the recommended fast path.
- **Cmd+K palette** — provider in `Layout`. Search index built from tour days + personnel + schedule items + venues + pages.
- **Route map** — static SVG with hard-coded city lat/lngs in `RouteMap.tsx`. New cities need their lat/lng added there.
- **Calendar List/Grid toggle** — `Calendar.tsx` defaults to Grid on desktop, List on mobile, switchable on both. List view groups days by month with headers; the month grid uses compact cells on mobile.
- **Lobby-call ladder** — only renders for show days. Anchor is the `doors` schedule item; if missing, ladder shows a "set a doors time" empty state.
- **Conflict model: cross-document, not intra-document** — Conflicts are NOT meant to represent contradictions within the same rider PDF (the rider doesn't contradict itself is what we advertise). Conflicts arise when a user uploads an *updated* rider or a *partial* supplemental document that disagrees with what's already on file — e.g., a new rider version changes a stage spec, or someone sends a document with only some sections that overrides an approved value. `ConflictFeed` title is "Document conflicts" with an empty state that says "No conflicts yet — upload a new version or supplemental document to compare." The existing conflicts in `mockTour` are legacy data from the initial AI analysis and are shown purely as a demo of the resolution UI. For future work: cross-document diff (new rider vs old, rider vs travel grid) belongs in the ingest pipeline — detect on re-upload, surface in the same `ConflictFeed`/`ConflictResolveModal` flow. **PP. N links in section headers**: the `pp. N` eyebrow in `SectionView` renders page numbers as clickable buttons (via `SectionPageLinks` component) that open the rider PDF at that page in the in-app viewer. Use this pattern for any other surface that shows page references.

## Pending user-blocked items

The tour roster still has placeholder names waiting for user input:
- Juan, Daniel — last names (drummer + bassist, named in rider §6 monitor mixes but no surnames)
- Tour Manager — real name + contact info. The scratch TM is the placeholder name **"Tour Manager"** (`scratchTour.ts`); the flight/hotel fixtures use the same literal string so passenger/rooming name-matching connects.
- Audio Engineer (FOH + Monitors), Lighting Engineer, VJ, MUA, Personal Assistant, Staff #1, Staff #2 — full names

Once provided, update `persons[]` in `web/src/data/mockTour.ts` and remove `isPlaceholder: true` from the corresponding `TourPerson` entries. For the TM, also update the scratch TM name in `web/src/data/scratchTour.ts` and the matching passenger/rooming names in `flightFixture.ts` / `hotelFixture.ts` (and re-run `gen-flight-pdfs.mjs`), and re-add a `realSources` entry if you want the `(i)` provenance modal to point to "user entry".

## What's still on the gap list (from the audit)

Tier 1 untouched: *(all shipped)*

Tier 2:
- PDF text highlighting — the viewer + jump-to-page are done, but auto-highlighting the cited text is blocked on a data issue (Spanish PDF vs. English citations). Plan + fix in `pdf-highlighter.md`.
- Inline editing for the nested rider sections — Backline, Catering, and Lodging are still review-only; only the tabular sections (Input List, Monitor Mix, FOH Outputs) and free-text sections are inline-editable today. Eventually every section type should be correctable.
- Diff between rider versions
- Catering allergy/diet aggregator
- Promoter contact card as a first-class entity
- Timezone-aware times throughout
- Flight passenger matching + Personnel edits: when these surfaces are wired, apply the pending/approval + history pattern (`PendingEdit` + `SectionEditRecord`-style log). TODOs are in the source files (`FlightIngest.tsx`, `Personnel.tsx`).

Shipped (recent):
- `DayLockRecord` pattern — day lock records a reason + full per-day history via `getDayLockHistory(dayId)`. `toggleDayLocked`/`setDayLocked` take an optional `reason?` and push a record on every change. Surfaced in `DaySheets` as a reason prompt + a "N lock events" accordion.
- Visibility edit workflow — `/schedule` visibility edits persist to AppState with the pending/approval workflow and `VisibilityEditRecord` history (same shape as `SectionEditRecord`). `computeVisibilityChanges` diffs the Default / Group / Tag / Person levels. Managers edit directly via `updateVisibilityEdit`; non-managers `proposeVisibilityEdit` and a manager approves/rejects. Keyed by schedule-item id.

(Shipped from earlier backlogs — see "Recent additions": the mobile-shaped day sheet, mobile bottom-nav, Today screen, last-updated indicator, and tap-to-call / WhatsApp / maps deep links on the Today surface, mobile day sheet, and print sheet. The Simple/Pro density toggle was later removed.)

See the original audit output / `potential-implementation.md` §9 for the full backlog.
