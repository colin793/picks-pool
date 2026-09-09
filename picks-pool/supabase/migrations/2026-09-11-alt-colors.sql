-- Team secondary colors (v2.9.1). Safe to run once or twice. ESPN sends each
-- team a second color (Patriots red, Seahawks green); the matchup fold's
-- projection bar uses it when the two primary colors are too close to tell
-- apart. The next score sync fills these in.
alter table public.games add column if not exists home_alt_color text not null default '';
alter table public.games add column if not exists away_alt_color text not null default '';
