-- MOTABAT / المطبات
-- Run this whole file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.hazards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bump','pothole')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  title text,
  notes text,
  confirmed_count integer not null default 0,
  rejected_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hazards_location_idx on public.hazards(latitude, longitude);
create index if not exists hazards_created_idx on public.hazards(created_at desc);

alter table public.profiles enable row level security;
alter table public.hazards enable row level security;

drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "hazards public read" on public.hazards;
create policy "hazards public read" on public.hazards for select using (true);

drop policy if exists "hazards authenticated insert" on public.hazards;
create policy "hazards authenticated insert" on public.hazards for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "hazards owner update" on public.hazards;
create policy "hazards owner update" on public.hazards for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "hazards owner delete" on public.hazards;
create policy "hazards owner delete" on public.hazards for delete to authenticated using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id,email) values (new.id,new.email)
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.hazards replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.hazards;
exception when duplicate_object then null;
end $$;