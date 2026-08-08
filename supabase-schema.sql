-- Gomsdu RPG — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).

create table if not exists sessions (
  code text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every write, useful for debugging/ordering.
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sessions_touch_updated_at on sessions;
create trigger sessions_touch_updated_at
  before update on sessions
  for each row execute function touch_updated_at();

-- Row Level Security: open read/write for now (private repo, trusted friend group).
-- Tighten this later if the table ever needs to be public-facing.
alter table sessions enable row level security;

drop policy if exists "anyone can read sessions" on sessions;
create policy "anyone can read sessions"
  on sessions for select
  using (true);

drop policy if exists "anyone can write sessions" on sessions;
create policy "anyone can write sessions"
  on sessions for insert
  with check (true);

drop policy if exists "anyone can update sessions" on sessions;
create policy "anyone can update sessions"
  on sessions for update
  using (true);

-- Realtime: lets every connected browser get pushed updates instead of polling.
-- In Supabase's dashboard: Database > Replication > enable the "sessions" table,
-- or run this (safe to re-run):
alter publication supabase_realtime add table sessions;
