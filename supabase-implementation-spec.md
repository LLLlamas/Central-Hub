# Central-Hub — Supabase Backend & Deployment Plan

> **Single source-of-truth doc** for the backend + deployment. We are **full
> Supabase** (Postgres + Auth + Storage + Realtime + RLS). The earlier Firebase
> effort is **retired** — its files were removed; only the backend-agnostic seam
> (`lib/backend/`), the `AuthProvider`, and the auth/membership types survive.
> Read `CLAUDE.md` (working map) and `users-in-prod.md` (original architecture
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
  `SourceTag` kept). "Copy from prior tour" removed.
- Verified: `typecheck` clean · `npm test` 89/89 · `build` succeeds.
- *Build-validated only* — run the migration + bootstrap seed (§8) then test live.

**Still to do:**
- **Run** `0002_members.sql` + the bootstrap seed (§8) against the live project;
  set the tour-scoped storage RLS; smoke-test the role-gate end to end.
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
