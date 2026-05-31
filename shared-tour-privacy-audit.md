# Shared-Tour Privacy Audit — Central-Hub — 2026-05-31

## Executive Summary

The app's ABAC model is correctly defined in `lib/visibility.ts` and the resolver is sound. However, **three surfaces render sensitive data (schedule, travel, hotels, tasks) to all viewers without a `canSee` filter**, and one surface (CommandPalette) indexes every schedule item regardless of the viewer's role. In a shared-tour model where every member's browser holds the full dataset, these represent real privacy leaks — a sound engineer or MUA could see management-only calls, hotel details marked sensitive, or PNR codes. Additionally, all fixture-generated Travel and Hotel records default to `vis.everyone('sees')`, meaning visibility gates at the render layer are the only protection, making the unfiltered render sites even more critical.

---

## 1. Visibility-Leak Render Sites

### Unfiltered Render Sites Table

| # | File | Line(s) | What it renders | Filtered? | Severity |
|---|------|---------|-----------------|-----------|----------|
| A | `routes/DaySheetPrint.tsx` | 59–63 | `getScheduleItemsForDay` → all schedule items | **No** | Critical |
| B | `routes/DaySheetPrint.tsx` | 64 | `getTravelForDay` → all travel | **No** | Critical |
| C | `routes/DaySheetPrint.tsx` | 65 | `getHotelsForDay` → all hotels | **No** | Critical |
| D | `routes/DayDetail.tsx` | 70–72 | `getTravelForDay`, `getHotelsForDay`, `getTasksForDay` | Partial — travel filters, hotels show name but hide address, tasks entirely unfiltered | High |
| E | `components/CommandPalette.tsx` | 117–127 | `tour.scheduleItems` all items in search index | **No** | High |
| F | `routes/ScheduleAndVisibility.tsx` | 59–67 | `tour.scheduleItems` entire list (item titles, times) in the left rail | Manager-only route | Low (gated) |

---

### A–C. `DaySheetPrint.tsx` — Full data dump with no user context

**File:** `web/src/routes/DaySheetPrint.tsx`, lines 44–65.

```ts
// line 44-53 — AppState destructured with no `user`
const { tour, isDayLocked, getDayLastUpdated, getDay,
        getScheduleItemsForDay, getTravelForDay, getHotelsForDay } = useApp();
// ...
const items  = getScheduleItemsForDay(day.id).sort(...);   // line 59 — UNFILTERED
const travel = getTravelForDay(day.id);                    // line 62 — UNFILTERED
const hotels = getHotelsForDay(day.id);                    // line 63 — UNFILTERED
```

`user` is never destructured. All three raw arrays go straight into `<ScheduleRow>`, `<TravelRow>`, and `<HotelRow>` with zero visibility checks. The print route is accessible at `/print/daysheet/:date` with only a mock `shareToken` gate that anyone with the URL can satisfy (or bypass — `verifyShareToken` is a client-side base64 decode, not server auth). In a shared-tour model this prints the full unredacted schedule, all PNR numbers, all hotel names and addresses for every crew member.

**Fix:** Destructure `user` from `useApp()`, then filter each array:
```ts
const { ..., user } = useApp();
const items  = getScheduleItemsForDay(day.id)
  .filter(it => resolveVisibility(it.visibility, user) !== 'blocked')
  .sort(...);
const travel = getTravelForDay(day.id)
  .filter(t => resolveVisibility(t.visibility, user) !== 'blocked');
const hotels = getHotelsForDay(day.id)
  .filter(h => resolveVisibility(h.visibility, user) !== 'blocked');
```

---

### D. `DayDetail.tsx` — Tasks unfiltered, hotels partially handled

**File:** `web/src/routes/DayDetail.tsx`, lines 69–72.

```ts
const items = managerView ? allItems
  : allItems.filter((it) => resolveVisibility(it.visibility, user) !== 'blocked'); // OK

const travel = getTravelForDay(day.id);   // line 70 — raw; filtered per-row at render (line 289)
const hotels = getHotelsForDay(day.id);   // line 71 — raw; partially handled per-row (line 330)
const tasks  = getTasksForDay(day.id);    // line 72 — NO visibility check at all
```

Travel and hotels do apply per-row checks inside the render loop (lines 289–290 for travel, lines 330–331 for hotels — hotels show the name even when blocked, only hiding the address). Tasks (lines 367–397) have no `canSee` guard whatsoever — every task title and owner name is rendered to all viewers.

**Fix for tasks:** Add a filter at line 72:
```ts
const tasks = getTasksForDay(day.id)
  .filter(t => managerView || resolveVisibility(t.visibility, user) !== 'blocked');
```

**Fix for travel/hotels:** Lift the per-row null-return to a pre-filter (matches the DaySheets pattern) for consistency and to prevent count badge disclosures ("2 segments" leaking that travel exists).

---

### E. `CommandPalette.tsx` — Search index includes all schedule items

**File:** `web/src/components/CommandPalette.tsx`, lines 117–127.

```ts
for (const si of tour.scheduleItems) {        // ALL items — no visibility filter
  const day = tour.days.find((d) => d.id === si.dayId);
  if (!day) continue;
  items.push({
    type: 'schedule',
    label: si.title,                          // title revealed in search results
    sublabel: `${fmtDate(...)} · ${si.startTime}${...}${si.location ? ...}`,
    to: `/daysheet/${day.date}`,
    keywords: [si.title, si.location ?? '', si.type, day.date],
  });
}
```

Any member who opens Cmd+K and types a keyword can see the title, time, location, and date of every schedule item regardless of visibility settings. The `buildIndex(tour)` function takes only `tour` — it has no access to `user`.

**Fix:** Pass `user` into `buildIndex`, or filter inside `CommandPaletteProvider`:
```ts
const { tour, user } = useApp();
const items = useMemo(() => buildIndex(tour, user), [tour, user]);
// In buildIndex: filter schedule items with resolveVisibility(si.visibility, user) !== 'blocked'
```

---

## 2. Manager-Only Controls — Verification

| Surface | Control | Gated by `managerView`? | Status |
|---------|---------|------------------------|--------|
| `DaySheets.tsx` line 120 | Lock/Unlock day button | `{managerView && ...}` | Correct |
| `DaySheets.tsx` line 174 | Publish button | `{managerView && ...}` | Correct |
| `DaySheets.tsx` line 81, 202 | Edit mode toggle (ModeToggle) | `effectiveMode = managerView ? mode : 'personal'` | Correct |
| `DaySheets.tsx` line 398 | Preview-as selector (ToolsRail) | `mode === 'personal' && managerView` | Correct |
| `DayDetail.tsx` line 64 | `managerView` derivation | `user.groupId === 'grp_mgmt' || user.groupId === 'grp_production'` | Correct |
| `DayDetail.tsx` line 158 | Add item button | `{managerView && ...}` | Correct |
| `DayDetail.tsx` line 267 | Promoter email field | `{venue.promoterEmail && managerView && ...}` | Correct |
| `TodaySurface.tsx` line 90 | Lock day button | `{managerView && ...}` | Correct |
| `ScheduleAndVisibility.tsx` line 103 | Entire route | Early return if `!managerView` | Correct |
| `DaySheetPrint.tsx` | No manager gate applied anywhere | No `user` in scope | **Gap — see finding A–C** |

**Summary:** All interactive controls (lock, publish, edit-mode toggle, preview-as) are correctly gated. The gap is the print route, which has no user context at all.

---

## 3. Data-Linking Integrity

### 3a. Travel — `visibility: vis.everyone('sees')` hardcoded

**File:** `web/src/state/AppState.tsx` line 880; `web/src/data/hotelFixture.ts` lines 143, 151.

All Travel records created by `commitFlightImportToScratch` receive `visibility: vis.everyone('sees')` unconditionally. All Hotel and Task records from `hotelFixture.ts` also receive `vis.everyone('sees')`. In the shared-tour model, travel + hotel data contains PNR numbers and hotel addresses — among the most sensitive fields. These items should inherit the type-level visibility template (same as schedule items do via `defaultVisibilityForType`) or at minimum default to `{ default: 'blocked', groups: { grp_mgmt: 'owns', grp_production: 'owns' } }` rather than "everyone sees".

**Fix:** In `commitFlightImportToScratch`, replace `vis.everyone('sees')` with `defaultVisibilityForType('bus_call')` (or a new `defaultVisibilityForTravel()`) so the seed is the locked-by-default template instead of fully open.

### 3b. `TourPerson.groupId` → `CurrentUser.groupId` chain — intact

`riderFixture.ts` assigns `groupId` to every TourPerson (e.g., `grp_artist`, `grp_audio`, `grp_mgmt`). `scratchTour.ts` creates the same standard groups. `AppState` derives `allUsers` from `tour.personnel`, and `scratchUsers` in `data/scratchTour.ts` derives `CurrentUser` from each `TourPerson` (`groupId` + `tagIds` pass through correctly). `resolveVisibility` correctly reads `user.groupId` and `user.tagIds`. The chain is sound.

### 3c. `getScheduleItemsForDay` — visibilityEdits overlay applied, but no user filter

**File:** `web/src/state/AppState.tsx` lines 1296–1309.

The `getScheduleItemsForDay` callback correctly layers the `visibilityEdits` overlay but intentionally does not filter by user — per CLAUDE.md: "filtering must happen at the render site." The problem is that render sites A–E above fail to apply that filter. The contract is correct; the call sites are broken.

### 3d. Route CSV seeding — schedule items carry locked-by-default visibility

**File:** `lib/routeCsv.ts` seeds schedule items using `defaultVisibilityForType(type)` (confirmed by `AppState.getScheduleTypeDefault` injection). This is correct — route-imported items start locked-by-default and only become visible after the TM configures them on `/schedule`.

### 3e. `access.ts` — `computeReadableBy` correctly uses `resolveVisibility`

`lib/access.ts` reuses the same `resolveVisibility` from `lib/visibility.ts`. Tests in `web/tests/lib/access.test.ts` cover owner-floor roles, group overrides, tag overrides, and person overrides. The server-side denormalization logic is correct. No issues found.

---

## 4. CommandPalette / Search — Summary

The Cmd+K index is built from `tour.scheduleItems` (all items, no filter) and surfaced to all users. Item titles, start times, locations, and day dates are all indexed as keywords. A blocked item like "Artist Dinner (private)" with a sensitive location is fully searchable by crew. This is a search-based information disclosure.

Secondary concern: the `buildIndex` function is called on every `[tour]` change via `useMemo`, which is fine for performance — but because `user` is not a dependency, the index never re-computes when the viewer switches (TopBar role switcher). In the current single-user model this is academic; in the shared-tour model it means late index updates would show a stale (potentially over-permissive) set of results.

---

## Cross-Surface Observations

1. **`DaySheets.tsx` filters correctly (lines 472–474, 665–667), `DaySheetPrint.tsx` does not.** The desktop DaySheet and MobileDaySheet components both guard with `resolveVisibility(...) !== 'blocked'`; the print route is a copy that omitted these guards. This is a classic copy-without-filter divergence.

2. **Hotels show their name even when blocked.** In `DayDetail.tsx` lines 335–337, the hotel card renders `h.name` unconditionally, then shows `<em>Address hidden for your role</em>` only for the address. In the current seed data hotels default to `vis.everyone('sees')` so this is moot, but once Travel/Hotel visibility is locked by default the hotel name will still leak to blocked users.

3. **`DaySheets.tsx` (edit mode) renders `ScheduleEditor` with all items (line 472: `mode === 'edit' ? allItems : ...`).** Edit mode is manager-only (the outer `effectiveMode` is always `'personal'` for non-managers), so this is not a leak — but the cascade guard (`ScheduleEditor` receives `items` which is the unfiltered `allItems` in edit mode) is fragile: if anything calls `ScheduleEditor` with a non-manager user, all items render. Add an assertion or comment.

4. **`LobbyCallLadder.tsx` — schedule items read via `getScheduleItemsForDay` but no user filter.** The ladder only exposes computed times (not raw item data), and it's embedded in the `ToolsRail` which is manager-only in the Edit/Personal toggle path. However it's also rendered in `MobileDaySheet` for all users. An unfiltered `items.find(i => i.type === 'doors')` could expose whether a `doors` item exists to a user who shouldn't see it. Low severity given the ladder shows only computed times — but worth noting.

5. **Travel visibility seed vs render contract mismatch:** `hotelFixture.ts` and `commitFlightImportToScratch` both use `vis.everyone('sees')`, but `DayDetail.tsx` and `DaySheets.tsx` include per-item `resolveVisibility` guards for travel and hotels. The guards are never exercised because the seeds are fully open — making it impossible to test the guard correctness manually.

---

## Manager-Gate Gap Summary

Only one gap: `DaySheetPrint.tsx` has no `user` at all, so manager-only data (sensitive schedule items, PNR numbers, hotel addresses) flows to any viewer who has the URL.

---

## Deferred Items Worth Re-Triaging

- **`vis.everyone('sees')` on Travel/Hotel** — acceptable at prototype stage when privacy model wasn't enforced client-side; **urgent now** that the shared-tour model makes client-side the only enforcement layer.
- **Share token is client-side base64 only** (noted in CLAUDE.md: "real auth-gated sharing needs a server-issued token"). With the move to Supabase, token verification should move server-side before sharing ships.
- **`Hotel.sensitive` flag exists but is not honoured uniformly.** `DaySheets.tsx` renders the "Hidden in print" chip but still shows `h.name` and `h.address` to all viewers in the desktop `DaySheet` component regardless of `resolveVisibility` (lines 796–815 — hotel section is only conditionally rendered but not visibility-checked). Fix: add `resolveVisibility(h.visibility, effectiveUser) !== 'blocked'` guard before rendering lodging rows.
