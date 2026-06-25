-- ============================================================
--  THE BURGER BIKE — Supabase setup (safe to re-run anytime)
--  Paste this whole file into the Supabase SQL Editor and Run.
-- ============================================================

-- 1) The sightings table (kept if it already exists) ---------
create table if not exists public.sightings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  image_url     text not null,
  where_spotted text,
  spotter       text,
  email         text,
  approved      boolean not null default false
);

-- Patch any columns a previous/older run may have missed:
alter table public.sightings add column if not exists where_spotted text;
alter table public.sightings add column if not exists spotter       text;
alter table public.sightings add column if not exists email         text;
alter table public.sightings add column if not exists approved      boolean not null default false;

alter table public.sightings enable row level security;

-- 2) Submit policy (drop-then-create so re-running never errors)
drop policy if exists "anon can submit" on public.sightings;
create policy "anon can submit"
  on public.sightings for insert
  to anon
  with check (true);
-- (No public select policy on this table, so the email column stays private.)

-- 3) Public gallery view (safe columns, approved rows only) --
create or replace view public.sightings_public
  with (security_invoker = off) as
  select id, created_at, image_url, where_spotted, spotter
  from public.sightings
  where approved = true;

grant select on public.sightings_public to anon;

-- 4) Storage bucket + upload policy --------------------------
insert into storage.buckets (id, name, public)
values ('sightings', 'sightings', true)
on conflict (id) do nothing;

drop policy if exists "anon can upload" on storage.objects;
create policy "anon can upload"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'sightings');

-- ============================================================
--  Approve a sighting (so it shows in the gallery):
--    update public.sightings set approved = true where id = '...';
--  Pull this month's draw entries:
--    select spotter, email, created_at from public.sightings
--    where approved = true and email is not null
--      and created_at >= date_trunc('month', now());
-- ============================================================
