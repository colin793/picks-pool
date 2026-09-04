// Shared loaders for the league pages. Every page needs the same few things:
// who is asking, which league, and where the sport's current slate is.

import { redirect } from 'next/navigation';
import { sb, currentUser } from './supabase';
import { syncSport } from './scores/sync';
import { sport as sportOf } from './scores/sports';
import { fetchAll } from './db';
import { admin } from './supabase';
import { featuredGames, applyFeatured } from './featured';

export async function leagueContext(id) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/l/${id}`);
  const db = sb();
  // RLS: only members (and the commissioner) can read the row. A non-member
  // gets nothing and goes home; the invite code stays private.
  const { data: league } = await db.from('leagues').select('*').eq('id', id).maybeSingle();
  if (!league) redirect('/?notmember=1');
  return { user, league, db, isCommish: league.commissioner === user.id, sport: sportOf(league.sport) };
}

// Where "now" is for this league's sport (syncs from ESPN if stale).
export async function currentSlate(league) {
  const state = await syncSport(league.sport);
  if (!state?.slate_key) return null;
  return { season: state.season, key: state.slate_key, label: state.slate_label };
}

// The league's curated set for one slate: slate_games rows. For a sport that
// curates (college football) the first look at a slate writes the set from
// lib/featured.js and it is frozen from then on, except for commissioner
// swaps. The rule is deterministic, so two people opening it at once agree.
export async function ensureSlate(db, league, sport, season, slateKey, board) {
  const { data: rows, error } = await db.from('slate_games').select('game_id, slate_key')
    .eq('league_id', league.id).eq('season', season).eq('slate_key', slateKey);
  if (error) {
    if (!missingTable(error)) throw new Error(error.message);
    console.warn('slate_games missing: run supabase/migrations/2026-09-05-featured-slates.sql');
    return [];
  }
  if (rows?.length || !sport.featured || !board.length) return rows ?? [];
  const chosen = featuredGames(board, { n: sport.featured, ...(sport.conferences ?? {}) });
  const fresh = chosen.map((g) => ({ league_id: league.id, season, slate_key: slateKey, game_id: g.id }));
  // The set belongs to the league, not to whoever opened the page: service role.
  const { error: writeError } = await admin().from('slate_games').upsert(fresh, { onConflict: 'league_id,season,slate_key,game_id' });
  if (writeError) { console.error('curated slate not written:', writeError.message); return []; }
  return fresh.map((r) => ({ game_id: r.game_id, slate_key: slateKey }));
}

// Everything needed to score one slate for one league. entries come from
// the board view so other players' tiebreakers stay hidden until lock.
// `games` is what counts for this league; `board` is everything ESPN had.
export async function loadSlate(db, league, season, slateKey) {
  const sport = sportOf(league.sport);
  const [{ data: board }, { data: entries }, { data: members }] = await Promise.all([
    db.from('games').select('*').eq('sport', league.sport).eq('season', season).eq('slate_key', slateKey).order('kickoff').order('id'),
    db.from('entries_board').select('*').eq('league_id', league.id).eq('season', season).eq('slate_key', slateKey),
    db.from('memberships').select('user_id, profiles(id, display_name, emoji, venmo_handle)').eq('league_id', league.id),
  ]);
  const rows = await ensureSlate(db, league, sport, season, slateKey, board ?? []);
  const games = applyFeatured(board ?? [], rows);
  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: picks } = entryIds.length
    ? await db.from('picks').select('entry_id, game_id, picked').in('entry_id', entryIds)
    : { data: [] };
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));
  return { games, board: board ?? [], curated: rows.length > 0, entries: entries ?? [], picks: picks ?? [], members: members ?? [], names };
}

// A database that has not had the featured-slates migration yet has no
// slate_games table. That is "nothing curated", not a crash: the app must
// keep working whichever order the code deploy and the SQL paste happen in.
function missingTable(error) {
  return error && (error.code === 'PGRST205' || error.code === '42P01' || /slate_games.*(not exist|not find|schema cache)/i.test(error.message ?? ''));
}

// Every curated-slate row for a league's season (empty for sports that play
// the whole board). Pass to applyFeatured() before scoring season-wide data.
export async function featuredRows(db, league, season) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('slate_games').select('slate_key, game_id')
      .eq('league_id', league.id).eq('season', season).order('game_id').range(from, from + 999);
    if (error) {
      if (missingTable(error)) { console.warn('slate_games missing: run supabase/migrations/2026-09-05-featured-slates.sql'); return []; }
      throw new Error(error.message);
    }
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

// Slates this league's sport has games for this season, newest first.
export async function slateList(db, league, season) {
  const data = await fetchAll(() => db
    .from('games').select('slate_key, slate_label, kickoff')
    .eq('sport', league.sport).eq('season', season).order('kickoff'));
  const seen = new Map();
  for (const g of data) if (!seen.has(g.slate_key)) seen.set(g.slate_key, g.slate_label);
  return [...seen.entries()].map(([key, label]) => ({ key, label })).reverse();
}

// Season-wide rows for one league: games, entries, picks, payouts. Paged, and
// picks come through an embedded filter instead of a giant .in() list.
export async function loadSeason(db, league, season, { raw = false } = {}) {
  const [board, rows, entries, picks, payouts] = await Promise.all([
    fetchAll(() => db.from('games').select('*').eq('sport', league.sport).eq('season', season).order('kickoff').order('id')),
    featuredRows(db, league, season),
    fetchAll(() => db.from(raw ? 'entries' : 'entries_board').select('*').eq('league_id', league.id).eq('season', season).order('created_at')),
    fetchAll(() => db.from('picks').select('entry_id, game_id, picked, entries!inner(league_id, season)')
      .eq('entries.league_id', league.id).eq('entries.season', season).order('id')),
    fetchAll(() => db.from('payouts').select('*').eq('league_id', league.id).eq('season', season).order('created_at', { ascending: false })),
  ]);
  return { games: applyFeatured(board, rows), entries, picks: picks.map(({ entries: _e, ...p }) => p), payouts };
}
