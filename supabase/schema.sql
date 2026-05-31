-- Central-Hub Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Phase 2: Tour + overlays stored as JSONB for minimal migration from localStorage.
-- Phase 3 will decompose into subcollections with per-item RLS.

-- ─── tours ────────────────────────────────────────────────────────────────────
-- One row per tour. The full Tour object is stored as JSONB (same shape as
-- localStorage) so AppState needs zero changes to read/write it. Phase 3 will
-- decompose this into typed subcollections for per-item visibility enforcement.

create table if not exists tours (
  id           text primary key,          -- matches Tour.id (e.g. "tour_scratch")
  owner_uid    uuid references auth.users not null,
  data         jsonb not null,            -- the full Tour object (sans Blob URLs + dataUrls)
  updated_at   timestamptz default now()
);

alter table tours enable row level security;

-- Owner can read and write their own tours.
-- drop-if-exists first so this whole script is safe to re-run (Postgres has no
-- `create policy if not exists`).
drop policy if exists "owner read"   on tours;
drop policy if exists "owner insert" on tours;
drop policy if exists "owner update" on tours;
drop policy if exists "owner delete" on tours;
create policy "owner read"   on tours for select using (auth.uid() = owner_uid);
create policy "owner insert" on tours for insert with check (auth.uid() = owner_uid);
create policy "owner update" on tours for update using (auth.uid() = owner_uid);
create policy "owner delete" on tours for delete using (auth.uid() = owner_uid);

-- ─── overlays ─────────────────────────────────────────────────────────────────
-- Per-user overlay bundle (locks, visibility edits, history, gear, userKey).
-- Stored as JSONB, keyed by tour_id + user_id. Mirrors overlayStorage.ts.

create table if not exists overlays (
  tour_id    text not null,
  user_id    uuid references auth.users not null,
  data       jsonb not null,
  updated_at timestamptz default now(),
  primary key (tour_id, user_id)
);

alter table overlays enable row level security;

drop policy if exists "owner read"   on overlays;
drop policy if exists "owner insert" on overlays;
drop policy if exists "owner update" on overlays;
drop policy if exists "owner delete" on overlays;
create policy "owner read"   on overlays for select using (auth.uid() = user_id);
create policy "owner insert" on overlays for insert with check (auth.uid() = user_id);
create policy "owner update" on overlays for update using (auth.uid() = user_id);
create policy "owner delete" on overlays for delete using (auth.uid() = user_id);

-- ─── tour_members (Phase 3) ───────────────────────────────────────────────────
-- Uncomment when adding multi-user / invite flow.
--
-- create table if not exists tour_members (
--   tour_id       text not null,
--   user_id       uuid references auth.users not null,
--   role          text not null,   -- 'owner' | 'manager' | 'production' | 'crew' | 'viewer'
--   group_id      text not null,
--   tag_ids       text[] default '{}',
--   tour_person_id text,
--   display_name  text,
--   joined_at     timestamptz default now(),
--   primary key (tour_id, user_id)
-- );
-- alter table tour_members enable row level security;
-- create policy "members read" on tour_members for select
--   using (auth.uid() = user_id or auth.uid() in (
--     select owner_uid from tours where id = tour_id
--   ));

-- ─── Storage buckets ─────────────────────────────────────────────────────────
-- Create in Dashboard → Storage → New bucket:
--   bucket name: "tour-pdfs"   (private, max file size: 50 MB)
--
-- ⚠️ STORAGE SCOPE CHANGED with migrations/0002_members.sql: from UID-scoped
-- (Phase A) to TOUR-scoped, so shared-tour crew can open the TM's rider PDF.
-- File path convention is now: {tourId}/{scope}/{id}.pdf   (scope = 'rider' | 'doc')
--   — matches lib/backend/supabase.ts pdfPath(), which threads the active tour id.
-- RLS policies for the bucket (folder[1] = tour id):
--   SELECT (read):  is_active_member( (storage.foldername(name))[1] )
--   INSERT/UPDATE/DELETE (write):  is_manager( (storage.foldername(name))[1] )
-- (The Phase A uid-scoped policy `(storage.foldername(name))[1] = auth.uid()::text`
--  is superseded — replace it when applying 0002_members.sql.)
