import { redirect } from 'next/navigation';
import { leagueContext, currentSlate, loadSurvivor } from '../../../../lib/league';
import SurvivorView from '../../../components/SurvivorView';
import LiveRefresh from '../../../components/LiveRefresh';
import { refreshPlan } from '../../../../lib/live';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Survivor' };

export default async function Survivor({ params }) {
  const { user, league, db, sport } = await leagueContext(params.id);
  if (!league.survivor) redirect(`/l/${params.id}`);
  const now = await currentSlate(league);
  if (!now) return <div className="card"><p>No games synced yet. Refresh in a minute.</p></div>;
  const data = await loadSurvivor(db, league, now.season);
  if (data.missing) {
    return <div className="card"><p className="text-sm text-muted">The survivor pool is switched on but its database tables are not there yet. Commissioner: run <code>supabase/migrations/2026-09-08-survivor.sql</code> in the Supabase SQL Editor.</p></div>;
  }
  return (
    <>
      <LiveRefresh {...refreshPlan(data.games.filter((g) => g.slate_key === now.key))} />
      <SurvivorView league={league} sport={sport} slate={now} me={user.id} serverNow={Date.now()} base={`/l/${league.id}`} {...data} />
    </>
  );
}
