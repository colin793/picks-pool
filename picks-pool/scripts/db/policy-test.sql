-- Row-level security tests. Runs against a local Postgres prepared with
-- scripts/db/supabase-stub.sql + supabase/schema.sql (see npm run check:db).
-- Every block either passes silently or raises. The last line prints a summary.

begin;

-- ---------- helpers ----------
create temp table _t (name text, ok boolean);
grant all on _t to authenticated, anon, service_role;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end $$;

create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin
  insert into _t values (name, ok);
  if ok then raise notice 'ok   %', name; else raise warning 'FAIL %', name; end if;
end $$;

-- ---------- fixtures ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'commish@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'bob@example.com'),
  ('00000000-0000-0000-0000-000000000009', 'stranger@example.com');
update profiles set venmo_handle = '@' || display_name;

insert into leagues (id, name, sport, commissioner, invite_code) values
  ('10000000-0000-0000-0000-000000000001', 'Test League', 'nfl', '00000000-0000-0000-0000-000000000001', 'abcd1234');
insert into memberships (league_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');
-- A second league the stranger runs, so profile visibility can be tested across leagues.
insert into leagues (id, name, sport, commissioner, invite_code) values
  ('10000000-0000-0000-0000-000000000002', 'Other League', 'nfl', '00000000-0000-0000-0000-000000000009', 'zzzz9999');
insert into memberships (league_id, user_id) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000009');

insert into games (id, sport, season, season_type, slate_key, slate_label, kickoff, home_abbr, home_name, away_abbr, away_name, state, home_score, away_score, winner) values
  ('g-past',   'nfl', 2026, 2, '2026-2-01', 'Week 1', now() - interval '3 hours', 'SEA', 'Seahawks', 'NE',  'Patriots', 'post', 24, 17, 'HOME'),
  ('g-open-a', 'nfl', 2026, 2, '2026-2-01', 'Week 1', now() + interval '2 days',  'PHI', 'Eagles',   'DAL', 'Cowboys',  'pre', 0, 0, null),
  ('g-open-b', 'nfl', 2026, 2, '2026-2-01', 'Week 1', now() + interval '3 days',  'MIA', 'Dolphins', 'NYJ', 'Jets',     'pre', 0, 0, null),
  ('g-next',   'nfl', 2026, 2, '2026-2-02', 'Week 2', now() + interval '9 days',  'KC',  'Chiefs',   'BUF', 'Bills',    'pre', 0, 0, null),
  ('g-cfb',    'cfb', 2026, 2, '2026-2-02', 'Week 2', now() + interval '2 days',  'UGA', 'Bulldogs', 'BAMA', 'Crimson Tide', 'pre', 0, 0, null);

-- Alice has an entry with a pick already locked; Bob has an open entry.
insert into entries (id, league_id, user_id, season, slate_key, tiebreaker) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 2026, '2026-2-01', 44),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 2026, '2026-2-01', 51);
insert into picks (entry_id, game_id, picked) values
  ('20000000-0000-0000-0000-000000000001', 'g-past',   'HOME'),
  ('20000000-0000-0000-0000-000000000001', 'g-open-a', 'AWAY'),
  ('20000000-0000-0000-0000-000000000002', 'g-open-a', 'HOME');

-- ---------- tests ----------

-- Leagues: strangers see nothing, members see theirs, invite codes stay private.
do $$ declare n int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000009');
  select count(*) into n from leagues where id = '10000000-0000-0000-0000-000000000001';
  perform pg_temp.check('stranger cannot read a league they are not in', n = 0);
  select count(*) into n from leagues;
  perform pg_temp.check('stranger sees only their own league', n = 1);
  perform pg_temp.as_admin();
end $$;

do $$ declare n int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  select count(*) into n from leagues where id = '10000000-0000-0000-0000-000000000001';
  perform pg_temp.check('member reads their league', n = 1);
  perform pg_temp.as_admin();
end $$;

-- Profiles: only people you share a league with.
do $$ declare n int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000009');
  select count(*) into n from profiles;
  perform pg_temp.check('stranger sees only their own profile', n = 1);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  select count(*) into n from profiles;
  perform pg_temp.check('member sees the three profiles in their league', n = 3);
  perform pg_temp.as_admin();
end $$;

-- Picks: mine always; others only after kickoff.
do $$ declare n int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob
  select count(*) into n from picks where entry_id = '20000000-0000-0000-0000-000000000001';
  perform pg_temp.check('bob sees only alice''s kicked-off pick', n = 1);
  select count(*) into n from picks where entry_id = '20000000-0000-0000-0000-000000000002';
  perform pg_temp.check('bob sees his own open pick', n = 1);
  perform pg_temp.as_admin();
end $$;

-- Picks: writes.
do $$ declare ok boolean; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob
  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000002', 'g-open-b', 'AWAY');
    ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('bob can pick an open game in his slate', ok);

  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000002', 'g-past', 'AWAY');
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('bob cannot pick a game that kicked off', ok);

  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000002', 'g-next', 'AWAY');
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('bob cannot attach a next-slate game to this entry', ok);

  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000002', 'g-cfb', 'AWAY');
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('bob cannot attach a college game to an NFL entry', ok);

  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000001', 'g-open-b', 'AWAY');
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('bob cannot write picks on alice''s entry', ok);

  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000002', 'g-open-b', 'TIE');
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('bob cannot pick a draw in an NFL league', ok);

  begin
    update picks set picked = 'HOME' where entry_id = '20000000-0000-0000-0000-000000000002' and game_id = 'g-open-b';
    ok := (select picked = 'HOME' from picks where entry_id = '20000000-0000-0000-0000-000000000002' and game_id = 'g-open-b');
  exception when others then ok := false; end;
  perform pg_temp.check('bob can change an open pick', ok);

  delete from picks where entry_id = '20000000-0000-0000-0000-000000000002' and game_id = 'g-open-b';
  ok := not exists (select 1 from picks where entry_id = '20000000-0000-0000-0000-000000000002' and game_id = 'g-open-b');
  perform pg_temp.check('bob can un-pick an open game', ok);
  perform pg_temp.as_admin();
end $$;

-- Draws are pickable where the sport allows them.
insert into leagues (id, name, sport, commissioner, invite_code) values
  ('10000000-0000-0000-0000-000000000003', 'Footy', 'epl', '00000000-0000-0000-0000-000000000003', 'epl00001');
insert into memberships (league_id, user_id) values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003');
insert into games (id, sport, season, season_type, slate_key, slate_label, kickoff, home_abbr, home_name, away_abbr, away_name) values
  ('g-epl', 'epl', 2026, 2, '2026-09-12', 'Sep 12 to 14', now() + interval '1 day', 'CHE', 'Chelsea', 'ARS', 'Arsenal');
insert into entries (id, league_id, user_id, season, slate_key) values
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 2026, '2026-09-12');
do $$ declare ok boolean; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob
  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000003', 'g-epl', 'TIE');
    ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('bob can pick a draw in a Premier League league', ok);
  perform pg_temp.as_admin();
end $$;

-- A locked pick cannot be changed by its owner, and the delete silently affects 0 rows.
do $$ declare n int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002'); -- alice
  update picks set picked = 'AWAY' where entry_id = '20000000-0000-0000-0000-000000000001' and game_id = 'g-past';
  perform pg_temp.as_admin();
  select count(*) into n from picks where entry_id = '20000000-0000-0000-0000-000000000001' and game_id = 'g-past' and picked = 'HOME';
  perform pg_temp.check('alice cannot flip a pick after kickoff', n = 1);
end $$;

-- Entries: withdraw only while unlocked; commissioner can always remove.
do $$ declare n int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002'); -- alice, locked
  delete from entries where id = '20000000-0000-0000-0000-000000000001';
  perform pg_temp.as_admin();
  select count(*) into n from entries where id = '20000000-0000-0000-0000-000000000001';
  perform pg_temp.check('alice cannot withdraw once a pick has kicked off', n = 1);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob, open
  delete from entries where id = '20000000-0000-0000-0000-000000000002';
  perform pg_temp.as_admin();
  select count(*) into n from entries where id = '20000000-0000-0000-0000-000000000002';
  perform pg_temp.check('bob can withdraw an unlocked entry', n = 0);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001'); -- commissioner
  delete from entries where id = '20000000-0000-0000-0000-000000000001';
  perform pg_temp.as_admin();
  select count(*) into n from entries where id = '20000000-0000-0000-0000-000000000001';
  perform pg_temp.check('commissioner can remove a locked entry', n = 0);
end $$;

-- Entries: paid flag and tiebreaker lock.
do $$ declare ok boolean; declare eid uuid; begin
  insert into entries (league_id, user_id, season, slate_key, tiebreaker)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 2026, '2026-2-01', 40)
    returning id into eid;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob
  begin
    update entries set paid = true where id = eid;
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('a player cannot mark themselves paid', ok);
  begin
    update entries set tiebreaker = 45 where id = eid;
    ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('a player can change the tiebreaker before the last kickoff', ok);
  begin
    update entries set league_id = '10000000-0000-0000-0000-000000000002' where id = eid;
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('an entry cannot be moved to another league', ok);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001'); -- commissioner
  begin
    update entries set paid = true where id = eid;
    ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('the commissioner can mark paid', ok);
  perform pg_temp.as_admin();
end $$;

-- Tiebreaker visibility through the board view.
do $$ declare tb int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002'); -- alice looks at bob
  select tiebreaker into tb from entries_board where user_id = '00000000-0000-0000-0000-000000000003';
  perform pg_temp.check('other players'' tiebreakers hidden before the last kickoff', tb is null);
  perform pg_temp.as_admin();
end $$;

-- Memberships: leaving and removing.
do $$ declare n int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001'); -- commissioner tries to leave
  delete from memberships where league_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000001';
  perform pg_temp.as_admin();
  select count(*) into n from memberships where league_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000001';
  perform pg_temp.check('commissioner cannot leave their own league', n = 1);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000009'); -- stranger tries to remove alice
  delete from memberships where league_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000002';
  perform pg_temp.as_admin();
  select count(*) into n from memberships where league_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000002';
  perform pg_temp.check('stranger cannot remove a member', n = 1);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001'); -- commissioner removes alice
  delete from memberships where league_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000002';
  perform pg_temp.as_admin();
  select count(*) into n from memberships where league_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000002';
  perform pg_temp.check('commissioner can remove a member', n = 0);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob leaves
  delete from memberships where league_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000003';
  perform pg_temp.as_admin();
  select count(*) into n from memberships where league_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000003';
  perform pg_temp.check('a member can leave', n = 0);
end $$;

-- Leagues: sport is fixed, handoff works, delete is commissioner-only and cascades.
do $$ declare ok boolean; declare n int; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  begin
    update leagues set sport = 'cfb' where id = '10000000-0000-0000-0000-000000000001';
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('a league cannot change sport', ok);

  begin
    update leagues set commissioner = '00000000-0000-0000-0000-000000000009' where id = '10000000-0000-0000-0000-000000000001';
    ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('cannot hand the league to a non-member', ok);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000009'); -- stranger tries to delete
  delete from leagues where id = '10000000-0000-0000-0000-000000000001';
  perform pg_temp.as_admin();
  select count(*) into n from leagues where id = '10000000-0000-0000-0000-000000000001';
  perform pg_temp.check('stranger cannot delete a league', n = 1);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  delete from leagues where id = '10000000-0000-0000-0000-000000000001';
  perform pg_temp.as_admin();
  select count(*) into n from leagues where id = '10000000-0000-0000-0000-000000000001';
  perform pg_temp.check('commissioner can delete the league', n = 0);
  select count(*) into n from entries where league_id = '10000000-0000-0000-0000-000000000001';
  perform pg_temp.check('deleting the league removes its entries', n = 0);
end $$;

-- ---------- summary ----------
do $$ declare total int; declare failed int; begin
  select count(*), count(*) filter (where not ok) into total, failed from _t;
  if failed > 0 then
    raise exception 'policy tests: % of % FAILED', failed, total;
  end if;
  raise notice 'policy tests: all % passed', total;
end $$;

rollback;
