-- Survivor pool (v2.7). Safe to run once or twice; keeps everything.
-- Fresh installs get this from schema.sql.
--
-- One team per slate, never the same team twice, one loss and out. Runs
-- beside the pick'em in the same league, on the same slate, with its own
-- season-long buy-in. Straight up whatever the pick'em scores by.

alter table public.leagues add column if not exists survivor boolean not null default false;
alter table public.leagues add column if not exists survivor_fee_cents int not null default 1000;

-- One row per person per season: their seat in the pool and whether the
-- buy-in is paid. Created with the first pick.
create table if not exists public.survivor_entries (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  season int not null,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id, season)
);

-- One pick per person per slate. `team` is filled by the trigger from the
-- game, and the unique key on it is the "never twice" rule.
create table if not exists public.survivor_picks (
  league_id uuid not null,
  user_id uuid not null,
  season int not null,
  slate_key text not null,
  game_id text not null references public.games,
  picked text not null check (picked in ('HOME', 'AWAY')),
  team text not null default '',
  created_at timestamptz not null default now(),
  primary key (league_id, user_id, season, slate_key),
  unique (league_id, user_id, season, team),
  foreign key (league_id, user_id, season) references public.survivor_entries on delete cascade
);
create index if not exists survivor_picks_league_idx on public.survivor_picks (league_id, season);

-- May someone still enter? Until the pool's first slate (the slate of the
-- earliest pick anyone made) has its last kickoff. No picks yet: open.
create or replace function public.survivor_open(l uuid, s int) returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce(
    (select now() < slate_lock_at(l, s, min(slate_key)) from survivor_picks where league_id = l and season = s),
    true);
$$;

-- May the caller make this survivor pick? Pool on, member, game not started,
-- right sport/season/slate, in the league's curated slate, a side (no draws).
create or replace function public.survivor_pick_open(l uuid, s int, k text, g text, side text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from leagues lg join games gm on gm.id = g
    where lg.id = l and lg.survivor and is_member(l)
      and gm.kickoff > now()
      and gm.sport = lg.sport and gm.season = s and gm.slate_key = k
      and in_slate(l, s, k, g)
      and side in ('HOME', 'AWAY')
  );
$$;

-- The team is the game's side, whatever the client sent.
create or replace function public.survivor_picks_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select case when new.picked = 'HOME' then home_abbr else away_abbr end into new.team from games where id = new.game_id;
  if new.team is null then raise exception 'Unknown game'; end if;
  return new;
end;
$$;
drop trigger if exists survivor_picks_fill on public.survivor_picks;
create trigger survivor_picks_fill before insert or update on public.survivor_picks
  for each row execute function public.survivor_picks_fill();

-- An entry stays where it is: the commissioner flips paid, nothing else moves.
create or replace function public.survivor_entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.league_id <> old.league_id or new.user_id <> old.user_id or new.season <> old.season then
    raise exception 'Survivor entries cannot be moved';
  end if;
  return new;
end;
$$;
drop trigger if exists survivor_entries_guard on public.survivor_entries;
create trigger survivor_entries_guard before update on public.survivor_entries
  for each row execute function public.survivor_entries_guard();

alter table public.survivor_entries enable row level security;
alter table public.survivor_picks enable row level security;

-- entries: members see the pool. Enter as yourself while entries are open;
-- leave while they are open; the commissioner marks paid and can remove anyone.
drop policy if exists survivor_entries_read on public.survivor_entries;
drop policy if exists survivor_entries_insert on public.survivor_entries;
drop policy if exists survivor_entries_update on public.survivor_entries;
drop policy if exists survivor_entries_delete on public.survivor_entries;
create policy survivor_entries_read on public.survivor_entries for select to authenticated
  using (is_member(league_id));
create policy survivor_entries_insert on public.survivor_entries for insert to authenticated
  with check (user_id = auth.uid() and is_member(league_id)
    and exists (select 1 from leagues where id = league_id and survivor)
    and survivor_open(league_id, season));
create policy survivor_entries_update on public.survivor_entries for update to authenticated
  using (is_commissioner(league_id)) with check (is_commissioner(league_id));
create policy survivor_entries_delete on public.survivor_entries for delete to authenticated
  using ((user_id = auth.uid() and survivor_open(league_id, season)) or is_commissioner(league_id));

-- picks: yours always; everyone else's once that game kicks off. Writes go
-- through survivor_pick_open(); a pick on a started game cannot be touched.
drop policy if exists survivor_picks_read on public.survivor_picks;
drop policy if exists survivor_picks_insert on public.survivor_picks;
drop policy if exists survivor_picks_update on public.survivor_picks;
drop policy if exists survivor_picks_delete on public.survivor_picks;
create policy survivor_picks_read on public.survivor_picks for select to authenticated using (
  user_id = auth.uid()
  or (is_member(league_id) and exists (select 1 from games g where g.id = game_id and g.kickoff <= now()))
);
create policy survivor_picks_insert on public.survivor_picks for insert to authenticated
  with check (user_id = auth.uid() and survivor_pick_open(league_id, season, slate_key, game_id, picked));
create policy survivor_picks_update on public.survivor_picks for update to authenticated
  using (user_id = auth.uid() and exists (select 1 from games g where g.id = game_id and g.kickoff > now()))
  with check (user_id = auth.uid() and survivor_pick_open(league_id, season, slate_key, game_id, picked));
create policy survivor_picks_delete on public.survivor_picks for delete to authenticated
  using (user_id = auth.uid() and exists (select 1 from games g where g.id = game_id and g.kickoff > now()));
