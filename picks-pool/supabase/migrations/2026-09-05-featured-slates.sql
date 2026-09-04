-- Featured slates (v2.1). For a database already running v2's schema.sql.
-- Safe to run once; keeps every league, entry and pick. Fresh installs get
-- all of this from schema.sql instead.

alter table public.games
  add column if not exists home_rank int,
  add column if not exists home_conf text not null default '',
  add column if not exists away_rank int,
  add column if not exists away_conf text not null default '';

create table if not exists public.slate_games (
  league_id uuid not null references public.leagues on delete cascade,
  season int not null,
  slate_key text not null,
  game_id text not null references public.games,
  created_at timestamptz not null default now(),
  primary key (league_id, season, slate_key, game_id)
);
alter table public.slate_games enable row level security;

create or replace function public.in_slate(l uuid, s int, k text, g text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from slate_games where league_id = l and season = s and slate_key = k)
      or exists (select 1 from slate_games where league_id = l and season = s and slate_key = k and game_id = g);
$$;

create or replace function public.slate_lock_at(l uuid, s int, k text) returns timestamptz
language sql security definer set search_path = public stable as $$
  select max(g.kickoff) from games g join leagues lg on lg.sport = g.sport
  where lg.id = l and g.season = s and g.slate_key = k and in_slate(l, s, k, g.id);
$$;

create or replace function public.pick_open(e uuid, g text, side text default 'HOME') returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from entries en
    join leagues lg on lg.id = en.league_id
    join sports sp on sp.key = lg.sport
    join games gm on gm.id = g
    where en.id = e and en.user_id = auth.uid()
      and gm.kickoff > now()
      and gm.sport = lg.sport and gm.season = en.season and gm.slate_key = en.slate_key
      and in_slate(lg.id, en.season, en.slate_key, g)
      and (side <> 'TIE' or sp.draws)
  );
$$;

drop policy if exists slate_games_read on public.slate_games;
drop policy if exists slate_games_insert on public.slate_games;
drop policy if exists slate_games_delete on public.slate_games;
create policy slate_games_read on public.slate_games for select to authenticated
  using (is_member(league_id));
create policy slate_games_insert on public.slate_games for insert to authenticated
  with check (is_commissioner(league_id));
create policy slate_games_delete on public.slate_games for delete to authenticated
  using (is_commissioner(league_id) and exists (select 1 from games g where g.id = game_id and g.kickoff > now()));
