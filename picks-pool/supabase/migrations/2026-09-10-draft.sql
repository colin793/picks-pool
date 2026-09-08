-- Boot of the Week and the weekly draft (v2.9). Safe to run once or twice;
-- keeps everything. Fresh installs get all of this from schema.sql.

-- ---------- two more commissioner switches, off to start ----------
-- boot: last week's last place wears a boot on the board until the next
-- week ends. draft: the weekly draft, a game beside the pick'em.
alter table public.leagues add column if not exists boot boolean not null default false;
alter table public.leagues add column if not exists draft boolean not null default false;

-- ---------- the weekly draft ----------
-- Everyone ranks the slate's teams; at the slate's first kickoff the server
-- runs a snake draft from the rankings (lib/draft.js) and writes the picks.
-- A drafted team that wins is a point; most points takes the week.

-- When the slate's first game kicks off: rankings close, the draft runs.
create or replace function public.slate_first_kickoff(l uuid, s int, k text) returns timestamptz
language sql security definer set search_path = public stable as $$
  select min(g.kickoff) from games g join leagues lg on lg.sport = g.sport
  where lg.id = l and g.season = s and g.slate_key = k and in_slate(l, s, k, g.id);
$$;

-- One row per slate once the draft has run. Service role writes; members read.
create table if not exists public.drafts (
  league_id uuid not null references public.leagues on delete cascade,
  season int not null,
  slate_key text not null,
  seed text not null default '',
  ran_at timestamptz not null default now(),
  primary key (league_id, season, slate_key)
);

-- Your ranking for the slate: team keys ("<game id>:HOME") in the order you
-- want them. Yours to see and change until the first kickoff; everyone's to
-- see once the draft has run.
create table if not exists public.draft_rankings (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  season int not null,
  slate_key text not null,
  ranking jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id, season, slate_key)
);

-- What the draft dealt. Service role writes; members read.
create table if not exists public.draft_picks (
  league_id uuid not null references public.leagues on delete cascade,
  season int not null,
  slate_key text not null,
  user_id uuid not null references public.profiles on delete cascade,
  game_id text not null references public.games,
  side text not null check (side in ('HOME', 'AWAY')),
  round int not null,
  pick_no int not null,
  primary key (league_id, season, slate_key, game_id, side),
  unique (league_id, season, slate_key, pick_no)
);

-- May the caller still rank for this slate? Draft on, member, before the
-- first kickoff, and the draft has not run.
create or replace function public.draft_open(l uuid, s int, k text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from leagues where id = l and draft) and is_member(l)
    and coalesce(slate_first_kickoff(l, s, k) > now(), false)
    and not exists (select 1 from drafts where league_id = l and season = s and slate_key = k);
$$;

alter table public.drafts enable row level security;
alter table public.draft_rankings enable row level security;
alter table public.draft_picks enable row level security;
drop policy if exists drafts_read on public.drafts;
drop policy if exists draft_picks_read on public.draft_picks;
drop policy if exists draft_rankings_read on public.draft_rankings;
drop policy if exists draft_rankings_insert on public.draft_rankings;
drop policy if exists draft_rankings_update on public.draft_rankings;
drop policy if exists draft_rankings_delete on public.draft_rankings;
create policy drafts_read on public.drafts for select to authenticated using (is_member(league_id));
create policy draft_picks_read on public.draft_picks for select to authenticated using (is_member(league_id));
create policy draft_rankings_read on public.draft_rankings for select to authenticated using (
  user_id = auth.uid()
  or (is_member(league_id) and exists (select 1 from drafts d where d.league_id = draft_rankings.league_id and d.season = draft_rankings.season and d.slate_key = draft_rankings.slate_key))
);
create policy draft_rankings_insert on public.draft_rankings for insert to authenticated
  with check (user_id = auth.uid() and draft_open(league_id, season, slate_key));
create policy draft_rankings_update on public.draft_rankings for update to authenticated
  using (user_id = auth.uid() and draft_open(league_id, season, slate_key))
  with check (user_id = auth.uid() and draft_open(league_id, season, slate_key));
create policy draft_rankings_delete on public.draft_rankings for delete to authenticated
  using (user_id = auth.uid() and draft_open(league_id, season, slate_key));
