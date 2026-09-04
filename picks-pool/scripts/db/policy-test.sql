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

-- A college league the commissioner also runs, with a curated two-game slate
-- out of three on the board. Alice is in it, Bob is not.
insert into leagues (id, name, sport, commissioner, invite_code) values
  ('10000000-0000-0000-0000-000000000007', 'College League', 'cfb', '00000000-0000-0000-0000-000000000001', 'cfbcfb11');
insert into memberships (league_id, user_id) values
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002');
insert into games (id, sport, season, season_type, slate_key, slate_label, kickoff, home_abbr, home_name, away_abbr, away_name, state, home_rank, away_rank) values
  ('c-in-1',  'cfb', 2026, 2, '2026-2-02', 'Week 2', now() + interval '1 day', 'UGA', 'Bulldogs', 'CLEM', 'Tigers', 'pre', 1, 4),
  ('c-in-2',  'cfb', 2026, 2, '2026-2-02', 'Week 2', now() + interval '4 days', 'OSU', 'Buckeyes', 'MICH', 'Wolverines', 'pre', 2, 3),
  ('c-out',   'cfb', 2026, 2, '2026-2-02', 'Week 2', now() + interval '5 days', 'KENT', 'Golden Flashes', 'AKR', 'Zips', 'pre', null, null),
  ('c-started', 'cfb', 2026, 2, '2026-2-02', 'Week 2', now() - interval '1 hour', 'LSU', 'Tigers', 'ARK', 'Razorbacks', 'in', 5, null);
insert into slate_games (league_id, season, slate_key, game_id) values
  ('10000000-0000-0000-0000-000000000007', 2026, '2026-2-02', 'c-in-1'),
  ('10000000-0000-0000-0000-000000000007', 2026, '2026-2-02', 'c-in-2'),
  ('10000000-0000-0000-0000-000000000007', 2026, '2026-2-02', 'c-started');
insert into entries (id, league_id, user_id, season, slate_key, tiebreaker) values
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 2026, '2026-2-02', 50);

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

-- Featured slates: who sees the set, who edits it, and what it does to picks.
do $$ declare n int; ok boolean; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002'); -- alice, member
  select count(*) into n from slate_games where league_id = '10000000-0000-0000-0000-000000000007';
  perform pg_temp.check('a member reads the curated slate', n = 3);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob, not in the college league
  select count(*) into n from slate_games where league_id = '10000000-0000-0000-0000-000000000007';
  perform pg_temp.check('a non-member cannot see another league''s slate', n = 0);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002'); -- alice
  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000007', 'c-in-1', 'HOME'); ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('a pick on a featured game is accepted', ok);
  begin
    insert into picks (entry_id, game_id, picked) values ('20000000-0000-0000-0000-000000000007', 'c-out', 'HOME'); ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('a pick on a game outside the curated slate is refused', ok);
  begin
    insert into slate_games (league_id, season, slate_key, game_id) values ('10000000-0000-0000-0000-000000000007', 2026, '2026-2-02', 'c-out'); ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('a player cannot add a game to the slate', ok);
  delete from slate_games where league_id = '10000000-0000-0000-0000-000000000007' and game_id = 'c-in-2';
  get diagnostics n = row_count;
  perform pg_temp.check('a player cannot remove a game from the slate', n = 0);

  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001'); -- commissioner
  begin
    insert into slate_games (league_id, season, slate_key, game_id) values ('10000000-0000-0000-0000-000000000007', 2026, '2026-2-02', 'c-out'); ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('the commissioner can swap a game in', ok);
  delete from slate_games where league_id = '10000000-0000-0000-0000-000000000007' and game_id = 'c-in-2';
  get diagnostics n = row_count;
  perform pg_temp.check('the commissioner can swap an unstarted game out', n = 1);
  delete from slate_games where league_id = '10000000-0000-0000-0000-000000000007' and game_id = 'c-started';
  get diagnostics n = row_count;
  perform pg_temp.check('nobody can remove a game that has kicked off', n = 0);
  perform pg_temp.as_admin();
end $$;

-- The tiebreaker locks at the last *featured* kickoff, not the board's.
do $$ declare t timestamptz; begin
  select slate_lock_at('10000000-0000-0000-0000-000000000007', 2026, '2026-2-02') into t;
  -- c-out (5 days) is now in the slate after the swap above; c-in-2 (4 days) is out.
  perform pg_temp.check('slate lock follows the curated set', t > now() + interval '4 days 23 hours');
  delete from slate_games where league_id = '10000000-0000-0000-0000-000000000007' and game_id = 'c-out';
  select slate_lock_at('10000000-0000-0000-0000-000000000007', 2026, '2026-2-02') into t;
  perform pg_temp.check('...and moves when the set changes', t < now() + interval '1 day 1 hour');
  -- An NFL league has no curated set: every game counts, lock is the board's last
  -- kickoff. (The stranger's league: the test league was deleted a few blocks up.)
  select slate_lock_at('10000000-0000-0000-0000-000000000002', 2026, '2026-2-01') into t;
  perform pg_temp.check('a league with no curated set locks at the board''s last game',
    t = (select max(kickoff) from games where sport = 'nfl' and season = 2026 and slate_key = '2026-2-01'));
end $$;

-- Push subscriptions: your own devices and nobody else's; the sent log is server-only.
do $$ declare n int; ok boolean; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002'); -- alice
  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-000000000002', 'https://push.example/alice', 'k', 'a'); ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('alice can register her own device', ok);
  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-000000000003', 'https://push.example/not-bob', 'k', 'a'); ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('alice cannot register a device as bob', ok);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob
  select count(*) into n from push_subscriptions;
  perform pg_temp.check('bob cannot see alice''s devices', n = 0);
  delete from push_subscriptions where endpoint = 'https://push.example/alice';
  get diagnostics n = row_count;
  perform pg_temp.check('bob cannot remove alice''s device', n = 0);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002'); -- alice
  delete from push_subscriptions where endpoint = 'https://push.example/alice';
  get diagnostics n = row_count;
  perform pg_temp.check('alice can remove her own device', n = 1);
  select count(*) into n from push_sent;
  perform pg_temp.check('the push log is invisible to players', n = 0);
  perform pg_temp.as_admin();
end $$;

-- Scoring mode: the commissioner sets it, and only until someone enters.
do $$ declare ok boolean; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000009'); -- stranger runs the Other League, no entries
  begin
    update leagues set scoring = 'spread' where id = '10000000-0000-0000-0000-000000000002'; ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('a league with no entries can switch to the spread', ok);
  begin
    update leagues set scoring = 'nonsense' where id = '10000000-0000-0000-0000-000000000002'; ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('an unknown scoring mode is refused', ok);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001'); -- commissioner of the college league, which has an entry
  begin
    update leagues set scoring = 'spread' where id = '10000000-0000-0000-0000-000000000007'; ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('scoring is locked once the league has an entry', ok);
  perform pg_temp.as_admin();
end $$;

-- Chat: members only; delete your own, or anything as the commissioner.
do $$ declare n int; ok boolean; begin
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002'); -- alice, in the college league
  begin
    insert into messages (league_id, user_id, body) values ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'who has UGA'); ok := true;
  exception when others then ok := false; end;
  perform pg_temp.check('a member can post in their league', ok);
  begin
    insert into messages (league_id, user_id, body) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'hi'); ok := false;
  exception when others then ok := true; end;
  perform pg_temp.check('a non-member cannot post in another league', ok);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003'); -- bob, not in the college league
  select count(*) into n from messages where league_id = '10000000-0000-0000-0000-000000000007';
  perform pg_temp.check('a non-member cannot read the room', n = 0);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001'); -- commissioner
  delete from messages where body = 'who has UGA'; get diagnostics n = row_count;
  perform pg_temp.check('the commissioner can delete a message', n = 1);
  perform pg_temp.as_admin();
end $$;

-- ---------- summary ----------
do $$ declare total int; declare failed int; begin
  -- `ok is not true` so a NULL (a comparison against a missing row) counts as a failure.
  select count(*), count(*) filter (where ok is not true) into total, failed from _t;
  if failed > 0 then
    raise exception 'policy tests: % of % FAILED', failed, total;
  end if;
  raise notice 'policy tests: all % passed', total;
end $$;

rollback;
