-- Picks Pool schema, v2 (slates + sports).
-- Fresh install: paste this whole file into the Supabase SQL editor and run it once.
-- Coming from v1: run supabase/reset.sql first (drops everything), then this.
--
-- Vocabulary. A "slate" is an ordered, named bucket of games for one sport and
-- season: an NFL week, a college football week, a single NBA date. Everything
-- that used to say "week" says slate_key now. slate_key sorts as text:
--   week mode:  2026-2-01   (season, ESPN season type, zero-padded week)
--   date mode:  2026-11-14  (the local calendar date of the games)

-- ---------- reference data ----------

create table public.sports (
  key text primary key,          -- nfl, cfb, nba, nhl, mlb (lib/scores/sports.js knows the ESPN side)
  name text not null,
  slate_mode text not null check (slate_mode in ('week', 'date')),
  sort int not null default 0
);
insert into public.sports (key, name, slate_mode, sort) values
  ('nfl', 'NFL', 'week', 1),
  ('cfb', 'College Football', 'week', 2),
  ('nba', 'NBA', 'date', 3),
  ('nhl', 'NHL', 'date', 4),
  ('mlb', 'MLB', 'date', 5);

-- ---------- tables ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null default '',
  display_name text not null default '',
  emoji text not null default '🏈',
  venmo_handle text not null default ''
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null default 'nfl' references public.sports,
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  logo_url text not null default '',
  color1 text not null default '#1d4ed8',
  color2 text not null default '#111827',
  entry_fee_cents int not null default 100,
  venmo_handle text not null default '',
  recap_enabled boolean not null default true,
  reminders_enabled boolean not null default true,
  commissioner uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- Global schedule/scores per sport, shared by every league. Written only by the
-- server (service role).
create table public.games (
  id text primary key,               -- ESPN event id
  sport text not null references public.sports,
  season int not null,               -- ESPN season.year (NFL playoffs in Jan 2027 are season 2026)
  season_type int not null,          -- ESPN: 1 pre, 2 regular, 3 post
  slate_key text not null,
  slate_label text not null,         -- "Week 1", "Wild Card", "Sat Nov 14"
  kickoff timestamptz not null,
  home_abbr text not null,
  home_name text not null,
  home_logo text not null default '',
  home_color text not null default '',
  away_abbr text not null,
  away_name text not null,
  away_logo text not null default '',
  away_color text not null default '',
  home_score int not null default 0,
  away_score int not null default 0,
  state text not null default 'pre', -- pre | in | post
  status_detail text not null default '', -- ESPN shortDetail: "Q3 4:12", "Final/OT"
  winner text                        -- HOME | AWAY | TIE, set when state = post
);
create index games_slate_idx on public.games (sport, season, slate_key);

-- One row per sport: where "now" is, plus the sync throttle timestamp.
create table public.sport_state (
  sport text primary key references public.sports,
  season int,
  season_type int,
  slate_key text,
  slate_label text,
  last_sync timestamptz
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  season int not null,
  slate_key text not null,
  tiebreaker int,                    -- predicted total points, final game of the slate
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  unique (league_id, user_id, season, slate_key)
);

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries on delete cascade,
  game_id text not null references public.games,
  picked text not null check (picked in ('HOME', 'AWAY')),
  unique (entry_id, game_id)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  season int not null,
  slate_key text not null,
  user_id uuid not null references public.profiles(id),
  amount_cents int not null,
  created_at timestamptz not null default now()
);

-- Recap emails already sent, so a slate is recapped once even though the
-- cron runs daily. Service role only (RLS on, no policies).
create table public.recaps_sent (
  league_id uuid not null references public.leagues on delete cascade,
  season int not null,
  slate_key text not null,
  sent_at timestamptz not null default now(),
  primary key (league_id, season, slate_key)
);

-- ---------- helper functions ----------
-- security definer so policies can consult tables the caller may not read.

create function public.is_member(l uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where league_id = l and user_id = auth.uid());
$$;

create function public.is_commissioner(l uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from leagues where id = l and commissioner = auth.uid());
$$;

-- Does the caller share at least one league with this profile?
create function public.shares_league_with(p uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select p = auth.uid() or exists (
    select 1 from memberships a join memberships b on a.league_id = b.league_id
    where a.user_id = auth.uid() and b.user_id = p
  );
$$;

-- When the slate's last game kicks off (tiebreakers lock, other players' tiebreakers reveal).
create function public.slate_lock_at(l uuid, s int, k text) returns timestamptz
language sql security definer set search_path = public stable as $$
  select max(g.kickoff) from games g join leagues lg on lg.sport = g.sport
  where lg.id = l and g.season = s and g.slate_key = k;
$$;

-- An entry is locked once any of its picks is on a game that has kicked off.
create function public.entry_locked(e uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from picks p join games g on g.id = p.game_id
    where p.entry_id = e and g.kickoff <= now()
  );
$$;

-- May the caller write this pick right now? Owns the entry, game not started,
-- and the game belongs to the entry's sport, season and slate.
create function public.pick_open(e uuid, g text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from entries en
    join leagues lg on lg.id = en.league_id
    join games gm on gm.id = g
    where en.id = e and en.user_id = auth.uid()
      and gm.kickoff > now()
      and gm.sport = lg.sport and gm.season = en.season and gm.slate_key = en.slate_key
  );
$$;

-- Copy new signups into profiles (email included, so emails need no admin lookups).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard entry updates: only the commissioner flips paid; tiebreaker locks at the
-- slate's final kickoff; nobody moves an entry to another league/user/slate.
-- Service role (server jobs) bypasses.
create function public.entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or auth.uid() is null then
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
  return new;
end;
$$;
create trigger entries_guard before update on public.entries
  for each row execute function public.entries_guard();

-- A league's sport is fixed at creation: entries and picks are keyed to it.
create function public.leagues_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sport <> old.sport then
    raise exception 'A league cannot change sport';
  end if;
  return new;
end;
$$;
create trigger leagues_guard before update on public.leagues
  for each row execute function public.leagues_guard();

-- ---------- row-level security ----------

alter table public.sports enable row level security;
alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.memberships enable row level security;
alter table public.games enable row level security;
alter table public.sport_state enable row level security;
alter table public.entries enable row level security;
alter table public.picks enable row level security;
alter table public.payouts enable row level security;
alter table public.recaps_sent enable row level security;

-- reference data: read-only for anyone signed in.
create policy sports_read on public.sports for select to authenticated using (true);
create policy games_read on public.games for select to authenticated using (true);
create policy sport_state_read on public.sport_state for select to authenticated using (true);

-- profiles: you can see people you share a league with (leaderboards need
-- names and emoji, payouts need Venmo handles). Only you can edit yours.
create policy profiles_read on public.profiles for select to authenticated
  using (shares_league_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- leagues: members only. The join page resolves invite codes through the
-- service role, so invite codes never need to be readable here.
create policy leagues_read on public.leagues for select to authenticated
  using (is_member(id) or commissioner = auth.uid());
create policy leagues_insert on public.leagues for insert to authenticated
  with check (commissioner = auth.uid());
-- Commissioner edits; may hand the league to another member.
create policy leagues_update on public.leagues for update to authenticated
  using (is_commissioner(id))
  with check (exists (select 1 from memberships m where m.league_id = id and m.user_id = commissioner)
              or commissioner = auth.uid());
create policy leagues_delete on public.leagues for delete to authenticated
  using (is_commissioner(id));

-- memberships: members see their league's roster. Inserts happen server-side
-- (service role) after the invite code checks out, so no insert policy.
-- Leaving: anyone but the commissioner can remove themselves; the commissioner
-- can remove anyone but themselves (delete or hand off the league instead).
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or is_member(league_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (
    (user_id = auth.uid() and not is_commissioner(league_id))
    or (is_commissioner(league_id) and user_id <> auth.uid())
  );

-- entries: members read raw rows (use the entries_board view anywhere other
-- players' tiebreakers must stay hidden until lock). Withdraw while nothing
-- has kicked off yet; the commissioner can always remove an entry.
create policy entries_read on public.entries for select to authenticated
  using (is_member(league_id));
create policy entries_insert on public.entries for insert to authenticated
  with check (user_id = auth.uid() and is_member(league_id));
create policy entries_update on public.entries for update to authenticated
  using (user_id = auth.uid() or is_commissioner(league_id))
  with check (user_id = auth.uid() or is_commissioner(league_id));
create policy entries_delete on public.entries for delete to authenticated
  using ((user_id = auth.uid() and not entry_locked(id)) or is_commissioner(league_id));

-- picks: yours always; everyone else's only after that game kicks off.
-- Writes go through pick_open(): own entry, game not started, right slate.
create policy picks_read on public.picks for select to authenticated using (
  exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  or (
    exists (select 1 from entries e where e.id = entry_id and is_member(e.league_id))
    and exists (select 1 from games g where g.id = game_id and g.kickoff <= now())
  )
);
create policy picks_insert on public.picks for insert to authenticated
  with check (pick_open(entry_id, game_id));
create policy picks_update on public.picks for update to authenticated
  using (pick_open(entry_id, game_id)) with check (pick_open(entry_id, game_id));
create policy picks_delete on public.picks for delete to authenticated
  using (pick_open(entry_id, game_id));

-- payouts: members read, commissioner records (and can undo).
create policy payouts_read on public.payouts for select to authenticated
  using (is_member(league_id));
create policy payouts_insert on public.payouts for insert to authenticated
  with check (is_commissioner(league_id));
create policy payouts_delete on public.payouts for delete to authenticated
  using (is_commissioner(league_id));

-- Leaderboard view: other players' tiebreaker stays null until the slate's
-- final game has kicked off.
create view public.entries_board with (security_invoker = on) as
select e.id, e.league_id, e.user_id, e.season, e.slate_key, e.paid, e.created_at,
  case
    when e.user_id = auth.uid() then e.tiebreaker
    when now() >= slate_lock_at(e.league_id, e.season, e.slate_key) then e.tiebreaker
    else null
  end as tiebreaker
from public.entries e;

-- Accounts that already exist in auth.users (an upgrade from v1, or a reset)
-- get their profile row here; new signups get one from the trigger above.
insert into public.profiles (id, email, display_name)
select id, coalesce(email, ''), split_part(coalesce(email, ''), '@', 1) from auth.users
on conflict (id) do nothing;
