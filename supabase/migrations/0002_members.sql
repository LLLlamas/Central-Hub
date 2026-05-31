-- Central-Hub — shared tour + role-gated membership (Milestone: multi-user onboarding)
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query), or via
-- CLI `supabase db push`. Builds ON TOP of supabase/schema.sql (the JSONB-blob
-- `tours` + `overlays` starter) — run schema.sql FIRST, then this.
--
-- WHAT THIS CHANGES vs schema.sql (Phase A was owner-only, one tour per account):
--   * one SHARED tours row per tour, readable by active members, writable by managers;
--   * a new `tour_members` table carrying role + group + status, EMAIL-SEEDABLE so
--     a manager can grant access before the person has ever logged in;
--   * `overlays` becomes tour-shared (manager-authored state identical for everyone)
--     instead of per-user — only the client-side viewer choice (`userKey`) stays per-user;
--   * tour-scoped PDF storage RLS (read = active member, write = manager).
--
-- The whole script is RE-RUNNABLE: every policy / trigger / function is dropped
-- (or `create or replace`d) before being created, mirroring the fix in schema.sql.
-- Postgres has no `create policy if not exists`, hence the explicit drops.
--
-- ░░ PRIVACY NOTE (accepted for this milestone) ░░
-- Privacy BETWEEN active members is UI-only: the full Tour JSONB reaches every
-- active member's browser and lib/visibility.ts hides parts in the UI. A determined
-- active member could read hidden fields via devtools. Safe for a TRUSTED-CREW demo.
-- Before untrusted members, do the Phase B decomposition (per-row readable_by RLS)
-- already drafted in supabase/migrations/0001_init.sql.

-- ════════════════════════════════════════════════════════════════════════════
-- tour_members — one row per (tour, person). Email-seedable; uid linked on first login.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists tour_members (
  tour_id            text not null,
  email              text not null,                 -- the seed key; lower()-compared
  user_id            uuid references auth.users,    -- null until claim_membership() links it
  role               text not null default 'crew'
                       check (role in ('owner','manager','production','crew','viewer')),
  status             text not null default 'pending'
                       check (status in ('pending','active','revoked')),
  group_id           text not null default '',
  tag_ids            text[] not null default '{}',
  tour_person_id     text,
  display_name       text not null default '',
  requested_group_id text,                          -- pending user's self-selected guess (a hint for the TM)
  nudged_at          timestamptz,                   -- bumped by "Nudge TM/PM" on the Waiting screen
  joined_at          timestamptz not null default now(),
  primary key (tour_id, email)
);
create index if not exists tour_members_user_idx  on tour_members(user_id);
create index if not exists tour_members_email_idx on tour_members(lower(email));

alter table tour_members enable row level security;

-- ── membership helpers (SECURITY DEFINER so they can read tour_members under RLS) ──
-- `is_active_member` / `is_manager` are the gate every other policy leans on.

create or replace function is_active_member(t text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from tour_members m
    where m.tour_id = t and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function is_manager(t text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from tour_members m
    where m.tour_id = t and m.user_id = auth.uid()
      and m.status = 'active' and m.role in ('owner','manager','production')
  );
$$;

-- Guard: an owner-floor role (owner/manager/production) may never be revoked or
-- deleted. Used by the revoke policies + a BEFORE trigger that hard-blocks the case.
create or replace function trg_protect_owner_roles() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    if old.role in ('owner','manager','production') then
      raise exception 'Cannot delete a TM/PM membership (owner-floor role is protected).';
    end if;
    return old;
  end if;
  -- UPDATE: block revoking an owner-floor row.
  if old.role in ('owner','manager','production')
     and new.status = 'revoked' and old.status <> 'revoked' then
    raise exception 'Cannot revoke a TM/PM membership (owner-floor role is protected).';
  end if;
  return new;
end $$;

drop trigger if exists protect_owner_roles on tour_members;
create trigger protect_owner_roles
  before update or delete on tour_members
  for each row execute function trg_protect_owner_roles();

-- ── tour_members RLS ──
-- Read: active members of the tour see the roster; a user always sees their OWN
--   row (so a pending/revoked user can read their own status to drive the gate).
-- Write: ONLY managers manage the roster (role/status/group). A non-manager has
--   NO direct write path to tour_members — that would be a privilege-escalation
--   vector (they could set their own role='owner'/status='active'). The single
--   legitimate self-write (nudge + requested-group hint) goes through the
--   `request_access()` SECURITY DEFINER RPC below, which can ONLY touch the hint
--   fields / insert a pending crew request — never role or status.
drop policy if exists "members read"        on tour_members;
drop policy if exists "members self read"   on tour_members;
drop policy if exists "members manager write" on tour_members;
drop policy if exists "members self update" on tour_members;  -- removed: escalation risk

create policy "members read" on tour_members for select
  using (is_active_member(tour_id));
create policy "members self read" on tour_members for select
  using (user_id = auth.uid() or lower(email) = lower(auth.jwt()->>'email'));
create policy "members manager write" on tour_members for all
  using (is_manager(tour_id)) with check (is_manager(tour_id));

-- ════════════════════════════════════════════════════════════════════════════
-- tours RLS — shared: active members read, managers write/insert/update/delete.
-- Replaces schema.sql's owner-only policies (drop them by name, then recreate).
-- The manager-insert lets the bootstrap TM create the shared tours row on first login.
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "owner read"   on tours;
drop policy if exists "owner insert" on tours;
drop policy if exists "owner update" on tours;
drop policy if exists "owner delete" on tours;
drop policy if exists "tour read"    on tours;
drop policy if exists "tour insert"  on tours;
drop policy if exists "tour update"  on tours;
drop policy if exists "tour delete"  on tours;

-- Insert: the seeded TM (already an active manager via the bootstrap seed) creates
-- the shared tour. `is_manager(id)` is true because their tour_members row matches
-- the tour id they're about to insert.
create policy "tour read"   on tours for select using (is_active_member(id));
create policy "tour insert" on tours for insert with check (is_manager(id));
create policy "tour update" on tours for update using (is_manager(id));
create policy "tour delete" on tours for delete using (is_manager(id));

-- ════════════════════════════════════════════════════════════════════════════
-- overlays RLS — tour-shared. Active members read; managers write. Keyed by
-- tour_id only (the per-user `userKey` lives client-side, never in this row).
-- The schema.sql PK is (tour_id, user_id); we keep the column but the app writes
-- a single canonical row per tour with a fixed user_id sentinel (the manager's).
-- Members read whatever row exists for their tour.
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "owner read"   on overlays;
drop policy if exists "owner insert" on overlays;
drop policy if exists "owner update" on overlays;
drop policy if exists "owner delete" on overlays;
drop policy if exists "overlay read"    on overlays;
drop policy if exists "overlay write"   on overlays;

create policy "overlay read"  on overlays for select using (is_active_member(tour_id));
create policy "overlay write" on overlays for all
  using (is_manager(tour_id)) with check (is_manager(tour_id));

-- ════════════════════════════════════════════════════════════════════════════
-- claim_membership() — link auth.uid() to the seeded row matching auth.email().
-- SECURITY DEFINER so it can update under RLS; idempotent; links ONLY the
-- caller's own email (a user can never claim another person's membership).
-- Returns the claimed row (or nothing if no seed exists for their email).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function claim_membership() returns tour_members
  language plpgsql security definer set search_path = public as $$
declare
  me_email text := lower(auth.jwt()->>'email');
  me_uid   uuid := auth.uid();
  claimed  tour_members;
begin
  if me_email is null or me_uid is null then
    return null;
  end if;
  update tour_members
     set user_id = me_uid
   where lower(email) = me_email
     and (user_id is null or user_id = me_uid)
  returning * into claimed;
  return claimed;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- list_active_tour_groups() — the active tour's groups {id,name,color}, callable
-- by ANY authenticated user (including pending). Lets the Waiting screen show the
-- group dropdown without exposing the rest of the tour. SECURITY DEFINER reads
-- the tours JSONB. "Active tour" = the most recently updated tours row (single
-- shared tour in this milestone).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function list_active_tour_groups()
  returns table (id text, name text, color text)
  language sql stable security definer set search_path = public as $$
  select g->>'id' as id, g->>'name' as name, g->>'color' as color
  from tours t,
       lateral jsonb_array_elements(coalesce(t.data->'groups', '[]'::jsonb)) g
  where t.id = (select id from tours order by updated_at desc limit 1);
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- request_access() — the ONLY self-write a non-manager can make. Bumps the
-- nudge timestamp + records the requested-group hint, and (for a user the TM
-- hasn't added yet) inserts a PENDING CREW request the managers will see on the
-- App User Permissions screen. SECURITY DEFINER so it can write under RLS, but it
-- forces role='crew'/status='pending' on insert and NEVER changes role/status on
-- an existing row — so it cannot be used to self-escalate. Keyed to the caller's
-- own email; targets the single active (most-recently-updated) shared tour.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function request_access(p_requested_group_id text default null)
  returns void
  language plpgsql security definer set search_path = public as $$
declare
  me_email text := lower(auth.jwt()->>'email');
  me_uid   uuid := auth.uid();
  t_id     text := (select id from tours order by updated_at desc limit 1);
begin
  if me_email is null or me_uid is null or t_id is null then
    return;  -- not signed in, or no shared tour exists yet
  end if;
  insert into tour_members (tour_id, email, user_id, role, status, requested_group_id, nudged_at)
  values (t_id, me_email, me_uid, 'crew', 'pending', p_requested_group_id, now())
  on conflict (tour_id, email) do update
    set requested_group_id = coalesce(excluded.requested_group_id, tour_members.requested_group_id),
        nudged_at          = now(),
        user_id            = coalesce(tour_members.user_id, excluded.user_id);
  -- do-update intentionally NEVER writes role/status: an active member stays
  -- active, a manager stays a manager; only the hint + nudge timestamp move.
end $$;

-- Authenticated users (incl. pending) may call the RPCs above.
grant execute on function claim_membership()         to authenticated;
grant execute on function list_active_tour_groups()  to authenticated;
grant execute on function request_access(text)       to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Storage bucket `tour-pdfs` — RLS CORRECTION (was uid-scoped in schema.sql).
-- Path convention is now TOUR-SCOPED: {tourId}/{scope}/{id}.pdf  (scope = rider|doc).
-- So shared-tour crew can open the TM's rider PDF. Apply these in the Storage
-- policy editor (Dashboard → Storage → tour-pdfs → Policies) — folder[1] = tour id:
--   SELECT (read):  is_active_member( (storage.foldername(name))[1] )
--   INSERT/UPDATE/DELETE (write):  is_manager( (storage.foldername(name))[1] )
-- (Storage policies live in the storage schema and are managed via the dashboard;
--  they are documented here so the convention has one source of truth.)

-- ════════════════════════════════════════════════════════════════════════════
-- BOOTSTRAP SEED — run ONCE, editing the emails + tour id to match your project.
-- This is what makes the first TM/PM land in the app without an invite. They sign
-- up, claim_membership() links their uid, and is_manager() lets them create the
-- shared tours row. Crew get added later from the App User Permissions screen.
--
--   * Use the SAME tour_id the app will create. The supabase backend derives it
--     from the FIRST seeded manager's uid at first login (`tour_${uid}`) UNLESS a
--     shared tour already exists — so the cleanest path is: seed the TM, have them
--     log in once (creates the tour + their tour_person link), then the tour_id is
--     stable. For a fully pre-seeded id, set tour_id to a constant here AND set the
--     app to use it (the backend prefers an existing membership's tour_id).
--   * status 'active' so they skip the Waiting screen. role 'owner'/'manager' for TM,
--     'production' for PM. group_id 'grp_mgmt' (TM) / 'grp_production' (PM).
--
-- insert into tour_members (tour_id, email, role, status, group_id, display_name)
-- values
--   ('REPLACE_WITH_TOUR_ID', 'tm@example.com', 'owner',      'active', 'grp_mgmt',       'Tour Manager'),
--   ('REPLACE_WITH_TOUR_ID', 'pm@example.com', 'production', 'active', 'grp_production', 'Production Manager')
-- on conflict (tour_id, email) do update
--   set role = excluded.role, status = excluded.status,
--       group_id = excluded.group_id, display_name = excluded.display_name;
