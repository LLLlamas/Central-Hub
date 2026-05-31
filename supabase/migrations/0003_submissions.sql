-- Central-Hub — crew document submissions (Milestone 2)
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query), or via
-- CLI `supabase db push`. Builds ON TOP of supabase/schema.sql + 0002_members.sql
-- (it reuses the `is_manager(text)` helper defined there) — run those FIRST.
--
-- WHAT THIS ADDS:
--   Crew need to contribute documents (a boarding pass, an updated flight, a set
--   list) WITHOUT being able to silently change the tour. Every contribution lands
--   as a PENDING `submissions` row that only a manager (TM/PM) can approve or reject.
--   On approve, the app attaches the file as a tour Document and — for flight/hotel
--   types — routes it through the existing parse → duplicate → replace/merge → commit
--   path so Travel/Hotel + the day sheet update everywhere.
--
-- SECURITY MODEL (the point of this milestone):
--   * read   = OWN row (user_id = auth.uid()) OR is_manager(tour_id).
--              Crew NEVER see another crew member's submissions.
--   * insert = ONLY via the propose_submission() SECURITY DEFINER RPC, which forces
--              status='pending' + the caller's own email/uid. There is NO direct
--              INSERT policy for crew → no self-approve, no self-escalate (mirrors
--              the request_access() lockdown in 0002_members.sql).
--   * update = managers only (approve/reject + audit columns). No broad self-update
--              policy — a crew member cannot flip their own row to 'approved'.
--   * delete = none (audit trail is permanent).
--
-- The whole script is RE-RUNNABLE: every policy / function is dropped (or
-- `create or replace`d) before being created. Postgres has no
-- `create policy if not exists`, hence the explicit drops.

-- ════════════════════════════════════════════════════════════════════════════
-- submissions — one row per document a member submits for manager review.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists submissions (
  id           text primary key,                 -- client-generated (sub_<uid>_<ts>)
  tour_id      text not null,
  user_id      uuid not null references auth.users,
  email        text not null,                    -- submitter's email (forced to own)
  display_name text not null default '',
  type         text not null default 'document'
                 check (type in ('flight','hotel','document','other')),
  title        text not null default '',
  description  text not null default '',          -- submitter's notes
  status       text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  storage_path text,                              -- {tourId}/submissions/{uid}/{id}.pdf
  filename     text,                              -- original upload filename
  -- audit
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,                       -- set on approve/reject
  reviewed_by  text,                              -- manager display name
  review_note  text                               -- rejection reason / approval note
);
create index if not exists submissions_tour_idx on submissions(tour_id);
create index if not exists submissions_user_idx on submissions(user_id);

alter table submissions enable row level security;

-- ── submissions RLS ──
-- Read: a member always sees their OWN submissions; managers see ALL submissions
--   for their tour (the inbox). Crew cannot read anyone else's row.
-- Update: managers only (approve/reject). There is intentionally NO update policy
--   for the submitter — flipping status='approved' or changing tour_id would be a
--   privilege-escalation vector. The only legitimate crew write is the INSERT,
--   which goes through propose_submission() below (SECURITY DEFINER), never a
--   direct table write.
-- Insert: none for `authenticated` — the RPC owns inserts. (Managers could be
--   given a direct insert, but everything flows through the RPC for uniformity.)
-- Delete: none — submissions are a permanent audit trail.
drop policy if exists "submissions own read"     on submissions;
drop policy if exists "submissions manager read" on submissions;
drop policy if exists "submissions manager update" on submissions;  -- removed: see review_submission()

create policy "submissions own read" on submissions for select
  using (user_id = auth.uid());
create policy "submissions manager read" on submissions for select
  using (is_manager(tour_id));
-- NO direct UPDATE policy: approve/reject flow through review_submission() (below),
-- a SECURITY DEFINER RPC that mutates ONLY status/review columns. A direct manager
-- UPDATE policy would let a manager change user_id/tour_id (column-immutability isn't
-- expressible in a WITH CHECK), so we lock all writes to the RPC.

-- ════════════════════════════════════════════════════════════════════════════
-- propose_submission() — the ONLY crew write. SECURITY DEFINER so it can insert
-- under RLS, but it FORCES status='pending' + the caller's own uid/email — a
-- member can never insert someone else's submission, pre-approve their own, or
-- target another tour. Mirrors request_access() in 0002_members.sql.
-- The target tour must be one the caller is an ACTIVE member of (a pending/
-- revoked user cannot submit). Returns the inserted row.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function propose_submission(
  p_id          text,
  p_tour_id     text,
  p_type        text,
  p_title       text,
  p_description text default '',
  p_storage_path text default null,
  p_filename    text default null
) returns submissions
  language plpgsql security definer set search_path = public as $$
declare
  me_email text := lower(auth.jwt()->>'email');
  me_uid   uuid := auth.uid();
  me_name  text;
  inserted submissions;
begin
  if me_uid is null then
    raise exception 'Not signed in.';
  end if;
  -- Caller must be an ACTIVE member of the target tour.
  if not is_active_member(p_tour_id) then
    raise exception 'Not an active member of this tour.';
  end if;
  if p_type not in ('flight','hotel','document','other') then
    raise exception 'Invalid submission type %', p_type;
  end if;
  select coalesce(display_name, '') into me_name
    from tour_members
    where tour_id = p_tour_id and user_id = me_uid
    limit 1;

  insert into submissions (
    id, tour_id, user_id, email, display_name, type, title, description,
    status, storage_path, filename, submitted_at
  ) values (
    p_id, p_tour_id, me_uid, coalesce(me_email, ''), coalesce(me_name, ''),
    p_type, coalesce(p_title, ''), coalesce(p_description, ''),
    'pending',                               -- FORCED — never caller-supplied
    p_storage_path, p_filename, now()
  )
  on conflict (id) do update set submitted_at = submissions.submitted_at  -- no-op so a retry returns the row (not null)
  returning * into inserted;

  return inserted;
end $$;

-- Authenticated users (active members, enforced inside the function) may call it.
grant execute on function propose_submission(text, text, text, text, text, text, text)
  to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- review_submission() — the ONLY approve/reject path. SECURITY DEFINER so it can
-- update under RLS (there is no direct UPDATE policy). It verifies the caller is a
-- manager of the row's tour and mutates ONLY status + audit columns — never
-- user_id/tour_id/email (so a manager can't be tricked into reassigning a row).
-- reviewed_by is resolved server-side from the caller's JWT (not client-supplied).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function review_submission(
  p_id     text,
  p_status text,
  p_note   text default null
) returns submissions
  language plpgsql security definer set search_path = public as $$
declare
  sub submissions;
begin
  if p_status not in ('approved','rejected') then
    raise exception 'Invalid review status %', p_status;
  end if;
  select * into sub from submissions where id = p_id;
  if sub.id is null then
    raise exception 'Submission not found.';
  end if;
  if not is_manager(sub.tour_id) then
    raise exception 'Only a manager can review submissions.';
  end if;
  update submissions
     set status      = p_status,
         reviewed_at = now(),
         reviewed_by = coalesce(nullif(auth.jwt()->>'name', ''), auth.jwt()->>'email'),
         review_note = p_note
   where id = p_id
   returning * into sub;
  return sub;
end $$;

grant execute on function review_submission(text, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Storage `tour-pdfs` — submission files live under a per-submitter folder so a
-- crew member can write only into their OWN folder, while managers read all.
-- Path convention:  {tourId}/submissions/{uid}/{id}.pdf
--   folder[1] = tour id, folder[2] = 'submissions', folder[3] = submitter uid
-- (lib/backend/supabase.ts savePdf(scope='submissions', id) builds this path,
--  threading the active tour id + the signed-in uid.)
--
-- Apply these in the Storage policy editor (Dashboard → Storage → tour-pdfs →
-- Policies). They sit ALONGSIDE the rider/doc policies from 0002 — the existing
-- read policy `is_active_member(folder[1])` already covers reads of submission
-- files by active members, but to keep crew from reading EACH OTHER's submission
-- PDFs, scope the read to manager-OR-own-folder. Recommended bucket policies:
--
--   -- READ (SELECT): managers see every file; a member sees their own folder.
--   --   Rider/doc files (folder[2] in 'rider','doc') stay readable by any active
--   --   member; submission files (folder[2]='submissions') are gated to own-uid
--   --   or manager.
--   is_manager( (storage.foldername(name))[1] )
--   OR (
--     (storage.foldername(name))[2] = 'submissions'
--     AND (storage.foldername(name))[3] = auth.uid()::text
--   )
--   OR (
--     (storage.foldername(name))[2] <> 'submissions'
--     AND is_active_member( (storage.foldername(name))[1] )
--   )
--
--   -- WRITE (INSERT/UPDATE/DELETE): managers write anywhere in the tour folder;
--   --   a member writes ONLY into their own submissions/{uid} folder.
--   is_manager( (storage.foldername(name))[1] )
--   OR (
--     (storage.foldername(name))[2] = 'submissions'
--     AND (storage.foldername(name))[3] = auth.uid()::text
--     AND is_active_member( (storage.foldername(name))[1] )
--   )
--
-- (Storage policies live in the storage schema and are managed via the dashboard;
--  they are documented here so the path convention has one source of truth.)
