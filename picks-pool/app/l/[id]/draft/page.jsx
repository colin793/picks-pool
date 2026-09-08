import { redirect } from 'next/navigation';
import { leagueContext, currentSlate, loadDraft } from '../../../../lib/league';
import DraftView from '../../../components/DraftView';
import LiveRefresh from '../../../components/LiveRefresh';
import { refreshPlan } from '../../../../lib/live';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Draft' };

export default async function Draft({ params }) {
  const { user, league, db, sport } = await leagueContext(params.id);
  if (!league.draft) redirect(`/l/${params.id}`);
  const now = await currentSlate(league);
  if (!now) return <div className="card"><p>No games synced yet. Refresh in a minute.</p></div>;
  const data = await loadDraft(db, league, now.season, now.key, user.id);
  if (data.missing) {
    return <div className="card"><p className="text-sm text-muted">The weekly draft is switched on but its database tables are not there yet. Commissioner: run <code>supabase/migrations/2026-09-10-draft.sql</code> in the Supabase SQL Editor.</p></div>;
  }
  return (
    <>
      <LiveRefresh {...refreshPlan(data.games)} />
      <DraftView league={league} sport={sport} slate={now} me={user.id} serverNow={Date.now()} {...data} />
    </>
  );
}
