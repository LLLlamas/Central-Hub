# CLAUDE.md

Operational notes for Claude sessions working on this repo. README.md is the human-facing intro; this file is the working map.

## What this is

A prototype tour-ops hub for one tour manager (not the industry). React + Vite + TypeScript + Tailwind v4 frontend in `web/`. **No backend yet — everything is mocked.**

Source-of-truth docs in repo root:
- `potential-implementation.md` — build playbook and feature scope
- `tour-management-deep-research.md` — domain research, competitor landscape
- `redesign-plan.md` — active plan for the clarity + mobile redesign (read before UI work)
- `pdf-highlighter.md` — the in-app PDF viewer's design + the (unbuilt) text-highlighting plan
- `RIDER ELSA Y ELMAR 2025 -FULL BAND - Venue Shows 030725.pdf` — canonical rider test fixture
- `mock-booking-agent-deal-memo.md` + `mock-tour-route.csv` — mock artifacts the booking-agent flow would produce
- `web/public/` holds the in-app-openable docs: the rider PDF, the CSV + deal memo, and two generated flight-confirmation PDFs

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
│   ├── mockTour.ts                # The single mock tour ("Elsa y Elmar · Full Band 2025")
│   ├── mockVenues.ts              # Per-venueId mock address/promoter/house-PM info
│   ├── sources.ts                 # MOCK provenance registry (where data should come from)
│   └── realSources.ts             # REAL provenance registry (rider page refs + user entries)
├── lib/
│   ├── visibility.ts              # ABAC resolver: persons > tags > groups > default
│   ├── format.ts                  # Date/dayType/scheduleItem formatters
│   ├── riderSections.ts           # §N → page-number map + RiderSectionType → §N
│   ├── today.ts                   # Pinned demo clock — MOCK_TODAY / MOCK_NOW
│   └── cn.ts                      # Tailwind class joiner
├── components/
│   ├── ui/                        # Card, Chip, Button, Icon, Modal — primitives
│   ├── layout/                    # Layout, PrintLayout, Sidebar, BottomNav, TopBar, PageHeader
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
    ├── FlightIngest.tsx           # /ingest/flights
    ├── RiderIngest.tsx            # /ingest/riders
    └── More.tsx                   # /more (mobile overflow menu)
```

## The mock tour at a glance

- **Tour:** `Elsa y Elmar · Full Band 2025`, 2025-09-22 → 2025-10-23, status `in_progress`
- **Pinned demo clock:** `lib/today.ts` hard-codes "today" as `MOCK_TODAY = 2025-09-25` (and `MOCK_NOW` 09:00). Every "today" lookup reads from it — never `new Date()`.
- **Legs:** Mexico (`leg_mx`), USA (`leg_us`), South America (`leg_sa`)
- **Show cities:** Mexico City, Monterrey, Guadalajara, Los Angeles, Oakland, Miami, Bogotá, Lima, Santiago, Buenos Aires
- **Personnel (13):** 5 named from rider (Elsa Carvajal, Julian Bernal, Juan, Daniel, Manuel González PM) + 8 placeholders (Tour Manager, Audio Engineer, Lighting Engineer, VJ, MUA, Personal Asst, Staff #1, Staff #2). Last names for Juan/Daniel and full names for every placeholder are pending user input.
- **Sep 25 (Mexico City show)** is the fully-fleshed day, and also the pinned "today" — most demos use it as the reference.
- **Pre-locked days:** Sep 22–25 (seeded in `AppState`).

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

The TopBar viewer switcher (Lorenzo / Manuel / Audio / Elsa / Julian / MUA) re-renders the Day Detail and Day Sheets pages from that user's perspective. This is the killer demo for the visibility model — same data, different views.

## State (AppState)

Lives in React Context (`state/AppState.tsx`). The single provider is mounted **in `main.tsx`** so it wraps both `Layout` and `PrintLayout` — that's why locking a day in `/daysheet` updates `/print/daysheet` instantly.

Currently exposes:
- `tour`, `user`, `userKey`, `setUserKey`, `allUsers`
- `densityMode` (`'simple' | 'pro'`), `setDensityMode` — global Simple/Pro density toggle, persisted to localStorage, controls layout density only
- `lockedDays`, `isDayLocked(id)`, `toggleDayLocked(id)`, `setDayLocked(id, locked)`
- `getDayLastUpdated(day)` — resolves a `Day`'s last-updated `UpdateStamp` against an in-memory `dayUpdates` overlay (falls back to seeded `day.lastUpdated`); locking/unlocking a day live-stamps it with `MOCK_NOW` + current viewer
- `resolvedConflicts`, `resolveConflict(id, {chosenValue, source?, note?})`, `unresolveConflict(id)` — `resolveConflict` stamps `MOCK_NOW`
- `isSectionApproved(key)` / `getSectionApproval(key)` / `approveSection(key)` / `reopenSection(key)` — rider-section sign-off, keyed `${type}-${index}`; approvals seed from sections whose mock status is `approved` and stamp `MOCK_NOW` + current viewer
- `getSectionEdit(key)` / `updateSectionEdit(key, patch)` — inline corrections (`RiderSectionEdit`) layered over the AI extraction

When backend lands, replace with TanStack Query + Zustand or similar; the context shape is intentionally stable so callers don't have to change.

## Routing

```
/                          Tour Overview
/calendar                  Month grid
/calendar/:date            Day Detail
/personnel                 Crew + groups
/schedule                  Visibility editor
/daysheet                  In-app day sheet (defaults to first show)
/daysheet/:date            In-app day sheet for a date
/ingest/flights            Flight ingest demo
/ingest/riders             Rider ingest demo (the differentiator)
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
- **Modals always portal to `document.body`** via `createPortal` — needed because day-sheet rows are inside `<Link>` and a modal inside an anchor is invalid HTML. See `components/ui/Modal.tsx` and `CommandPalette.tsx` for the pattern.
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

- **Clarity + mobile redesign** (`redesign-plan.md`, landed) — `TodaySurface` is a role-aware "Today" surface used as both the desktop Tour Overview hero and the mobile home screen; `BottomNav` is the mobile tab bar (Today / Calendar / People / More) replacing the sidebar on small screens; `/more` is the mobile overflow menu. The pinned demo clock (`lib/today.ts`) makes "today" deterministic.
- **Simple/Pro density toggle** — `densityMode` in `AppState`, toggle in the TopBar, persisted to localStorage. Affects layout density only; no data is hidden.
- **Last-updated audit indicator** — `<LastUpdated>` renders "Last updated {date} by {name}" from a `Day.lastUpdated` `UpdateStamp` (resolved via `getDayLastUpdated`). Surfaced on TodaySurface, Day Sheet (desktop + mobile + tools-rail "Revision" card), the print day sheet, and Day Detail. Locking a day or resolving a conflict live-stamps with `MOCK_NOW`.
- **Printable day sheet** (`/print/daysheet/:date`) — uses `mockVenues.ts` for venue/promoter info. If a new show city is added, also add a venue entry there or the print sheet's right column will be empty.
- **Per-day lock state** — chips render in DaySheets day picker, Calendar grid, Tour Overview stat. Lock state is in-memory only; resets on refresh.
- **Conflict feed + resolution flow** — surface on Tour Overview + drill-in on `/ingest/riders`. Resolve modal pre-fills mailto: with PM's email + conflict context.
- **Rider section review — inline edit + approve** — on `/ingest/riders` each section can be corrected inline and then **Approved**. The Input List, Monitor Mix, FOH Outputs tables and free-text sections have editable fields (borderless `EditableText` / `EditableSelect`); edits layer over the extraction via `updateSectionEdit` (keyed `${type}-${index}`). Approving stamps the section with an `UpdateStamp` and shows `<LastUpdated label="Approved">`; an approved section is locked until **Reopen**. The nested sections (Backline, Catering, Lodging) are review-only for now — see the gap list.
- **In-app PDF viewer** — `PdfViewerProvider` / `usePdfViewer()` (`components/PdfViewer.tsx`, mounted in `main.tsx`) shows PDFs in a popup `Modal` (size `xl`) at the cited page, instead of a new tab. Wired into every PDF reference: `RiderRef` §N/p.N links, `SourceTag` + `MockTag` artifact links, the rider filename chip, and the flight filename chips. **Full design + the unbuilt highlighting plan are in `pdf-highlighter.md` — read it before touching this.**
- **Warning explainers** — `<ExplainTag>` (`components/ExplainTag.tsx`) adds a clickable amber "(?)" to every red/alert element (rider version warning, extraction flags, conflicts, "Sensitive" markers, excluded-brand flags); each opens a plain-English explanation.
- **Flight PDFs** — `web/public/` holds two generated flight-confirmation PDFs. They're produced by `web/scripts/gen-flight-pdfs.mjs` (one-off Node script; `pdf-lib` is a devDependency). Re-run it if the `flightImports` mock data changes.
- **Cmd+K palette** — provider in `Layout`. Search index built from tour days + personnel + schedule items + venues + pages.
- **Route map** — static SVG with hard-coded city lat/lngs in `RouteMap.tsx`. New cities need their lat/lng added there.
- **Calendar List/Grid toggle** — `Calendar.tsx` defaults to Grid on desktop, List on mobile, switchable on both. List view groups days by month with headers; the month grid uses compact cells on mobile.
- **Lobby-call ladder** — only renders for show days. Anchor is the `doors` schedule item; if missing, ladder shows a "set a doors time" empty state.

## Pending user-blocked items

The tour roster has 8 placeholder names waiting for user input:
- Juan, Daniel — last names (drummer + bassist, named in rider §6 monitor mixes but no surnames)
- Tour Manager — real name + contact info (the current `p_lorenzo`/`tp_lorenzo` is a placeholder; the role-switcher's `lorenzo` key is kept for stability)
- Audio Engineer (FOH + Monitors), Lighting Engineer, VJ, MUA, Personal Assistant, Staff #1, Staff #2 — full names

Once provided, update `persons[]` in `web/src/data/mockTour.ts` and remove `isPlaceholder: true` from the corresponding `TourPerson` entries. For the TM, also update `currentUsers.lorenzo` (name + role label) and re-add a `realSources` entry if you want the `(i)` provenance modal to point to "user entry".

## What's still on the gap list (from the audit)

Tier 1 untouched:
- Public read-only share link for day sheets (tokenized URL → `/print/daysheet/:date?token=...`)

Tier 2:
- PDF text highlighting — the viewer + jump-to-page are done, but auto-highlighting the cited text is blocked on a data issue (Spanish PDF vs. English citations). Plan + fix in `pdf-highlighter.md`.
- Inline editing for the nested rider sections — Backline, Catering, and Lodging are still review-only; only the tabular sections (Input List, Monitor Mix, FOH Outputs) and free-text sections are inline-editable today. Eventually every section type should be correctable.
- Diff between rider versions
- Catering allergy/diet aggregator
- Promoter contact card as a first-class entity
- Timezone-aware times throughout

(Shipped from earlier backlogs — see "Recent additions": the mobile-shaped day sheet, mobile bottom-nav, Today screen, Simple/Pro toggle, last-updated indicator, and tap-to-call / WhatsApp / maps deep links on the Today surface, mobile day sheet, and print sheet.)

See the original audit output / `potential-implementation.md` §9 for the full backlog.
