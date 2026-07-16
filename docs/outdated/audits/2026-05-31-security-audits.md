# Security audits — 2026-05-31 (shared-tour privacy + submissions)

> Combined from `shared-tour-privacy-audit.md` and `submissions-audit.md` (same date, same milestone) during the 2026-07-11 docs reorganization.

---

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

---

# Submissions Audit — Central-Hub Milestone 2 — 2026-05-31

## Executive Summary

The RLS design and server-side constraints are solid: `propose_submission()` correctly forces `status='pending'` and the caller's own uid/email; no direct INSERT/UPDATE policy exists for non-managers; no DELETE policy exists; the manager UPDATE policy has both `USING` and `WITH CHECK`. The storage folder-index math in the migration comments matches what the code actually uploads. The `/me` filtering is correct; `/submissions` is gated by `managerView`; `/ingest/*` both gate non-managers; nav entries and Cmd+K hide manager-only pages for crew.

Three issues are worth flagging, none of them a ship-blocker today (this is a trusted-crew prototype), but one is a real escalation vector once untrusted users are onboarded.

---

## Critical (none)

No critical ship-blockers found. The RLS constraints correctly block the key escalation vectors.

---

## High

**[Security / Auth]** `supabase.ts:437–460` — `approveSubmission` and `rejectSubmission` issue a direct `.update()` on the `submissions` table from the client (not through an RPC). The `"submissions manager update"` RLS policy gates this to `is_manager(tour_id)`, so a non-manager's call will be rejected by Postgres. However, the `WITH CHECK` clause on the policy (`with check (is_manager(tour_id))`) does not prevent a manager from changing `tour_id`, `user_id`, or `email` on an existing row — it only verifies they're still a manager after the write. A malicious manager could reassign a submission to a different `tour_id` or `user_id`. This is low-risk for a single-tour trusted-crew prototype, but should be hardened to an RPC (like `approve_submission(id, note)`) before multi-tour use.

**[Security / Auth]** `AppState.tsx:2008–2024` — `approveSubmission` is callable by anyone who can call `useApp()` — there is no `managerView` guard inside the AppState mutator itself. The only UI guard is in `SubmissionsInbox.tsx` (line 40), which renders a fallback instead of the Approve/Reject buttons for non-managers. A crew member who can reach `useApp()` in the browser console can call `approveSubmission` directly, flipping a submission from `pending` to `approved` in the Supabase table. On `supabase`, the `"submissions manager update"` RLS policy will reject this; on `local` there is no guard and any user can approve any submission. Since local is a single-user sandbox this is tolerable today, but if the AppState mutator ever needs to be hardened, add a `managerView` check inside `approveSubmission` mirroring the check already in `rejectSubmission`'s UI.

---

## Medium

**[Cross-surface consistency]** `MyTravelInfo.tsx:72–74` — `mySubmissions` filter is `!membership || s.uid === membership.uid || s.email === membership.email`. On the **supabase** path the RLS `"submissions own read"` policy already restricts the DB query to the caller's own rows, so the client-side filter is redundant but harmless. On the **local** path `membership` is the synthetic `LOCAL_MEMBERSHIP` with `uid: 'local-user'` and `email: ''`. Because `email` is `''`, the `s.email === membership.email` arm will match any submission whose `email` is also `''` — which is every locally-created submission (see `AppState.tsx:1992`). So the filter accidentally admits every local submission regardless of uid. This doesn't matter with a single local user, but once local is used for multi-user testing it leaks all submissions to every viewer. Fix: filter on `s.uid === membership.uid` only (email is a fallback for legacy rows, not needed here since `uid` is always populated on local).

**[Correctness / Persist]** `AppState.tsx:1977–1983` — on the supabase path, if `backend.savePdf` (the storage upload) fails after `propose_submission` succeeds, the submission row exists in the DB with a `storage_path` that points to a file that was never written. The `loadSubmissionFileUrl` call then silently returns `null` and the manager sees "Loading file…" indefinitely. The RPC-then-upload ordering is correct (you need the id before you can build the path), but there is no rollback or retry on storage failure, and no error surfaced to the user. Fix: catch the `savePdf` error and either surface a toast or call `rejectSubmission` with a system note so the manager sees a broken file rather than a spinner.

**[UX / Ingest gating]** `SubmissionsInbox.tsx:40–49` — the non-manager fallback renders a full page with header and a "Managers only" card, which is correct. However, the `useEffect` that calls `refreshSubmissions()` fires unconditionally (line 28) before the `managerView` check on line 40, so a non-manager triggers a `listSubmissions` DB call that the RLS "own read" policy then returns (their own rows only). This is not a security issue (they only see their own rows), but it is a wasted round-trip. Fix: guard `refreshSubmissions` with `if (managerView)` or move it inside the `managerView` branch.

**[Correctness / `on conflict do nothing`]** `0003_submissions.sql:129` — the `INSERT ... ON CONFLICT (id) DO NOTHING ... RETURNING * INTO inserted` means a re-sent request with the same client-generated id (e.g., a retry after a network timeout) silently returns `NULL` rather than the existing row. `AppState.tsx:1982` then skips the `setSubmissions` push, so the retry appears to fail from the client's perspective even though the first attempt succeeded. The client generates `sub_${uid}_${Date.now()}` — millisecond collisions are possible on double-tap. Fix: on conflict return the existing row (`ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id RETURNING *`) so a retry is idempotent from the caller's perspective.

---

## Low

**[Documentation]** `0003_submissions.sql:139–177` — the storage policies are documented as SQL comment blocks inside the migration, but they are not applied by the migration script itself (unlike the table RLS above). They require a manual step in the Supabase Dashboard (Storage → tour-pdfs → Policies). This is called out in the comment, but it means a developer who runs the migration and doesn't read the comment will deploy without the storage policies — crew would be able to read each other's submission files. Fix: add a `/* MANUAL STEP REQUIRED */` warning at the top of the migration, or (better) use Supabase's storage RLS API in a separate migration so the policy is applied automatically.

**[UX / Empty state]** `SubmissionsInbox.tsx` — when the inbox loads it shows the empty state briefly before `refreshSubmissions` resolves, then re-renders. There is no loading indicator, so a manager with pending submissions sees "No submissions yet" flash before the list appears. Minor polish issue; fix by showing a skeleton or spinner while `refreshSubmissions` is in-flight.

**[Correctness / `addDocument` liveLink]** `SubmissionsInbox.tsx:214–218` — `addDocument({ ..., liveLink: fileUrl ?? '' })` passes a Blob URL as `liveLink`. Blob URLs are session-scoped and revoked after 60 seconds (the `setTimeout(() => URL.revokeObjectURL(url), 60_000)` is in `MyTravelInfo.tsx:276` but not in `SubmissionsInbox`). After the tab closes or the Blob is GC'd, the `Document` record in the tour has a dead `liveLink`. This is a prototype-tier issue (Documents surface isn't fully built) but worth noting before the Documents viewer is wired up. Fix: store the `storagePath` string rather than the ephemeral Blob URL, and resolve it to a fresh signed URL at view time.

**[Consistency / `removeTourPerson` missing from `value` useMemo deps]** `AppState.tsx:2268` — `removeTourPerson` is listed in the interface and implemented, but is absent from the `useMemo` dependency array on line 2268. It is present in the `value` object (line ~2251), so the callback is included in the context, but a stale-closure lint rule would flag the missing dep. This is harmless (the callback itself is stable via `useCallback`) but inconsistent with every other entry in the memo.

---

## Looks Correct

- **RLS read policy** — two non-overlapping SELECT policies (`"submissions own read"`: `user_id = auth.uid()` AND `"submissions manager read"`: `is_manager(tour_id)`) correctly implement "own OR manager". A crew member cannot read another crew member's submission because `user_id = auth.uid()` matches only their row and `is_manager()` returns false for non-managers.
- **No direct INSERT policy** — `authenticated` has no INSERT grant on `submissions`. The only write path is `propose_submission()` SECURITY DEFINER, which forces `status = 'pending'` and `user_id = me_uid`. A caller cannot supply a different `user_id`, a different `status`, or target a tour they're not an active member of.
- **No self-approve / self-escalate** — there is no UPDATE policy for the submitter. The manager UPDATE policy (`is_manager(tour_id)`) blocks a non-manager from flipping their own row. Combined with no direct INSERT, there is no escalation path at the DB layer.
- **No DELETE policy** — submissions are a permanent audit trail. Confirmed.
- **`propose_submission` active-member guard** — `if not is_active_member(p_tour_id)` rejects pending and revoked users. A pending user waiting for access cannot submit.
- **Storage folder-index math** — path `{tourId}/submissions/{uid}/{id}.pdf` → `folder[1]=tourId`, `folder[2]='submissions'`, `folder[3]=uid`. The policy expressions `(storage.foldername(name))[1/2/3]` match exactly. `pdfPath()` in `supabase.ts:57` builds `${tourId}/${scope}/${id}.pdf`; for scope `'submissions'` and id `${uid}/${subId}` the result is `${tourId}/submissions/${uid}/${subId}.pdf` — correct.
- **`/me` travel/hotel filtering** — `myTravel` filters on `passengers.some(p => p.tourPersonId === myPersonId)` and `myHotels` on `occupants.some(o => o.tourPersonId === myPersonId)`. These correctly scope to the member's own bookings without exposing other passengers' rows.
- **`/me` schedule filtering** — uses `getScheduleItemsForDay` (which layers `visibilityEdits`) then `canSee(it.visibility, user)`. This is the same path `DaySheets` uses and is correct.
- **`/ingest/flights` gate** — `FlightIngest.tsx:42–60` returns a not-authorized fallback for non-managers with a link to `/me`. Confirmed.
- **`/ingest/riders` gate** — `RiderIngest.tsx:154–185` returns a not-authorized fallback for non-managers. Confirmed.
- **Sidebar nav** — `MANAGER_ONLY` set includes `/schedule`, `/access`, `/submissions`, `/ingest/flights`, `/ingest/riders`. Filtered out for non-managers at line 125.
- **Cmd+K** — `buildIndex` filters manager-only pages by `managerView` at line 97. Confirmed.
- **`/more` overflow** — `managerOnly: true` entries filtered by `managerView` at line 21.
- **`local` backend unchanged** — `localBackend` (local.ts) has no submission-specific logic; it routes `'submissions'` scope through the general `documentStore` (same as `'doc'`). Submission rows synthesized locally always carry `status: 'pending'` (forced in `AppState.proposeSubmission`). The synthetic TM on local is a manager, so the `/submissions` inbox is accessible. No SDK or Supabase import is present in `local.ts`.
- **Overlay bundle strips `userKey` + `submissions` before cloud save** — `supabase.ts:241–244` destructures and voids both before the upsert. Per-user state doesn't overwrite the shared overlay row.
