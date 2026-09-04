-- Drops everything Picks Pool created (v1 or v2). Data is gone afterwards.
-- Run this, then schema.sql. Only for a database that holds test data.

drop view if exists public.entries_board;
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.recaps_sent cascade;  -- v2
drop table if exists public.push_sent cascade;    -- v2.2
drop table if exists public.push_subscriptions cascade; -- v2.2
drop table if exists public.payouts cascade;
drop table if exists public.picks cascade;
drop table if exists public.entries cascade;
drop table if exists public.slate_games cascade; -- v2.1
drop table if exists public.games cascade;
drop table if exists public.meta cascade;         -- v1
drop table if exists public.sport_state cascade;  -- v2
drop table if exists public.memberships cascade;
drop table if exists public.leagues cascade;
drop table if exists public.profiles cascade;
drop table if exists public.sports cascade;
drop function if exists public.handle_new_user();
drop function if exists public.entries_guard();
drop function if exists public.leagues_guard();
drop function if exists public.is_member(uuid);
drop function if exists public.is_commissioner(uuid);
drop function if exists public.shares_league_with(uuid);
drop function if exists public.slate_lock_at(uuid, int, text);
drop function if exists public.in_slate(uuid, int, text, text);
drop function if exists public.entry_locked(uuid);
drop function if exists public.pick_open(uuid, text);
drop function if exists public.pick_open(uuid, text, text);
