create table if not exists public.matches (
  id text primary key,
  match_json jsonb not null,
  status text not null default 'upcoming',
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matches_status_idx on public.matches(status);
alter table public.matches enable row level security;
create or replace function public.touch_matches_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists matches_updated_at on public.matches;
create trigger matches_updated_at before update on public.matches
for each row execute function public.touch_matches_updated_at();
