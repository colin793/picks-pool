-- Live cards (v2.3): situation, weather and the line on every game. Safe to
-- run once or twice; keeps everything. Fresh installs get this from schema.sql.

alter table public.games
  add column if not exists possession text not null default '',
  add column if not exists down_distance text not null default '',
  add column if not exists red_zone boolean not null default false,
  add column if not exists last_play text not null default '',
  add column if not exists home_spread numeric,
  add column if not exists over_under numeric,
  add column if not exists weather text not null default '',
  add column if not exists temperature int;
