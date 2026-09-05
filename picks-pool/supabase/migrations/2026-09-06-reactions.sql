-- Reactions on the pick grid (v2.6). Safe to run once or twice. Fresh installs get this from schema.sql.
create table if not exists public.reactions (
  league_id uuid not null references public.leagues on delete cascade,
  entry_id uuid not null references public.entries on delete cascade,
  game_id text not null references public.games,
  user_id uuid not null references public.profiles on delete cascade,
  emoji text not null check (emoji in ('🔥', '💀', '🤡', '👏')),
  created_at timestamptz not null default now(),
  primary key (entry_id, game_id, user_id)
);
create index if not exists reactions_league_idx on public.reactions (league_id);
alter table public.reactions enable row level security;
drop policy if exists reactions_read on public.reactions;
drop policy if exists reactions_write on public.reactions;
drop policy if exists reactions_update on public.reactions;
drop policy if exists reactions_delete on public.reactions;
create policy reactions_read on public.reactions for select to authenticated using (is_member(league_id));
create policy reactions_write on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and is_member(league_id)
    and exists (select 1 from entries e where e.id = entry_id and e.league_id = reactions.league_id)
    and exists (select 1 from games g where g.id = game_id and g.kickoff <= now()));
create policy reactions_update on public.reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());
