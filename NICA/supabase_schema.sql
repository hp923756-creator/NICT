-- ============================================================
-- NICT CRICKET — FINAL SUPABASE SCHEMA
-- Safe migration for the multi-device match system.
-- Run this in Supabase SQL Editor.
-- ============================================================

create table if not exists public.matches (
  id text primary key,
  match_id text,
  match_json jsonb not null,
  status text not null default 'upcoming',
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.matches
  add column if not exists match_id text;

alter table public.matches
  add column if not exists match_json jsonb;

alter table public.matches
  add column if not exists status text;

alter table public.matches
  add column if not exists started_at timestamptz;

alter table public.matches
  add column if not exists created_at timestamptz default now();

alter table public.matches
  add column if not exists updated_at timestamptz default now();

update public.matches
set match_id = id
where match_id is null;

update public.matches
set status = 'upcoming'
where status is null;

create index if not exists matches_match_id_idx
  on public.matches(match_id);

create index if not exists matches_status_idx
  on public.matches(status);

create index if not exists matches_started_at_idx
  on public.matches(started_at);

alter table public.matches
  enable row level security;

create or replace function public.touch_matches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists matches_updated_at
on public.matches;

create trigger matches_updated_at
before update on public.matches
for each row
execute function public.touch_matches_updated_at();

-- The API uses the Supabase service-role key on the server.
-- Do not put the service-role key in app.js.
-- No public INSERT/UPDATE/DELETE policy is required.
