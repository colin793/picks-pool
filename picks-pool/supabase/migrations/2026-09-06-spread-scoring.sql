-- Against-the-spread scoring (v2.4). Safe to run once or twice; keeps
-- everything. Fresh installs get this from schema.sql.

alter table public.leagues
  add column if not exists scoring text not null default 'straight';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leagues_scoring_check') then
    alter table public.leagues add constraint leagues_scoring_check check (scoring in ('straight', 'spread'));
  end if;
end $$;

create or replace function public.leagues_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sport <> old.sport then
    raise exception 'A league cannot change sport';
  end if;
  if new.scoring <> old.scoring and exists (select 1 from entries where league_id = old.id) then
    raise exception 'Scoring cannot change once the league has an entry';
  end if;
  return new;
end;
$$;
