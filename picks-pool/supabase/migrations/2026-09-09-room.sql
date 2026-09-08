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

-- ---------- room modes: the commissioner's switches, all off to start ----------
-- lock_of_week: one pick a week counts double. duels: weekly head-to-head
-- pairings beside the standings. duty: the loser's duty, in the commissioner's words.
alter table public.leagues add column if not exists lock_of_week boolean not null default false;
alter table public.leagues add column if not exists duels boolean not null default false;
alter table public.leagues add column if not exists duty text not null default '';

-- Your lock for the slate: one of your picked games. Set or moved only while
-- both the old and the new game are still to kick off, and only when the
-- league plays the mode. Hidden from other players until the game kicks off.
alter table public.entries add column if not exists lock_game_id text references public.games;

create or replace function public.entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.lock_game_id is not null then
      raise exception 'Enter first, then choose a lock';
    end if;
    return new;
  end if;
  if new.league_id <> old.league_id or new.user_id <> old.user_id
     or new.season <> old.season or new.slate_key <> old.slate_key then
    raise exception 'Entries cannot be moved';
  end if;
  if new.paid is distinct from old.paid and not is_commissioner(old.league_id) then
    raise exception 'Only the commissioner can mark entries paid';
  end if;
  if new.tiebreaker is distinct from old.tiebreaker
     and now() > slate_lock_at(old.league_id, old.season, old.slate_key) then
    raise exception 'Tiebreaker is locked';
  end if;
  if new.lock_game_id is distinct from old.lock_game_id then
    if not exists (select 1 from leagues where id = old.league_id and lock_of_week) then
      raise exception 'This league does not play a lock of the week';
    end if;
    if old.lock_game_id is not null and exists (select 1 from games where id = old.lock_game_id and kickoff <= now()) then
      raise exception 'Your lock has kicked off';
    end if;
    if new.lock_game_id is not null and not pick_open(old.id, new.lock_game_id) then
      raise exception 'A lock must be one of your open games this week';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists entries_guard on public.entries;
create trigger entries_guard before insert or update on public.entries
  for each row execute function public.entries_guard();

-- The board view gains the lock, hidden like a pick until its game kicks off.
create or replace view public.entries_board with (security_invoker = on) as
select e.id, e.league_id, e.user_id, e.season, e.slate_key, e.paid, e.created_at,
  case
    when e.user_id = auth.uid() then e.tiebreaker
    when now() >= slate_lock_at(e.league_id, e.season, e.slate_key) then e.tiebreaker
    else null
  end as tiebreaker,
  case
    when e.user_id = auth.uid() then e.lock_game_id
    when exists (select 1 from games g where g.id = e.lock_game_id and g.kickoff <= now()) then e.lock_game_id
    else null
  end as lock_game_id
from public.entries e;
