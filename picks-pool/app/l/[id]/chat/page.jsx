import { leagueContext, currentSlate, loadSlate } from '../../../../lib/league';
import ChatView from '../../../components/ChatView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chat' };

export default async function Chat({ params }) {
  const { user, league, db, isCommish, sport } = await leagueContext(params.id);
  const [{ data: messages }, { data: members }] = await Promise.all([
    db.from('messages').select('*').eq('league_id', league.id).order('created_at', { ascending: false }).limit(200), // RLS: members
    db.from('memberships').select('user_id, profiles(id, display_name, emoji)').eq('league_id', league.id),
  ]);
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));

  // Call it: the room's calls and the games they are on. An older database
  // without the calls table simply shows the room without them.
  let calls = [], games = [];
  if (league.calls !== false) {
    const now = await currentSlate(league);
    const { data: rows } = await db.from('calls').select('*').eq('league_id', league.id).order('created_at', { ascending: false }).limit(200); // RLS: members
    calls = rows ?? [];
    if (now) games = (await loadSlate(db, league, now.season, now.key)).games;
    const missing = calls.map((c) => c.game_id).filter((id) => !games.some((g) => g.id === id));
    if (missing.length) { const { data: more } = await db.from('games').select('*').in('id', missing); games = [...games, ...(more ?? [])]; }
  }
  return <ChatView leagueId={league.id} messages={(messages ?? []).reverse()} names={names} me={user.id} isCommish={isCommish} calls={calls} games={games} homeFirst={Boolean(sport.homeFirst)} callsOn={Boolean(league.calls)} />;
}
