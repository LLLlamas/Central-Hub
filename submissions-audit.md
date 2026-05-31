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
