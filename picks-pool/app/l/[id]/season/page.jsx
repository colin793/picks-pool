import { sb } from '../../../../lib/supabase';
import { syncScores } from '../../../../lib/espn';
import { seasonStats } from '../../../../lib/stats';
import SeasonTable from './season-table';

export const dynamic = 'force-dynamic';

export default async function Season({ params }) {
  const meta = await syncScores();
  const db = sb();
  if (!meta?.season) return <div className="card"><p>No games synced yet.</p></div>;

  const [{ data: games }, { data: entries }, { data: payouts }, { data: members }] = await Promise.all([
    db.from('games').select('*').eq('season', meta.season),
    db.from('entries_board').select('*').eq('league_id', params.id).eq('season', meta.season),
    db.from('payouts').select('*').eq('league_id', params.id).eq('season', meta.season),
    db.from('memberships').select('user_id, profiles(id, display_name, emoji)').eq('league_id', params.id),
  ]);
  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: picks } = entryIds.length
    ? await db.from('picks').select('entry_id, game_id, picked').in('entry_id', entryIds)
    : { data: [] };

  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));
  const stats = seasonStats(games ?? [], entries ?? [], picks ?? [], payouts ?? []).map((s) => ({
    ...s,
    name: names.get(s.user_id)?.display_name ?? 'Player',
    emoji: names.get(s.user_id)?.emoji ?? '',
  }));

  return (
    <>
      <h1>Season scoreboard</h1>
      <div className="card scrollx">
        <SeasonTable rows={stats} />
        <p className="note">
          Tap any column to sort. Average finish counts only completed weeks a player entered;
          ties share the better rank. Money is recorded payouts.
        </p>
      </div>
    </>
  );
}
