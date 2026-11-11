-- Motabat / مطبّك
-- Additive migration: preserves every existing hazard and its ID.
-- Run AFTER the existing root schema.sql on an existing Supabase project.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

-- Keep the current latitude/longitude fields for app compatibility,
-- while adding a proper PostGIS geography point for nearby searches.
alter table public.hazards
  add column if not exists location geography(Point, 4326);

update public.hazards
set location = st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
where location is null
  and latitude between -90 and 90
  and longitude between -180 and 180;

create index if not exists hazards_location_gix
  on public.hazards using gist (location);

create or replace function public.sync_hazard_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.location := st_setsrid(
    st_makepoint(new.longitude, new.latitude),
    4326
  )::geography;
  return new;
end;
$$;

drop trigger if exists hazards_sync_location on public.hazards;
create trigger hazards_sync_location
before insert or update of latitude, longitude
on public.hazards
for each row execute function public.sync_hazard_location();

-- One confirmation/rejection per user and hazard; changing a vote updates it.
create table if not exists public.hazard_reports (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references public.hazards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hazard_reports_one_vote_per_user unique (hazard_id, user_id)
);

create index if not exists hazard_reports_hazard_idx
  on public.hazard_reports(hazard_id);

alter table public.hazard_reports enable row level security;

drop policy if exists "hazard reports own select" on public.hazard_reports;
create policy "hazard reports own select"
  on public.hazard_reports for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "hazard reports own insert" on public.hazard_reports;
create policy "hazard reports own insert"
  on public.hazard_reports for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "hazard reports own update" on public.hazard_reports;
create policy "hazard reports own update"
  on public.hazard_reports for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "hazard reports own delete" on public.hazard_reports;
create policy "hazard reports own delete"
  on public.hazard_reports for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.refresh_hazard_report_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_hazard_id uuid;
begin
  target_hazard_id := coalesce(new.hazard_id, old.hazard_id);

  update public.hazards h
  set confirmed_count = (
        select count(*)::integer
        from public.hazard_reports r
        where r.hazard_id = target_hazard_id
          and r.report_type = 'confirmed'
      ),
      rejected_count = (
        select count(*)::integer
        from public.hazard_reports r
        where r.hazard_id = target_hazard_id
          and r.report_type = 'rejected'
      )
  where h.id = target_hazard_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists hazard_reports_refresh_counts on public.hazard_reports;
create trigger hazard_reports_refresh_counts
after insert or update or delete
on public.hazard_reports
for each row execute function public.refresh_hazard_report_counts();

do $$
begin
  alter publication supabase_realtime add table public.hazards;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
