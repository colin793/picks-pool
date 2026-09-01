-- Picks Pool schema. Paste this whole file into the Supabase SQL editor and run it once.

create extension if not exists pgcrypto; -- gen_random_bytes for invite codes

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
  invite_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  logo_url text not null default '',
  color1 text not null default '#1d4ed8',
  color2 text not null default '#111827',
  entry_fee_cents int not null default 100,
  venmo_handle text not null default '',
  recap_enabled boolean not null default true,
  commissioner uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- Global NFL schedule/scores, shared by every league. Written only by the server (service role).
create table public.games (
  id text primary key,               -- ESPN event id
  season int not null,
  week int not null,
  kickoff timestamptz not null,
  home_abbr text not null,
  home_name text not null,
  away_abbr text not null,
  away_name text not null,
  home_score int not null default 0,
  away_score int not null default 0,
  state text not null default 'pre', -- pre | in | post
  winner text                        -- HOME | AWAY | TIE, set when state = post
);
create index games_week_idx on public.games (season, week);

-- One row. Current season/week per ESPN, plus sync throttle timestamp.
create table public.meta (
  id int primary key default 1 check (id = 1),
  season int,
  week int,
  last_sync timestamptz
);
insert into public.meta (id) values (1);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  season int not null,
  week int not null,
  tiebreaker int,                    -- predicted total points, final game of the week
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  unique (league_id, user_id, season, week)
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
  week int not null,
  user_id uuid not null references public.profiles(id),
  amount_cents int not null,
  created_at timestamptz not null default now()
);

-- ---------- helper functions ----------

create function public.is_member(l uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where league_id = l and user_id = auth.uid());
$$;

create function public.is_commissioner(l uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from leagues where id = l and commissioner = auth.uid());
$$;

-- Copy new signups into profiles (email included, so recap emails need no admin lookups).
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
-- week's final kickoff. Service role (server jobs) bypasses.
create function public.entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or auth.uid() is null then
    return new;
  end if;
  if new.paid is distinct from old.paid and not is_commissioner(old.league_id) then
    raise exception 'Only the commissioner can mark entries paid';
  end if;
  if new.tiebreaker is distinct from old.tiebreaker
     and now() > (select max(kickoff) from games where season = old.season and week = old.week) then
    raise exception 'Tiebreaker is locked';
  end if;
  return new;
end;
$$;
create trigger entries_guard before update on public.entries
  for each row execute function public.entries_guard();

-- ---------- row-level security ----------

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.memberships enable row level security;
alter table public.games enable row level security;
alter table public.meta enable row level security;
alter table public.entries enable row level security;
alter table public.picks enable row level security;
alter table public.payouts enable row level security;

-- profiles: any signed-in user can read names/emoji/venmo (leaderboards need them);
-- only you can edit yours. ponytail: read-all is fine at this scale, scope to shared
-- leagues if strangers ever share a database.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- leagues: readable by any signed-in user (the join page looks leagues up by invite
-- code before you are a member). Name and colors are not secrets.
create policy leagues_read on public.leagues for select to authenticated using (true);
create policy leagues_insert on public.leagues for insert to authenticated
  with check (commissioner = auth.uid());
create policy leagues_update on public.leagues for update to authenticated
  using (is_commissioner(id)) with check (is_commissioner(id));

-- memberships: members see their league's roster. Inserts happen server-side
-- (service role) after the invite code checks out, so no insert policy.
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or is_member(league_id));

-- games + meta: read-only reference data.
create policy games_read on public.games for select to authenticated using (true);
create policy meta_read on public.meta for select to authenticated using (true);

-- entries: members read raw rows (use the entries_board view anywhere other
-- players' tiebreakers must stay hidden until lock).
create policy entries_read on public.entries for select to authenticated
  using (is_member(league_id));
create policy entries_insert on public.entries for insert to authenticated
  with check (user_id = auth.uid() and is_member(league_id));
create policy entries_update on public.entries for update to authenticated
  using (user_id = auth.uid() or is_commissioner(league_id))
  with check (user_id = auth.uid() or is_commissioner(league_id));

-- picks: yours always; everyone else's only after that game kicks off.
create policy picks_read on public.picks for select to authenticated using (
  exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  or (
    exists (select 1 from entries e where e.id = entry_id and is_member(e.league_id))
    and exists (select 1 from games g where g.id = game_id and g.kickoff <= now())
  )
);
create policy picks_insert on public.picks for insert to authenticated with check (
  exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  and exists (select 1 from games g where g.id = game_id and g.kickoff > now())
);
create policy picks_update on public.picks for update to authenticated using (
  exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  and exists (select 1 from games g where g.id = game_id and g.kickoff > now())
) with check (
  exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  and exists (select 1 from games g where g.id = game_id and g.kickoff > now())
);

-- payouts: members read, commissioner records.
create policy payouts_read on public.payouts for select to authenticated
  using (is_member(league_id));
create policy payouts_insert on public.payouts for insert to authenticated
  with check (is_commissioner(league_id));

-- Leaderboard view: other players' tiebreaker stays null until the week's final
-- game has kicked off.
create view public.entries_board with (security_invoker = on) as
select e.id, e.league_id, e.user_id, e.season, e.week, e.paid, e.created_at,
  case
    when e.user_id = auth.uid() then e.tiebreaker
    when now() >= (select max(g.kickoff) from games g where g.season = e.season and g.week = e.week)
      then e.tiebreaker
    else null
  end as tiebreaker
from public.entries e;
