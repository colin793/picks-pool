import { leagueContext } from '../../../../lib/league';
import ChatView from '../../../components/ChatView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chat' };

export default async function Chat({ params }) {
  const { user, league, db, isCommish } = await leagueContext(params.id);
  const [{ data: messages }, { data: members }] = await Promise.all([
    db.from('messages').select('*').eq('league_id', league.id).order('created_at', { ascending: false }).limit(200), // RLS: members
    db.from('memberships').select('user_id, profiles(id, display_name, emoji)').eq('league_id', league.id),
  ]);
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));
  return <ChatView leagueId={league.id} messages={(messages ?? []).reverse()} names={names} me={user.id} isCommish={isCommish} />;
}
