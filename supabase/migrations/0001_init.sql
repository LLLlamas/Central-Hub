-- Central-Hub — decomposed schema + RLS (Phase B target: multi-user, live, private)
-- Run in Supabase SQL Editor, or via CLI: `supabase db push`.
--
-- This REPLACES the JSONB-blob `supabase/schema.sql` for multi-user use. It models
-- the Tour as typed tables and enforces the ABAC visibility model AT THE DATABASE
-- via a denormalized `readable_by uuid[]` maintained by triggers — the DB never
-- returns a row a user can't see. `lib/visibility.ts` stays as the UI filter only.
--
-- FIRST-RUN NOTE: authored offline; validate on first apply and iterate. Column
-- sets favor JSONB for structured payloads (person, sections, passengers) to avoid
-- over-normalizing the prototype — the RLS-relevant columns are first-class.

-- ─── extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ════════════════════════════════════════════════════════════════════════════
-- IDENTITY & TENANCY
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists profiles (
  uid             uuid primary key references auth.users on delete cascade,
  email           text,
  display_name    text not null default '',
  photo_url       text,
  default_tour_id text,
  created_at      timestamptz not null default now()
);

create table if not exists tours (
  id                  text primary key,
  owner_uid           uuid not null references auth.users on delete cascade,
  name                text not null default '',
  artist_name         text not null default '',
  status              text not null default 'announced',
  start_date          date,
  end_date            date,
  legs                jsonb not null default '[]',
  groups              jsonb not null default '[]',
  group_tags          jsonb not null default '[]',
  visibility_defaults jsonb not null default '{}',
  route_import        jsonb,
  hotel_import        jsonb,
  updated_at          timestamptz not null default now()
);

create table if not exists tour_members (
  tour_id        text not null references tours on delete cascade,
  uid            uuid not null references auth.users on delete cascade,
  role           text not null check (role in ('owner','manager','production','crew','viewer')),
  group_id       text not null,
  tag_ids        text[] not null default '{}',
  tour_person_id text,
  display_name   text not null default '',
  joined_at      timestamptz not null default now(),
  primary key (tour_id, uid)
);
create index if not exists tour_members_uid_idx on tour_members(uid);

create table if not exists invites (
  id         uuid primary key default uuid_generate_v4(),
  tour_id    text not null references tours on delete cascade,
  email      text not null,
  role       text not null check (role in ('owner','manager','production','crew','viewer')),
  group_id   text not null,
  tag_ids    text[] not null default '{}',
  invited_by uuid not null references auth.users,
  status     text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now()
);
create index if not exists invites_email_idx on invites(lower(email));

-- ════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS (SECURITY DEFINER, locked search_path)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function is_member(t text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from tour_members m where m.tour_id = t and m.uid = auth.uid());
$$;

create or replace function is_manager(t text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from tour_members m
    where m.tour_id = t and m.uid = auth.uid()
      and m.role in ('owner','manager','production'));
$$;

-- ABAC resolver: uids whose effective level on `vis` is >= 'sees'.
-- Precedence persons > tags > groups > default (mirror of lib/visibility.ts).
create or replace function compute_readable_by(vis jsonb, t text) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(m.uid), '{}'::uuid[])
  from tour_members m
  where coalesce(
    vis->'persons'->>m.tour_person_id,
    (select vis->'tags'->>tag
       from unnest(m.tag_ids) tag
       where vis->'tags'->>tag is not null
       limit 1),
    vis->'groups'->>m.group_id,
    vis->>'default'
  ) in ('sees','owns');
$$;

-- BEFORE trigger: overwrite client-supplied readable_by from the row's visibility.
create or replace function trg_set_readable_by() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  new.readable_by := compute_readable_by(coalesce(new.visibility, '{"default":"blocked"}'::jsonb), new.tour_id);
  return new;
end $$;

-- AFTER trigger on tour_members: membership change → recompute readable_by for
-- every sensitive row in the affected tour (fan-out).
create or replace function trg_members_recompute() returns trigger
  language plpgsql security definer set search_path = public as $$
declare tid text := coalesce(new.tour_id, old.tour_id);
begin
  update schedule_items set visibility = visibility where tour_id = tid;
  update travel         set visibility = visibility where tour_id = tid;
  update hotels         set visibility = visibility where tour_id = tid;
  update tasks          set visibility = visibility where tour_id = tid;
  update documents      set visibility = visibility where tour_id = tid;
  return null;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PUBLIC-TO-MEMBERS COLLECTIONS (membership read, manager write)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists days (
  id           text primary key,
  tour_id      text not null references tours on delete cascade,
  date         date not null,
  day_type     text not null default 'off',
  leg_id       text,
  city         text, country text, venue_id text, notes text,
  published    boolean not null default false,
  last_updated jsonb,
  extra        jsonb not null default '{}'
);
create index if not exists days_tour_date_idx on days(tour_id, date);

create table if not exists personnel (
  id             text primary key,
  tour_id        text not null references tours on delete cascade,
  person         jsonb not null,
  role           text not null default '',
  group_id       text not null default '',
  tag_ids        text[] not null default '{}',
  start_date     date, end_date date,
  is_placeholder boolean not null default false
);
create index if not exists personnel_tour_idx on personnel(tour_id);

create table if not exists rider_imports (
  id          text primary key,
  tour_id     text not null references tours on delete cascade,
  filename    text not null default '',
  sections    jsonb not null default '[]',
  pdf_path    text,                 -- Storage path; bytes never in the DB
  uploaded_by text, uploaded_at timestamptz, revision int not null default 0,
  meta        jsonb not null default '{}'
);
create index if not exists rider_imports_tour_idx on rider_imports(tour_id);

create table if not exists flight_imports (
  id text primary key,
  tour_id text not null references tours on delete cascade,
  payload jsonb not null
);
create index if not exists flight_imports_tour_idx on flight_imports(tour_id);

create table if not exists conflicts (
  id text primary key,
  tour_id text not null references tours on delete cascade,
  payload jsonb not null,
  resolution jsonb
);
create index if not exists conflicts_tour_idx on conflicts(tour_id);

create table if not exists gear_items (
  id text primary key,
  tour_id text not null references tours on delete cascade,
  payload jsonb not null
);
create index if not exists gear_items_tour_idx on gear_items(tour_id);

-- append-only audit log
create table if not exists history (
  id          uuid primary key default uuid_generate_v4(),
  tour_id     text not null references tours on delete cascade,
  kind        text not null,
  payload     jsonb not null,
  resolved_at jsonb
);
create index if not exists history_tour_kind_idx on history(tour_id, kind);

-- ════════════════════════════════════════════════════════════════════════════
-- SENSITIVE COLLECTIONS (membership + per-row readable_by)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists schedule_items (
  id          text primary key,
  tour_id     text not null references tours on delete cascade,
  day_id      text not null,
  type        text not null default 'other',
  title       text not null default '',
  start_time  text, end_time text, location text, notes text,
  owner_person_id text, sensitive boolean not null default false,
  visibility  jsonb not null default '{"default":"blocked"}',
  readable_by uuid[] not null default '{}'
);
create index if not exists sched_tour_day_idx on schedule_items(tour_id, day_id);
create index if not exists sched_readable_idx on schedule_items using gin (readable_by);

create table if not exists travel (
  id text primary key,
  tour_id text not null references tours on delete cascade,
  day_id text not null,
  payload jsonb not null,
  visibility jsonb not null default '{"default":"blocked"}',
  readable_by uuid[] not null default '{}'
);
create index if not exists travel_tour_day_idx on travel(tour_id, day_id);
create index if not exists travel_readable_idx on travel using gin (readable_by);

create table if not exists hotels (
  id text primary key,
  tour_id text not null references tours on delete cascade,
  day_id text not null,
  payload jsonb not null,
  visibility jsonb not null default '{"default":"blocked"}',
  readable_by uuid[] not null default '{}'
);
create index if not exists hotels_tour_day_idx on hotels(tour_id, day_id);
create index if not exists hotels_readable_idx on hotels using gin (readable_by);

create table if not exists tasks (
  id text primary key,
  tour_id text not null references tours on delete cascade,
  day_id text,
  payload jsonb not null,
  visibility jsonb not null default '{"default":"blocked"}',
  readable_by uuid[] not null default '{}'
);
create index if not exists tasks_readable_idx on tasks using gin (readable_by);

create table if not exists documents (
  id text primary key,
  tour_id text not null references tours on delete cascade,
  day_id text,
  payload jsonb not null,
  visibility jsonb not null default '{"default":"blocked"}',
  readable_by uuid[] not null default '{}'
);
create index if not exists documents_readable_idx on documents using gin (readable_by);

-- attach readable_by triggers
create trigger set_readable_by before insert or update of visibility on schedule_items
  for each row execute function trg_set_readable_by();
create trigger set_readable_by before insert or update of visibility on travel
  for each row execute function trg_set_readable_by();
create trigger set_readable_by before insert or update of visibility on hotels
  for each row execute function trg_set_readable_by();
create trigger set_readable_by before insert or update of visibility on tasks
  for each row execute function trg_set_readable_by();
create trigger set_readable_by before insert or update of visibility on documents
  for each row execute function trg_set_readable_by();
create trigger members_recompute after insert or update or delete on tour_members
  for each row execute function trg_members_recompute();

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

alter table profiles       enable row level security;
alter table tours          enable row level security;
alter table tour_members   enable row level security;
alter table invites        enable row level security;
alter table days           enable row level security;
alter table personnel      enable row level security;
alter table rider_imports  enable row level security;
alter table flight_imports enable row level security;
alter table conflicts      enable row level security;
alter table gear_items     enable row level security;
alter table history        enable row level security;
alter table schedule_items enable row level security;
alter table travel         enable row level security;
alter table hotels         enable row level security;
alter table tasks          enable row level security;
alter table documents      enable row level security;

-- profiles: self only
create policy "self profile" on profiles for all
  using (auth.uid() = uid) with check (auth.uid() = uid);

-- tours: members read; owner/managers write; owner creates (must be self)
create policy "tour read"   on tours for select using (is_member(id) or owner_uid = auth.uid());
create policy "tour insert" on tours for insert with check (owner_uid = auth.uid());
create policy "tour update" on tours for update using (is_manager(id) or owner_uid = auth.uid());
create policy "tour delete" on tours for delete using (owner_uid = auth.uid());

-- members: members read; managers write
create policy "members read"  on tour_members for select using (is_member(tour_id));
create policy "members write" on tour_members for all
  using (is_manager(tour_id)) with check (is_manager(tour_id));

-- invites: manager creates for their tour; invitee reads/accepts by email; manager revokes
create policy "invite read" on invites for select
  using (lower(email) = lower(auth.jwt()->>'email') or is_manager(tour_id));
create policy "invite create" on invites for insert with check (is_manager(tour_id));
create policy "invite accept" on invites for update
  using (lower(email) = lower(auth.jwt()->>'email') and status = 'pending')
  with check (status = 'accepted');
create policy "invite revoke" on invites for delete using (is_manager(tour_id));

-- public-to-members collections
do $$
declare tbl text;
begin
  foreach tbl in array array['days','personnel','rider_imports','flight_imports','conflicts','gear_items']
  loop
    execute format('create policy "member read" on %I for select using (is_member(tour_id));', tbl);
    execute format('create policy "manager write" on %I for all using (is_manager(tour_id)) with check (is_manager(tour_id));', tbl);
  end loop;
end $$;

-- history: members read, managers insert, NO update/delete (append-only)
create policy "history read"   on history for select using (is_member(tour_id));
create policy "history insert" on history for insert with check (is_manager(tour_id));

-- sensitive collections: per-row readable_by read, manager write
do $$
declare tbl text;
begin
  foreach tbl in array array['schedule_items','travel','hotels','tasks','documents']
  loop
    execute format('create policy "member reads visible" on %I for select using (is_member(tour_id) and auth.uid() = any(readable_by));', tbl);
    execute format('create policy "manager write" on %I for all using (is_manager(tour_id)) with check (is_manager(tour_id));', tbl);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Realtime: enable on the tables AppState subscribes to (Dashboard → Database →
-- Replication, or: alter publication supabase_realtime add table schedule_items, …).
-- Storage bucket `tour-pdfs` (private) + its membership RLS are created separately
-- (see supabase-implementation-spec.md §8).
