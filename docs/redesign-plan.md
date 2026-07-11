# Redesign Plan — Clarity + Mobile

**Status:** planning · companion to `potential-implementation.md`

A combined redesign pass with two goals:

1. **Clarity** — calm the desktop app's information density; it currently
   overwhelms anyone who isn't a seasoned touring/production user.
2. **Mobile** — the app is currently desktop-only (the sidebar is literally
   hidden on phones with nothing in its place). Make it work on a phone.

These are treated as **one combined effort**, not two projects.

---

## Decisions taken (with the user)

- **Mobile is role-aware** — one app; the home screen adapts to who is
  signed in (crew/artist vs TM), reusing the existing viewer model.
- **Provenance tags stay ON everywhere** — during this build phase the
  `(mock)` / `(i)` tags are a working tool for tracking what is real vs
  mock and where data should come from. The Simple/Pro toggle therefore
  governs **layout density**, NOT the tags. (When the build phase ends and
  data is real, "tags off in Simple mode" becomes a one-line change.)
- **Scope** — Full IA pass **and** a Simple/Pro density toggle.
- **Sequencing** — one combined pass; clarity + mobile designed together.
- **The mock tour becomes "in progress"** via a pinned demo clock — see
  Part 0.

---

## The organizing idea

**Calm by default, detail on demand.** The app today shows everything at
full fidelity, all the time. Every screen should instead lead with the one
thing that matters and let the user drill for the rest.

Two structural levers carry the redesign:

1. **One shared "Today" surface** — the same component is the desktop Tour
   Overview hero and the mobile home screen. Build it once.
2. **A Simple/Pro toggle** — global, persisted, layout-density only.

---

## Part 0 — Pin a demo clock (make the tour "in progress")

**Problem.** The mock tour runs 2025-09-22 → 2025-10-23 with
`status: 'wrapped'`. The app's real clock is 2026. Every "today"-relative
feature (the new Today screen, the calendar's today marker, upcoming-days,
lock-state relevance) has nothing live to show.

**Misconception to retire.** The tour dates are *not* "from the rider." The
rider PDF is a per-show requirements document — no route, no dates, no
venues. Tour dates have always been mock (sourced from the mock
booking-agent deal memo) and are already tagged `(mock)`.

**Decision — pin the clock, don't chase real dates:**

- Add a single `MOCK_TODAY` constant (e.g. `web/src/lib/today.ts`), set to
  `2025-09-25` — the fully-fleshed Mexico City show day.
- Replace every `new Date().toISOString()` "today" lookup with a read from
  this constant (currently in `Sidebar.tsx`, `TourOverview.tsx`,
  `Calendar.tsx`, and anywhere else `today` is derived).
- Flip `mockTour.status` from `wrapped` → `in_progress`.
- Surface it honestly: a small "Demo date · Sep 25, 2025" note, or fold
  into the existing `tour_route` mock provenance.

**Why this over shifting dates to 2026:** a pinned clock never goes stale;
real 2026 dates would wrap again within months. 2025 dates also stay
coherent with the 2025 rider PDF.

**Why Sep 25:** it is the reference day — most schedule items, hotels,
travel, and the seeded lock range all land there, so the Today screen
demos at its richest.

---

## Part A — The Simple / Pro toggle

A global control in the top bar, persisted to `localStorage`, respected by
every page.

| | **Pro** (default for now) | **Simple** |
|---|---|---|
| Audience | Building & advancing the tour | Everyday "what's happening" use |
| Panels | All expanded | Secondary panels collapsed |
| Tour Overview | Full multi-block view | Today-spine + collapsed sections |
| Day Sheet | Edit view + all tool rails | Clean sheet, tools tucked away |
| Provenance tags | On | On *(stays on now; toggle-able later)* |

Pro mode is **not** today's cluttered app — it is the *restructured* app
(Part B) with everything expanded. Both modes sit on top of the IA pass.

---

## Part B — Full IA pass (desktop)

Every page restructured around *calm by default, detail on demand*.

### Tour Overview
Currently 7 blocks shouting at equal volume. Reframe as a hierarchy
answering three questions:

1. **Where are we right now?** → a single hero "Today" card.
2. **What needs me?** → an attention strip (unresolved conflicts, unlocked
   days, unpublished sheets).
3. **Shape of the tour** → route map, stats, recent/upcoming days — demoted
   to a calmer secondary grid below.

Remove the "Build status" card (dev artifact). "From the rider" facts →
collapsible. `DataSourcesPanel` → collapsed by default.

### Day Sheets
Too much chrome around the actual sheet. Make the **sheet the hero**:

- Replace the 32-row day picker with a compact date stepper
  (`‹ Thu Sep 25 ›`); the full list is one click away.
- Collapse the lobby-call ladder + revision card into a tools rail —
  hidden in Simple mode.
- Consolidate the Edit/Personalized mode toggle + viewer picker.

### Rider Ingest
Move the raw JSON "Structured output" card behind a "view raw extraction"
disclosure — it is a dev artifact for everyday users.

### Calendar
Keep the month grid for desktop; trim filter chrome. Add a vertical list
view (which doubles as the mobile calendar — see Part C).

### Global cleanup threads
- **Remove dev scaffolding** — "Build status" card, "Feature 0X ·"
  eyebrows, the JSON peek.
- **Typography** — reserve mono-caps for actual *data* (times, codes,
  counts); section labels move to calm sentence case; let whitespace carry
  hierarchy.
- **Language** — "DayType" → "Day type", "Ingest · Riders" → "Import
  rider", "Schedule & Visibility" → "Schedule"; drop "ABAC" / "provenance"
  from visible UI.
- **Fewer clicks** — app opens to Today (not a dashboard); day stepper
  replaces the list; prev/next on every day detail.

---

## Part C — Mobile (role-aware, designed alongside)

### Navigation
A **bottom tab bar** replaces the (currently hidden) sidebar:
**Today · Calendar · People · More**. "More" holds the power tools and
settings.

### The "Today" home screen
The *same component* as the desktop Tour Overview hero, role-aware:

- **Crew / artist signed in** → their day: call times filtered to what they
  need, venue with tap-to-navigate, their travel, contacts. Read-focused.
- **TM signed in** → today + attention strip + quick actions (send sheet,
  resolve conflict, lock day).

### Mobile day sheet
Today + tomorrow, vertical, large type, tap-to-call / tap-to-navigate
everywhere. Essentially the print sheet's content re-flowed for a phone and
made interactive.

### Desktop-first (mobile read-only or hidden)
Rider ingest section editor and the visibility editor stay desktop-first —
no value in cramming a 44-channel input table onto a phone. Mobile shows a
read-only rider summary.

### Mobile must-haves
- **44px minimum touch targets** (current buttons are 28–32px).
- **Tap-to-call / WhatsApp / maps** on every phone number and address.
- **PWA + offline-cached day sheets** — works in a venue basement with no
  signal. This is the "works when it matters" feature.
- Larger base font; the field-notebook density relaxes on small screens.

---

## Part D — Build order (within the one combined pass)

1. **Part 0** — pin the demo clock, flip status to `in_progress`.
2. **Foundations** — Simple/Pro toggle + mobile bottom-nav shell +
   responsive layout primitives. Nothing user-visible breaks.
3. **The "Today" screen** — built once; desktop hero + mobile home;
   role-aware.
4. **Day Sheet rework** — desktop declutter + mobile day sheet (shared
   component).
5. **Calendar list view** — mobile + desktop option.
6. **Global cleanup** — strip dev artifacts, typography pass, language
   pass.
7. **PWA + offline + tap-to-everything.**
8. **Power tools** — rider ingest + visibility editor desktop polish,
   mobile graceful-degrade.

---

## Open questions / risks

- **Provenance toggle scope.** Current plan: the Simple/Pro toggle is
  layout-only and tags stay on in both modes during the build phase. If
  Simple mode should also dim the tags down later, the toggle already
  carries the right signal — it is a one-flag change.
- **Offline scope for the PWA.** Caching day sheets is clear-cut. Decide
  later whether the whole app shell is offline-capable or just the day
  sheets.
- **"People" tab vs role-switcher.** The mobile People tab and the existing
  desktop viewer/role switcher overlap conceptually — reconcile during the
  Today-screen build.

---

## Success criteria

- A first-time, non-touring user can open the app and understand "what is
  happening today" within seconds, without touching a power tool.
- The app is fully usable on a 375px-wide phone — navigation, today's
  schedule, contacts, calendar.
- Pro mode loses nothing that exists today; Simple mode is genuinely calm.
- The provenance system stays intact and visible throughout the build
  phase.

---

## Cross-document conflicts (next)

Parking-lot note. The current `detectConflicts()` in `lib/pdfParser.ts` only
catches **intra-document** mistakes — values that disagree *inside the same
rider* (§4 vs §8 generator count, §12 header-vs-rows occupant count, channel
flags). That is the right scope for it. The next layer is **cross-document**
contradictions, which is where most real-world surprises live.

Pairs worth catching:

- **Rider v1 vs rider v2** — when the PM sends an updated rider, what changed?
  (channels added/dropped, monitor mix reassigned, soundcheck window moved.)
- **Rider vs travel grid** — §11 says "06 economy + 02 AM Plus = 8 tickets";
  the travel-agent grid lists 9 passengers on that leg. Real, common.
- **Rider vs hotel block** — §12 rooming sheet says 11 rooms (king/double mix);
  the hotel-block confirmation lists 9. Common when blocks get trimmed late.
- **Rider vs booking-agent deal memo** — load-in time, curfew, doors, set
  length, support slot. Riders and deal memos drift constantly.

Data-model changes required:

- `RiderImport` gets `version: number` + `replacesId?: string` so v1↔v2 diffs
  have a stable target.
- `Conflict` gets a `source: ConflictSource` discriminator —
  `'intra_rider' | 'rider_vs_travel' | 'rider_vs_hotel' | 'rider_vs_deal_memo' | 'rider_v1_vs_v2'`.
  Existing seed conflicts in `data/mockTour.ts` (`cf_room_count`, `cf_flight_count`)
  get tagged `'intra_rider'` as part of this pass.
- A separate diff-engine layer (probably `lib/conflictDetectors/*.ts`) that
  takes two parsed imports and emits `Conflict[]`. The rider parser's
  `detectConflicts()` stays narrow — one detector among many.

UI: `ConflictFeed` should group by `source` so the TM understands which
*pair* of documents is contradicting (today every conflict is implicitly "the
rider vs itself"). Resolution flow already supports `chosenValue` + `source` —
the source picker just needs more options.
