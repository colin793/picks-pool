// Shared loaders for the league pages. Every page needs the same few things:
// who is asking, which league, and where the sport's current slate is.

import { redirect } from 'next/navigation';
import { sb, currentUser } from './supabase';
import { syncSport } from './scores/sync';
import { sport as sportOf } from './scores/sports';

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

// Everything needed to score one slate for one league. entries come from
// the board view so other players' tiebreakers stay hidden until lock.
export async function loadSlate(db, league, season, slateKey) {
  const [{ data: games }, { data: entries }, { data: members }] = await Promise.all([
    db.from('games').select('*').eq('sport', league.sport).eq('season', season).eq('slate_key', slateKey).order('kickoff'),
    db.from('entries_board').select('*').eq('league_id', league.id).eq('season', season).eq('slate_key', slateKey),
    db.from('memberships').select('user_id, profiles(id, display_name, emoji, venmo_handle)').eq('league_id', league.id),
  ]);
  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: picks } = entryIds.length
    ? await db.from('picks').select('entry_id, game_id, picked').in('entry_id', entryIds)
    : { data: [] };
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));
  return { games: games ?? [], entries: entries ?? [], picks: picks ?? [], members: members ?? [], names };
}

// Slates this league's sport has games for this season, newest first.
export async function slateList(db, league, season) {
  const { data } = await db
    .from('games').select('slate_key, slate_label, kickoff')
    .eq('sport', league.sport).eq('season', season).order('kickoff');
  const seen = new Map();
  for (const g of data ?? []) if (!seen.has(g.slate_key)) seen.set(g.slate_key, g.slate_label);
  return [...seen.entries()].map(([key, label]) => ({ key, label })).reverse();
}
