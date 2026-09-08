-- The room (v2.8): where to watch and the matchup fold, the room modes the
-- commissioner can switch on (lock of the week, duels, loser's duty), Call it,
-- and the first-time tours. Safe to run once or twice; keeps everything.
-- Fresh installs get all of this from schema.sql.

-- ---------- where to watch, records, the matchup fold ----------
alter table public.games add column if not exists broadcast text not null default '';
alter table public.games add column if not exists home_record text not null default '';
alter table public.games add column if not exists away_record text not null default '';

-- What ESPN's per-game summary said, boiled down (lib/scores/matchup.js),
-- fetched the first time someone opens a card's fold. Read by anyone signed
-- in; written by the server (service role).
create table if not exists public.game_notes (
  game_id text primary key references public.games on delete cascade,
  notes jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);
alter table public.game_notes enable row level security;
drop policy if exists game_notes_read on public.game_notes;
create policy game_notes_read on public.game_notes for select to authenticated using (true);
