import { leagueContext, currentSlate, loadSlate, slateList } from '../../../../lib/league';
import BoardView from '../../../components/BoardView';
import LiveRefresh from '../../../components/LiveRefresh';
import { refreshPlan } from '../../../../lib/live';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'This week' };

export default async function Board({ params, searchParams }) {
  const { user, league, db, sport } = await leagueContext(params.id);
  const now = await currentSlate(league);
  if (!now) return <div className="card"><p>No games synced yet. Refresh in a minute.</p></div>;

  const slates = await slateList(db, league, now.season);
  const key = slates.some((s) => s.key === searchParams?.slate) ? searchParams.slate : now.key;
  const label = slates.find((s) => s.key === key)?.label ?? now.label;
  const data = await loadSlate(db, league, now.season, key);

  return (
    <>
      <LiveRefresh {...refreshPlan(data.games)} />
      <BoardView
        league={league} sport={sport} label={label} isCurrent={key === now.key}
        slates={slates} slateKey={key} me={user.id} {...data}
        shareUrl={`/l/${league.id}/share?slate=${encodeURIComponent(key)}`}
      />
    </>
  );
}
