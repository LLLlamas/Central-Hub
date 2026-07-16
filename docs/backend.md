# Backend — multi-user architecture & Supabase implementation spec

> Combined from `users-in-prod.md` (architecture rationale) and `supabase-implementation-spec.md` (the build sheet) during the 2026-07-11 docs reorganization. Part 1 explains *why*; Part 2 is the source-of-truth *how*.

---

# Multi-User Production — Architecture Plan

> **For future agents:** Read this alongside `CLAUDE.md` (the working map of the current prototype). This doc covers what changes when the app grows from a single-browser demo into a real shared product. Don't touch production infrastructure without reading both.

---

## Where the app is today

Pure frontend. React + Vite + TypeScript + Tailwind v4 in `web/`. No server, no database, no real auth. All state lives in two `localStorage` keys:

- `tour-hub:scratch-tour` — the `Tour` object (days, schedule items, personnel, imports)
- `tour-hub:scratch-overlays` — every AppState overlay (visibility edits, locks, conflict resolutions, pending edits, flight passenger resolutions, etc.)

PDFs uploaded by the user are stored in **IndexedDB** as raw bytes (`lib/riderPdfStore.ts`) because Blob URLs are session-scoped. On boot, `AppStateProvider` re-derives the Blob URL from the stored bytes. This is a workaround for the no-backend constraint — it goes away when file storage exists.

Auth is a **role switcher** in the TopBar (Tour Manager / Manuel / Audio / Elsa / Julian / MUA). `AppState.userKey` is a plain string derived from the tour's own personnel. No passwords, no sessions, no tokens.

The app is designed for **one tour manager working alone** in their browser. A second person opening the same URL sees an empty tour.

---

## The good news: architecture is already multi-user shaped

The hard design work is done. The following are production-ready in concept — they just need a real backend to enforce them:

- **ABAC visibility model** (`lib/visibility.ts`) — `persons > tags > groups > default` resolver. Already correct. Currently runs client-side on unfiltered data; needs to move to the API layer so blocked users never receive the raw records.
- **Pending/approval workflow** — non-managers propose edits (section corrections, visibility changes, conflict resolutions); managers approve or reject. Stored in AppState Maps (`pendingEdits`, `pendingConflictResolutions`). The two-person audit trail (`proposedAt` + `resolvedAt/resolvedBy`) is already modelled on the types. Needs real-time notifications to be useful across browsers.
- **UpdateStamp audit trail** — every mutation stamps `MOCK_NOW` + current viewer. In production, `MOCK_NOW` becomes `new Date()` and the viewer is a real user ID.
- **Tour mutators as a clean API surface** — `applyRouteToScratch`, `addRiderImportToScratch`, `addFlightImportToScratch`, `commitFlightImportToScratch`, `addHotelImportToScratch`, etc. These are the write operations. They become API calls with no changes to the callers.

CLAUDE.md notes explicitly: *"When backend lands, replace with TanStack Query + Zustand or similar; the context shape is intentionally stable so callers don't have to change."*

---

## Recommended stack: Supabase

**Why Supabase specifically:**

| Need | Supabase feature |
|---|---|
| Auth (email/password, magic link, OAuth) | Supabase Auth |
| Tour + schedule data | PostgreSQL |
| File storage for rider PDFs, flight PDFs, CSVs | Supabase Storage (S3-compatible) |
| Real-time for pending/approval flows | Supabase Realtime (Postgres changes → websocket) |
| Server-side ABAC enforcement | Row-Level Security (RLS) policies |
| Fast to prototype, free tier | Yes |

The typed tour schema (`web/src/types/index.ts`) maps directly to PostgreSQL tables. RLS policies can enforce the visibility model at the database layer so the API never returns rows a user is blocked from reading.

---

## What changes, in order

### 1. Auth
**Replace the TopBar role-switcher with real accounts.**

- Each `TourPerson` gets a `supabase_user_id` column linking them to a Supabase Auth user.
- On signup/login, Supabase issues a JWT. The frontend sends it with every request.
- `AppState.userKey` becomes the authenticated user's ID from the session.
- `AppState.user` resolves from a DB query: `SELECT * FROM persons WHERE supabase_user_id = $uid`.
- The role-switcher (demo tool) is gated behind a dev flag or removed entirely in production.

Files to touch: `state/AppState.tsx` (swap `userKey` derivation), `components/layout/TopBar.tsx` (replace switcher with auth UI), `main.tsx` (wrap with Supabase session provider).

### 2. Server-side tour storage
**Move the two localStorage keys to the database.**

Core tables needed (derived from `web/src/types/index.ts`):

```
tours           — id, name, artist, created_by, created_at
days            — id, tour_id, date, type, venue_id, ...
schedule_items  — id, day_id, type, start_time, end_time, title, ...
persons         — id, tour_id, supabase_user_id, name, role, group_id, ...
groups          — id, tour_id, name, ...
rider_imports   — id, tour_id, uploaded_by, uploaded_at, ...
rider_sections  — id, import_id, type, title, freeText, ...
flight_imports  — id, tour_id, ...
flights         — id, import_id, ...
hotel_imports   — id, tour_id, ...
hotels          — id, import_id, day_id, ...
visibility_edits        — id, item_id, item_type, patch (jsonb), edited_by, edited_at
pending_edits           — id, item_id, item_type, patch (jsonb), proposed_by, proposed_at
resolved_conflicts      — id, conflict_id, chosen_value, resolved_by, resolved_at
```

`scratchStorage.ts` and `overlayStorage.ts` are replaced by Supabase client calls. The AppState mutators become thin wrappers: call the API, then update local React state (or let TanStack Query handle cache invalidation).

Files to touch: `lib/scratchStorage.ts`, `lib/overlayStorage.ts`, `state/AppState.tsx` (all mutators + query helpers).

### 3. PDF and file storage
**Replace IndexedDB with Supabase Storage.**

Currently: user uploads a PDF → `pdfParser.ts` parses it → raw bytes go to IndexedDB → Blob URL re-derived on boot.

In production:
- Upload the raw file to Supabase Storage bucket (`rider-pdfs/{tour_id}/{import_id}.pdf`).
- Store the storage path on the `rider_imports` row.
- Serve back to the client as a signed URL (time-limited, per-user).
- `lib/riderPdfStore.ts` (the IndexedDB layer) is deleted.
- The boot-time rehydration effect in `AppStateProvider` becomes a signed URL fetch.

Same pattern for flight confirmation PDFs and route CSVs.

Files to touch: `lib/riderPdfStore.ts` (delete), `state/AppState.tsx` (remove boot rehydration effect), `lib/pdfParser.ts` (accept URL instead of File object where needed).

### 4. Real-time sync
**Critical for the pending/approval UX.**

The pending/approval workflows (section edits, visibility proposals, conflict resolutions) are designed as async two-person flows. Without real-time, the tour manager has to manually refresh to see a crew member's proposal. With Supabase Realtime:

- Subscribe to `pending_edits` table changes filtered by `tour_id`.
- When a new row appears, AppState updates and the TM sees an amber dot immediately.
- Same for `pending_conflict_resolutions`.

This is a small addition on top of the database work — Supabase Realtime is a websocket subscription on a Postgres change feed. The existing pending/approval UI in `RiderIngest.tsx` and `ConflictFeed.tsx` needs no visual changes.

### 5. Server-side ABAC enforcement
**Required before shipping to real users.**

Currently `lib/visibility.ts` runs in the browser on the full unfiltered tour. A blocked user can open DevTools and read everything.

In production, RLS policies on the `schedule_items`, `rider_sections`, etc. tables check the authenticated user's `group_id` against the item's `visibility` column before returning rows. The client-side resolver in `lib/visibility.ts` stays as a UI-layer filter (for rendering), but it's no longer the security boundary.

---

## Multi-tour support

The current app is one tour per browser. In production, the sidebar gets a tour picker and users belong to one or more tours. The `AppState.tour` becomes the *selected* tour from a list. This is additive — no current code needs to change, just the boot flow and nav.

---

## Migration path for a future agent

Start here, in this order:

1. **Set up Supabase project** — create the tables above, enable Auth, create a Storage bucket.
2. **Install Supabase client** — `npm install @supabase/supabase-js` in `web/`.
3. **Wire auth** — replace the TopBar switcher with a real login/signup form. Gate the app behind a session check in `main.tsx`. This is self-contained and unblocks everything else.
4. **Migrate AppState reads** — replace `loadScratchTour()` + `loadScratchOverlays()` with a `useQuery` that fetches the tour from Supabase. The component tree doesn't change.
5. **Migrate AppState writes** — each mutator (`applyRouteToScratch`, etc.) gets a `supabase.from(...).upsert(...)` call. Persist to DB, then update local state.
6. **Migrate file uploads** — in the ingest dropzones (`FlightIngest.tsx`, `RiderIngest.tsx`, `HotelImportSection`), upload to Supabase Storage before (or alongside) parsing. Store the path on the import record.
7. **Add Realtime subscriptions** — subscribe to `pending_edits` and `pending_conflict_resolutions` in `AppStateProvider`. Merge incoming rows into the existing Maps.
8. **Add RLS policies** — once the data model is stable, write RLS policies that mirror `lib/visibility.ts`. Audit: compare client-side filter output vs DB output on the same tour.

**Do not attempt steps 4–8 before step 3.** Auth is the load-bearing foundation; without it, user IDs don't exist and the DB schema can't be wired correctly.

---

## Will users be able to install it on their phone?

**Yes, without an App Store.** This app can be shipped as a **Progressive Web App (PWA)**. Because it's a Vite app, adding PWA support takes about 30 minutes:

1. Install `vite-plugin-pwa` (`npm install -D vite-plugin-pwa`).
2. Add a `manifest.json` (app name, icons, theme color, `display: "standalone"`).
3. Register a service worker (the plugin generates one).

Once deployed to any HTTPS host (Vercel, Netlify, etc.):
- **iPhone:** Safari → Share → "Add to Home Screen" → installs as a full-screen app icon, no App Store.
- **Android:** Chrome shows an "Install app" banner automatically, or the user can do it from the browser menu.

With Supabase Auth wired, users open the installed app → see a login screen → sign up with email → land in their tour. The experience is indistinguishable from a native app for a non-technical user.

**Caveats:**
- PWAs on iOS have some limitations (no push notifications without a native wrapper, background sync is limited). For tour management — primarily a scheduling and reference tool — these don't matter.
- Offline support: the app shell loads offline, but tour data requires a connection. That's acceptable for now; a future offline-first pass with service-worker caching would change this.
- If the app ever needs native device features (camera for rider photos, biometric auth), a React Native wrapper (Expo) is the natural next step — but the web app comes first.

---

## Summary for a future agent

The prototype is feature-complete for a single user. The gaps are entirely infrastructure:

| Gap | Solution | Effort |
|---|---|---|
| Real auth | Supabase Auth | Low |
| Shared tour data | Supabase PostgreSQL + TanStack Query | Medium |
| File storage | Supabase Storage | Low |
| Real-time approval flows | Supabase Realtime | Low (once DB is up) |
| Server-side access control | Supabase RLS | Medium |
| Phone install | vite-plugin-pwa | Low |

No UI rebuilds required. The data model, visibility logic, and pending/approval workflows are already production-shaped. The work is plumbing, not design.

---

# Central-Hub — Supabase Backend & Deployment Plan

> **Single source-of-truth doc** for the backend + deployment. We are **full
> Supabase** (Postgres + Auth + Storage + Realtime + RLS). The earlier Firebase
> effort is **retired** — its files were removed; only the backend-agnostic seam
> (`lib/backend/`), the `AuthProvider`, and the auth/membership types survive.
> Read `CLAUDE.md` (working map) and Part 1 above (original architecture
> rationale) alongside this.

**User mandate:** real **multi-user + live updates**, secure, with information
**private as needed** (ABAC enforced server-side). Easy to use, fast, structured.
First showing can be a no-login sandbox, but accounts + sharing are the goal.

---

## Status (updated 2026-05-30)

**Done (by the Supabase agent — audited):**
- `@supabase/supabase-js` installed; Firebase fully removed (deps, rules, functions, docs).
- `lib/supabase/client.ts` — lazy, env-gated client (`VITE_SUPABASE_URL` + `_ANON_KEY`); safe to import unconfigured.
- `lib/supabase/auth.ts` — `signInWithGoogle` (OAuth), `sendSignInLink` (email OTP), `signOut`, `onAuthChange`.
- `lib/backend/{types,index,local,supabase}.ts` — backend abstraction; `index.ts` selects `local|supabase` via `VITE_BACKEND` (default `local`). `local.ts` wraps the existing localStorage/IndexedDB modules verbatim.
- `supabase/schema.sql` — **JSONB-blob** starter schema (`tours` + `overlays`, owner-only RLS).
- Types: `MemberRole`, `Membership`, `UserProfile`, `Invite`.
- App is green on `local`: `typecheck` + `npm test` (79) + `build` all pass; behavior unchanged.

**Phase A — DONE & verified (2026-05-30).** Real auth + per-user cloud sync:
- `lib/backend/supabase.ts` fully implemented (JSONB `tours`/`overlays` + `tour-pdfs`
  Storage; lazy SDK; no-ops when signed out; reuses `stripForPersistence`).
- `AuthProvider` mounted (`main.tsx` → `AuthGate` → `AppStateProvider`); `LoginScreen`
  (email magic-link + Google) + spinner gate; TopBar sign-out (supabase only).
- `AppState` boot/persist routed through `backend`, gated so **`local` is byte-identical**
  (synthetic user, no gate, sync localStorage). Supabase writes debounced ~500ms.
- **Bug caught in audit + fixed:** each account now gets a **per-user tour id**
  (`tour_${uid}`) at seed/reset — the constant `SCRATCH_TOUR_ID` would have collided
  on the `tours` PK (2nd account's upsert hits the 1st's row, RLS denies).
- Verified: `typecheck` clean · `npm test` 89/89 · `build` succeeds (SDK code-split).
- *Build-validated only* — needs testing against the live project (see §8 manual steps).

**Shared tour + role-gated onboarding — DONE & build-validated (this milestone).**
One shared tour per tour; crew join filtered to their role; nobody reaches home
without an assigned role:
- `supabase/migrations/0002_members.sql` (new): `tour_members` (email-seedable,
  role+status), `is_active_member`/`is_manager`, shared `tours`/`overlays` RLS,
  `claim_membership()` + `list_active_tour_groups()` RPCs, owner-floor protection
  trigger, tour-scoped storage RLS. **Re-runnable** (drop-if-exists everywhere).
- `lib/backend/supabase.ts`: loads the **shared** tour by membership tour_id;
  member CRUD (`listMembers`/`setMemberRole`/`revokeMember`/`addMemberByEmail`/
  `nudge`) + `claimMembership`/`getMyMembership`/`listActiveTourGroups`;
  **tour-scoped** PDF storage `{tourId}/{scope}/{id}.pdf`; shared overlays (userKey
  stripped). `AuthProvider` resolves membership; `AuthGate` → `WaitingForAccess`
  until active. `/access` `AppUserPermissions` manager screen. `local` byte-identical.
- **Mock provenance removed** (`MockTag`/`MockBadge`/`DataSourcesPanel` → null;
  `SourceTag` kept). "Copy from prior tour" removed. (Dated status entry — a
  later phase deleted these components entirely rather than null'ing them; see
  CLAUDE.md's "Provenance system" for the current end-state.)
- Verified: `typecheck` clean · `npm test` 89/89 · `build` succeeds.
- *Build-validated only* — run the migration + bootstrap seed (§8) then test live.

**Crew document submissions — DONE & build-validated (Milestone 2).** Crew
contribute documents without being able to silently change the tour:
- `supabase/migrations/0003_submissions.sql` (new): `submissions` table; RLS
  read = own (`user_id=auth.uid()`) OR `is_manager`, update = managers only,
  no delete; `propose_submission()` SECURITY DEFINER RPC is the ONLY crew write
  (forces `status='pending'` + own uid/email — no self-approve/escalate); storage
  policies documented for `{tourId}/submissions/{uid}/{id}.pdf` (read = manager OR
  own-uid folder, write = own-uid folder). **Re-runnable** (drop-if-exists).
- Backend seam: `proposeSubmission`/`listSubmissions`/`approveSubmission`/
  `rejectSubmission` + `savePdf` scope `'submissions'`. AppState: `submissions`,
  `proposeSubmission`, `approve/rejectSubmission`, `loadSubmissionFileUrl`,
  `addDocument` (+ local overlay persistence; all gated on `isSupabase`).
- UI: `/me` `MyTravelInfo` (all members) + `/submissions` `SubmissionsInbox`
  (manager-only). `/ingest/flights` + `/ingest/riders` now manager-gated (crew
  contribute via `/me`). Nav wired into Sidebar/More/Cmd+K (manager-gated).
- Approve attaches the file as a tour `Document`; flight/hotel types route through
  the existing parse→duplicate→merge→commit / hotel-import path so the day sheet
  updates. `local` byte-identical (synthetic TM sees `/me` + an empty inbox).
- Verified: `typecheck` clean · `npm test` 89/89 · `build` succeeds.
- *Build-validated only* — run `0003_submissions.sql` + its storage policies (§8) then test live.

**Multi-tour switching — DONE & build-validated (this milestone).** A caller can
now hold an active membership in more than one tour and switch between them
from My Shows; see "Multi-tour on supabase" below for the full detail. No
migration file — `tour_members`'s existing `(tour_id, email)` PK already
supported it. Tour *creation* on supabase stays out of scope (unchanged).
Verified: `typecheck` clean · `npx vitest run` 193/193.

**Still to do:**
- **Run** `0002_members.sql` + `0003_submissions.sql` + the bootstrap seed (§8)
  against the live project; set the tour-scoped + submission storage RLS;
  smoke-test the role-gate + submission approve/reject end to end, and (new)
  seed a second `tour_members` row for one email across two tour ids to
  exercise the switcher against a live project.
- **PWA** (`vite-plugin-pwa` + manifest/icons) for "Add to Home Screen".
- **Phase B** — server-side per-row privacy: run the decomposed `migrations/0001_init.sql`,
  switch the backend to assemble from typed tables + realtime, RLS-enforced ABAC.
  (Current privacy between active members is **UI-only** — trusted-crew demo only.)
- **Phase C** — hardening (RLS parity test, signed-URL PDF privacy, PII/retention).

---

## 1. Architecture seam (reused, keep stable)

`state/AppState.tsx` persists through one interface (`lib/backend/types.ts` →
`Backend`): `subscribeTour` / `saveTour` / `loadOverlays` / `saveOverlays` /
`loadPdf` / `savePdf` / `deletePdf` / `clearAll`. `local` wraps today's storage;
`supabase` is the new impl. **Components never change** — they call `useApp()`.
The whole migration happens inside `backend` + `AppState`'s boot/persist effects.

The `local` backend stays the default + offline path. `supabase` activates only
when `VITE_BACKEND=supabase` and config is present. Keep it that way so the app
never hard-depends on a live project at build time and the static demo (§A) works.

---

## 2. The core decision: JSONB blob vs decomposed + RLS

The agent's `schema.sql` stores the whole `Tour` as one JSONB row with
**owner-only** RLS. That is **cross-device sync for a single user** — it does NOT
satisfy the mandate:
- A non-owner can't read the tour at all; loosen RLS to let members read and they
  get the **entire blob** — every schedule item, all travel, all hotels — defeating
  per-item privacy.
- Realtime on a single fat row is coarse (every change re-pushes the whole tour).

**Target architecture = decomposed tables + per-row RLS enforcing ABAC.** This is
Postgres's sweet spot and the clean analog of the Firebase `readableBy` design.

### How RLS enforces the ABAC visibility model

Each sensitive row (`schedule_items`, `travel`, `hotels`, `tasks`, `documents`)
carries its `visibility` JSONB **and** a denormalized `readable_by uuid[]` column.

- A **trigger** maintains `readable_by`: it calls `compute_readable_by(visibility,
  tour_id)` — a SQL function that reads `tour_members` and applies the resolver
  precedence (`persons > tags > groups > default`, level `>= 'sees'`). This is the
  SQL twin of `lib/access.ts computeReadableBy` / `lib/visibility.ts`. Recompute
  fires on (a) the row's visibility changing, (b) any `tour_members` change
  (recompute all rows in that tour).
- **RLS read policy:** `auth.uid() = ANY(readable_by)`. A GIN index on `readable_by`
  makes it fast. The DB **never returns a row a user can't see** — privacy is real,
  not UI-filtered.
- **RLS write policy:** managers only (`role in ('owner','manager','production')`
  via a `tour_members` lookup / helper function). `readable_by` is trigger-owned;
  a `BEFORE` trigger overwrites any client-supplied value so it can't be forged.
- **Public-to-members rows** (`days`, `personnel`, `groups`, venue/contact data —
  "public to anyone holding the sheet" per CLAUDE.md) skip `readable_by` and use a
  plain `is_member(tour_id)` read policy.

`lib/visibility.ts` stays as the **UI-layer** filter (rendering), no longer the
security boundary. The two must agree — see the parity test in §7.

> **Why a SQL function + trigger (not pure-inline RLS):** evaluating
> most-specific-wins per row on every query is doable but slow and verbose in a
> policy. Denormalizing to `readable_by` keeps reads index-fast and centralizes the
> logic in one function — same reasoning that drove the Firebase `readableBy` choice.

---

## 3. Target schema (decomposed)

Run via Supabase SQL editor / migrations. (Replaces the JSONB `schema.sql`; keep
that only for the optional Phase-A quick win, §6.)

```
auth.users                              -- Supabase-managed
profiles            (uid pk → auth.users, email, display_name, photo_url, default_tour_id)
tours               (id pk, owner_uid, name, artist_name, status, start_date, end_date,
                     legs jsonb, groups jsonb, group_tags jsonb, visibility_defaults jsonb, updated_at)
tour_members        (tour_id, uid → auth.users, role, group_id, tag_ids text[],
                     tour_person_id, display_name, joined_at, pk (tour_id, uid))
invites             (id pk, tour_id, email, role, group_id, tag_ids text[], invited_by, status, created_at)
days                (id pk, tour_id, date, day_type, city, country, venue_id, published, last_updated jsonb, ...)
personnel           (id pk, tour_id, person jsonb, role, group_id, tag_ids text[], ...)
schedule_items      (id pk, tour_id, day_id, type, title, start_time, end_time, location, notes,
                     visibility jsonb, readable_by uuid[], ...)
travel              (id pk, tour_id, day_id, ..., visibility jsonb, readable_by uuid[])
hotels              (id pk, tour_id, day_id, ..., visibility jsonb, readable_by uuid[])
tasks               (id pk, tour_id, day_id, ..., visibility jsonb, readable_by uuid[])
documents           (id pk, tour_id, day_id, ..., visibility jsonb, readable_by uuid[])
rider_imports       (id pk, tour_id, filename, sections jsonb, pdf_path, uploaded_by, uploaded_at, revision, ...)
flight_imports      (id pk, tour_id, ... jsonb payload)
conflicts           (id pk, tour_id, ... , resolution jsonb)
gear_items          (id pk, tour_id, ...)
history             (id pk, tour_id, kind, payload jsonb, resolved_at jsonb)   -- append-only audit
```

Notes:
- Small tour-wide collections (`legs`, `groups`, `group_tags`,
  `visibility_defaults`) stay as JSONB **on the `tours` row** (not their own tables).
- `rider_imports.sections` stays JSONB (structured, well under any limit). PDF bytes
  → Storage; `plots[].dataUrl` + `pdfObjectUrl` are **never** persisted (re-derived
  client-side, same strip logic as `scratchStorage`).
- `history` is **append-only** (insert-only RLS; no update/delete).
- `tour_members.role` (the enum) is for RLS + UI labels only; **`group_id` is the
  ABAC authority** (matches `lib/visibility.ts`, which never reads `role`). The
  `managerView` check stays keyed on `group_id` (`grp_mgmt`/`grp_production`).

### RLS helpers (illustrative SQL)

```sql
-- membership / role helpers (SECURITY DEFINER, search_path locked)
create or replace function is_member(t text) returns boolean language sql stable as $$
  select exists(select 1 from tour_members m where m.tour_id = t and m.uid = auth.uid());
$$;
create or replace function is_manager(t text) returns boolean language sql stable as $$
  select exists(select 1 from tour_members m
    where m.tour_id = t and m.uid = auth.uid()
      and m.role in ('owner','manager','production'));
$$;

-- ABAC resolver: uids whose effective level on `vis` is >= 'sees'
create or replace function compute_readable_by(vis jsonb, t text) returns uuid[] language sql stable as $$
  select coalesce(array_agg(m.uid), '{}')
  from tour_members m
  where (
    -- most-specific-wins: persons > tags > groups > default
    coalesce(
      vis->'persons'->>m.tour_person_id,
      (select vis->'tags'->>tag from unnest(m.tag_ids) tag where vis->'tags'->>tag is not null limit 1),
      vis->'groups'->>m.group_id,
      vis->>'default'
    ) in ('sees','owns')
  );
$$;

-- trigger: keep readable_by in sync on the row (BEFORE so clients can't forge it)
create or replace function trg_set_readable_by() returns trigger language plpgsql as $$
begin
  new.readable_by := compute_readable_by(new.visibility, new.tour_id);
  return new;
end $$;
-- attach BEFORE INSERT OR UPDATE on each sensitive table.
-- plus an AFTER trigger on tour_members that recomputes readable_by for every
-- sensitive row in the affected tour (membership fan-out).

-- example policies for schedule_items
alter table schedule_items enable row level security;
create policy "member reads visible" on schedule_items for select
  using (is_member(tour_id) and auth.uid() = any(readable_by));
create policy "manager writes" on schedule_items for all
  using (is_manager(tour_id)) with check (is_manager(tour_id));
```

(Repeat the sensitive-table pattern for `travel`/`hotels`/`tasks`/`documents`;
`days`/`personnel` get `using (is_member(tour_id))` read + `is_manager` write;
`history` insert-only; `tour_members` readable by members, writable by managers;
`invites` create gated to managers of `tour_id`, accept gated to email match +
`pending → accepted` only.)

---

## 4. Auth & membership

- **Providers:** Email OTP / magic-link (gentle for band/crew) + Google OAuth — both
  already wired in `lib/supabase/auth.ts`. Configure redirect URLs in the dashboard.
- On first sign-in, upsert `profiles`. A `tour_members` row makes you part of a tour.
- **Invite flow:** a manager creates an `invites` row (email + role + group + tags);
  the invitee signs in, an Edge Function (or a `SECURITY DEFINER` RPC) verifies the
  email match and `pending` status, then inserts `tour_members` and links a
  placeholder `personnel` row. The membership trigger fans out `readable_by`.
- **`CurrentUser`** is derived from the signed-in user's `tour_members` row
  (`tourPersonId, name, role, groupId, tagIds`) so `lib/visibility.ts` + `managerView`
  work unchanged. The TopBar role-switcher becomes a **manager-only "preview as"
  dev tool** behind `managerView` (don't delete — it's the killer demo), gated off
  for non-managers.

---

## 5. File storage, realtime, PWA

- **Storage:** one private bucket `tour-pdfs`, path `{tourId}/{scope}/{id}.pdf`
  (`scope = rider|doc`). RLS on the bucket via `is_member(tourId)` read /
  `is_manager` write (path's first segment = tourId). `lib/backend/supabase.ts`
  `savePdf/loadPdf` upload/sign URLs; `lib/riderPdfStore.ts` (IndexedDB) becomes the
  `local`-only path. `RiderImport.pdfObjectUrl` resolves to a signed URL on `supabase`.
- **Realtime (the "live updates" requirement):** subscribe via
  `supabase.channel(...).on('postgres_changes', { schema:'public', filter:'tour_id=eq.<id>' })`
  for the decomposed tables. `subscribeTour` assembles the `Tour` from the tables and
  pushes updates into AppState on any change. Pending/approval rows (`history` /
  membership) drive the existing amber-dot UI with no visual changes.
- **PWA (phone install, no app store):** `vite-plugin-pwa` + `manifest.json` +
  icons → "Add to Home Screen" on iOS/Android. ~30 min; do after auth lands.

---

## 6. Phasing (each phase independently shippable; app stays green on `local`)

- **Phase A — Auth + cloud sync (single-user), quick win.** Mount `AuthProvider` in
  `main.tsx`; add a login screen + session gate; implement `lib/backend/supabase.ts`
  against the **existing JSONB `tours`/`overlays`** tables (small, ~50 lines); PDFs →
  Storage. Result: real login, cross-device sync, PWA-installable demo. NOT
  multi-user/private yet. Low throwaway (only the JSONB read/write glue is replaced
  in B). **This is the fastest path to an accounts-based demo.**
- **Phase B — Multi-user + live + privacy (the mandate).** Decompose to §3 schema +
  RLS + triggers; `subscribeTour` assembles from tables + realtime; members/invites;
  the role-switcher becomes real identity. RLS enforces ABAC. This is the big one.
- **Phase C — Hardening.** RLS parity tests (client `resolveVisibility` vs DB rows),
  rate limits, PII/retention + delete-my-data, budget/usage alerts, App-layer signed
  URLs for fine-grained PDF privacy.

Decide up front: **do A→B, or go straight to B?** A gives a demoable accounts build
in days and de-risks auth; B is where multi-user/live actually lands. Recommended:
**A then B** (A's auth/storage/PWA all carry forward).

### Files to touch
- `state/AppState.tsx` — boot/persist effects route through `backend`; on `supabase`,
  `subscribeTour` drives `tour` from snapshots; `user`/`allUsers` derive from auth +
  `tour_members`. (See the §7b-style hardening below — do it first.)
- `main.tsx` — mount `AuthProvider` above `AppStateProvider`; session gate.
- `lib/backend/supabase.ts` — implement all methods (A: JSONB; B: decomposed).
- `components/layout/TopBar.tsx` — auth UI; role-switcher → manager-only preview.
- `lib/riderPdfStore.ts` / `documentStore.ts` — `local`-only; Storage on `supabase`.
- New: login screen, `supabase/migrations/*.sql` (decomposed schema + RLS + triggers),
  `manifest.json` + PWA config.

### Pre-migration hardening (do on `local`, no behavior change — makes B clean)
1. **Shard the `saveOverlays` effect** (one effect re-serializes 15 Maps today → one
   DB write per click on `supabase`). Split into ~4–5 effects.
2. **Route the ~14 direct `tour.*` reads** through `useApp()` helpers (worst:
   `ScheduleAndVisibility`) so a per-table subscription drops in cleanly.
3. **Extend `visibilityEdits` to `travel` + `hotels`** (today only schedule items
   layer it) so their `readable_by` reflects manager edits.
4. **Consolidate IndexedDB boilerplate** into `lib/idb.ts`; cap/paginate `history`;
   slim `data/mockTour.ts`; fix `addGearItem` id collision.
   (These mirror the prior audit; `firebase-audit-findings.md` was removed but the
   findings hold — they're storage/state issues independent of the backend choice.)

---

## 7. Security & correctness checklist (production)

- [ ] **RLS on every table; deny-by-default.** No table without explicit policies.
- [ ] Per-item privacy enforced by `readable_by` + trigger (server-owned, un-forgeable
      via `BEFORE` trigger). Reads gated `auth.uid() = ANY(readable_by)`.
- [ ] **RLS parity test:** seed a tour, for each member compare DB-returned rows vs
      `lib/visibility.ts canSee()` over the same data — they must match. (pgTAP or a
      Vitest integration test against a seeded project / local `supabase start`.)
- [ ] `compute_readable_by` / `is_member` / `is_manager` are `SECURITY DEFINER` with
      a **locked `search_path`** (avoid privilege-escalation via search_path).
- [ ] `history` insert-only; audit rows can't be edited/deleted.
- [ ] Invites: manager-gated create; accept only `pending → accepted` by email match.
- [ ] Storage bucket private; RLS by tour membership; signed URLs time-limited.
- [ ] anon key is public by design — **RLS is the guard, not the key.**
- [ ] HTTPS only; redirect URLs allow-listed in the Supabase dashboard.
- [ ] PII: retention + delete-my-data path; pick project **region** for residency.

---

## 8. Manual steps only you can do (Supabase dashboard / CLI)

The code is build-valid without any of this; it's what makes `supabase` actually run.

1. **Create a Supabase project** at supabase.com → New project. ⚠️ **Pick the region**
   for data residency (it can't be changed later) — choose near North America unless
   EU residency is needed.
2. **Project Settings → API:** copy the **Project URL** + **anon public key** into
   `web/.env.local` (copy from `web/.env.example`); set `VITE_BACKEND=supabase` when
   you want to run against it.
3. **Authentication → Providers:** enable **Email** (magic link / OTP) and **Google**
   (needs a Google OAuth client id/secret). **Authentication → URL Configuration:**
   add your dev + prod origins to redirect allow-list.
4. **SQL Editor:** run `supabase/schema.sql` FIRST (creates `tours`/`overlays`),
   THEN `supabase/migrations/0002_members.sql` (shared-tour RLS + `tour_members` +
   RPCs). Both are re-runnable. Or CLI: `npm i -g supabase`, `supabase link`,
   `supabase db push`.
5. **Bootstrap seed (run ONCE):** seed the first TM/PM as **active managers** by
   email so they skip the Waiting screen and can create the shared tour. Edit the
   emails + tour id, then run:
   ```sql
   -- tour_id: the id the app will use for the shared tour. Easiest path: seed the
   -- TM, have them log in once (the app creates tours row id = their membership's
   -- tour_id), then this is stable. To fully pre-pick it, set a constant tour_id
   -- here (e.g. 'tour_shared') — the supabase backend prefers an existing
   -- membership's tour_id when seeding the tours row.
   insert into tour_members (tour_id, email, role, status, group_id, display_name)
   values
     ('REPLACE_WITH_TOUR_ID', 'REPLACE_TM_EMAIL', 'owner',      'active', 'grp_mgmt',       'Tour Manager'),
     ('REPLACE_WITH_TOUR_ID', 'REPLACE_PM_EMAIL', 'production', 'active', 'grp_production', 'Production Manager')
   on conflict (tour_id, email) do update
     set role = excluded.role, status = excluded.status,
         group_id = excluded.group_id, display_name = excluded.display_name;
   ```
   Crew don't need a seed — a manager adds them by email from the `/access` screen.
6. **Storage → New bucket:** `tour-pdfs`, **private**, ~50 MB limit. ⚠️ Use the
   **tour-scoped** RLS (folder[1] = tour id), not the old uid-scoped policy:
   - SELECT (read): `is_active_member( (storage.foldername(name))[1] )`
   - INSERT/UPDATE/DELETE (write): `is_manager( (storage.foldername(name))[1] )`
7. **Realtime (optional but recommended):** Database → Replication → enable for
   `public.tours` so crew see live updates. The initial read works without it.
8. **(Deploy → see §A.)** Cloudflare Pages (or any static SPA host with a rewrite).

Tell me the **region** (the one irreversible choice) and I'll proceed; everything
else I can scaffold now and you fill in keys when ready.

---

## §A. Deploy to Cloudflare Pages (static SPA + Supabase backend)

The static app is hosted on **Cloudflare Pages**; Supabase is the backend. Files
already in the repo: `web/public/_redirects` (`/* /index.html 200` — SPA deep-link
rewrite so `/calendar/2025-09-25`, `/access`, etc. don't 404 on refresh; Vite copies
`public/` into `dist/`) and `web/.nvmrc` (`20`).

**Env vars are build-time** — Vite inlines `import.meta.env.VITE_*` at build, so they
must be set in the Pages **project settings**, not at runtime.

1. **Connect the Git repo** in Cloudflare → Pages → Create → connect to Git.
2. **Build config:** Root directory **`web`**, Build command **`npm run build`**,
   Output directory **`dist`**. (`.nvmrc` pins Node 20.)
3. **Environment variables** (Production **and** Preview):
   `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL=…`, `VITE_SUPABASE_ANON_KEY=…`.
   (The anon key in the bundle is expected/safe — RLS is the guard.)
4. **First deploy** yields `https://<project>.pages.dev`.
5. **Allow-list the origin** — `lib/supabase/auth.ts` uses `window.location.origin`
   for `redirectTo`, so add the `.pages.dev` URL (and any custom domain) to:
   - Supabase → Authentication → **URL Configuration** (Site URL + redirect allow-list);
   - the **Google OAuth client** (Authorized JavaScript origins + redirect URIs).
6. **Verify:** deep-link refresh works (e.g. open `/access` directly); login
   succeeds and redirects back to the deployed origin.

CLI alternative: `npm run build && npx wrangler pages deploy web/dist`.

**Trusted-crew demo only:** with this milestone's client-side privacy, treat the
deployed URL as a trusted-crew demo (matches the caveat in CLAUDE.md).

---

# Part 3 — Current implementation state (moved verbatim from CLAUDE.md, 2026-07-11)


All persistence routes through one interface, `lib/backend/types.ts` → `Backend`
(`subscribeTour`/`saveTour`/`loadOverlays`/`saveOverlays`/`loadPdf`/`savePdf`/
`deletePdf`/`clearAll`, plus optional **membership** methods — see below).
`lib/backend/index.ts` selects the impl from `VITE_BACKEND` (default **`local`**):
`local.ts` wraps today's localStorage + IndexedDB modules verbatim; `supabase.ts`
persists the **shared** `Tour` + shared overlays as JSONB rows (`tours`/`overlays`)
and PDF bytes to the `tour-pdfs` Storage bucket. **Storage is now tour-scoped:**
path `{tourId}/{scope}/{id}.pdf` (`scope = rider|doc`) so shared-tour crew can open
the TM's rider PDF — the supabase backend caches the active tour id from
`subscribeTour` and threads it into `savePdf/loadPdf`. See
`supabase-implementation-spec.md` + `supabase/schema.sql` + the membership
migration `supabase/migrations/0002_members.sql`. **The `local` path is
byte-for-byte unchanged** — every supabase behavior is gated on
`BACKEND_KIND === 'supabase'`, and the Supabase SDK only loads via dynamic import.

### Shared tour + role-gated membership (`tour_members`)

The supabase model is **one shared tour per tour**, set up by the TM/PM, that crew
join and view filtered to their role — but a caller can hold an **active
membership in more than one tour** and switch between them (see "Multi-tour on
supabase" below). Implemented in `0002_members.sql`:
- **`tour_members`** (PK `(tour_id, email)`) carries `role`, `status`
  (`pending|active|revoked`), `group_id`, `tour_person_id`, `requested_group_id`,
  `nudged_at`. **Email-seedable**: a manager grants access by email before the
  person ever logs in. Helpers `is_active_member(tour_id)` / `is_manager(tour_id)`
  back every RLS policy. `tours`/`overlays` RLS = active members read, managers write.
- **Bootstrap by email, no Edge Function:** pre-seed `tour_members` rows (TM/PM,
  status active) via the SQL at the bottom of `0002_members.sql`. On login the
  `SECURITY DEFINER` RPC `claim_membership()` links `user_id = auth.uid()` to the
  row matching `auth.email()` (idempotent; links **only the caller's own** email).
  `list_active_tour_groups()` (SECURITY DEFINER, callable by pending users) feeds
  the Waiting screen's group dropdown without exposing the rest of the tour.
- **Auth flow:** `AuthProvider` resolves `membership` + `membershipStatus`
  (`none|pending|active`) after sign-in (claim → getMyMembership). `AuthGate` →
  app when `active`; `WaitingForAccess` (group-guess dropdown + Nudge) when
  `none|pending`. `local` reports a synthetic **active TM** membership, so the gate
  is always open and behavior is unchanged.
- **CurrentUser from membership (supabase):** managers may preview-as via the
  TopBar switcher (like local); **non-managers are pinned** to their membership
  identity (switcher hidden). `AppState` derives this; `isManagerMember` (reuses
  `isOwnerFloorRole` from `lib/access.ts`) also gates the shared tour/overlay
  *writes* so non-managers never attempt a manager-only write.
- **Permissions UI:** `/access` → `AppUserPermissions` (manager-only): roster of
  active+pending+revoked, **assign role+group** (creates a linked `TourPerson` via
  `addTourPerson` if the membership has none — the people↔group↔role↔calendar join),
  **add by email**, **revoke** (status→revoked). **TM/PM cannot be revoked** — the UI
  hides the control AND a DB trigger (`trg_protect_owner_roles`) rejects revoking/
  deleting any owner-floor role. Personnel's edit modal has a manager-only "Remove
  from tour" (`removeTourPerson`); auth revoke lives on `/access`.
- **Overlays are tour-shared** (manager-authored, identical for everyone); only the
  per-user viewer choice (`userKey`) stays client-side and is stripped before the
  shared overlay write.

**⚠️ Client-side privacy caveat (accepted this milestone):** privacy *between active
members* is **UI-only** — the full Tour JSONB reaches every active member's browser
and `lib/visibility.ts` hides parts in the UI, so a determined member could read
hidden fields via devtools. Safe for a **trusted-crew demo**. Before untrusted
members, do the Phase B per-row `readable_by` RLS decomposition already drafted in
`supabase/migrations/0001_init.sql`.

### Multi-tour on supabase

**No schema change was needed.** `tour_members`'s primary key is `(tour_id,
email)`, not `email` alone — one email/uid was already able to hold rows in
several tours; the "one membership tour" behavior was purely a client-side
assumption (three call sites), now removed:
- `Backend.listMyMemberships()` (`lib/backend/supabase.ts`) — every ACTIVE
  membership row for the caller across all tours (two round-trips: `tour_members`
  by `user_id`, then `tours` by the resulting ids for `name`/`artistName` — no
  FK/embed since `tour_id` is a plain text column, not a foreign key into
  `tours`). Returned `Membership[]` carries the tour's `name`/`artistName` in
  two membership-only fields (`tourName`/`artistName`) so the switcher card
  doesn't need a second fetch.
- `supabaseBackend.subscribeTour(tourId, cb)` previously **ignored its `tourId`
  argument** and always loaded "whichever active membership sorts first" —
  harmless when a caller had exactly one, wrong the moment they had two. It now
  confirms the caller is an active member of the *specific* `tourId` passed in
  (falling back to "first active membership" only when `tourId` is null/foreign,
  i.e. the original bootstrap-creates-the-first-tour path).
- `routes/MyShows.tsx`'s `MyShowsSupabaseRedirect` — exactly one active
  membership still redirects straight in (today's fast path, unchanged);
  more than one renders `MembershipSwitcher`, a card list built from
  `Membership[]` (adapted from `MyShowsList`'s card pattern, not `TourSummary[]`
  / `useToursIndex()` — that index is `local`-only).

**Deliberately out of scope:** creating a brand-new shared tour on supabase
(who becomes its TM/PM, billing/tenancy) — `MembershipSwitcher` only switches
between tours the caller is already an active member of; there is no "+ New
show" there. A manager still adds tours (and grants membership into them) via
direct `tour_members` seeding, same as today's bootstrap.

- **AppState wiring:** boot/persist effects route through `backend`. On `local`,
  the synchronous `useState` initializers read localStorage as before. On
  `supabase`, the tour starts as a fresh `createScratchTour()` shell with
  `booting = true`; a cloud-boot effect waits for sign-in, `subscribeTour`s, and
  either `setTour(cloudTour)` + `loadOverlays` or seeds + saves a fresh tour,
  then clears `booting`. Supabase tour/overlay writes are debounced ~500ms.
  `booting` is exposed on `useApp()`; `Layout` shows a spinner until it clears.
  `resetScratchTour` calls `backend.clearAll` on supabase.
- **Auth:** `AuthProvider` (mounted above `AppStateProvider` in `main.tsx`) is a
  synthetic no-op "Tour Manager" on `local`; on `supabase` it subscribes to
  Supabase auth (`lib/supabase/auth.ts` — Google OAuth + email magic-link).
  `AuthGate` (between them) gates only on `supabase`: spinner while `loading` (or
  membership resolving), `LoginScreen` when `signed-out`, `WaitingForAccess` when
  signed-in without an active membership, app when `membershipStatus === 'active'`.
  `local` is never gated. `TopBar` shows the signed-in email + sign-out only on
  `supabase`; the viewer/role-switcher shows for **managers** (preview-as) and is
  hidden/pinned for non-managers.

