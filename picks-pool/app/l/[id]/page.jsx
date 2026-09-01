import { sb, currentUser } from '../../../lib/supabase';
import { syncScores } from '../../../lib/espn';
import { venmoLink, money } from '../../../lib/stats';
import PicksForm from './picks-form';

export const dynamic = 'force-dynamic';

export default async function PicksPage({ params }) {
  const user = await currentUser();
  const meta = await syncScores();
  const db = sb();

  if (!meta?.week) {
    return <div className="card"><p>No games synced yet. ESPN should show up within a couple of minutes; refresh.</p></div>;
  }

  const [{ data: games }, { data: league }] = await Promise.all([
    db.from('games').select('*').eq('season', meta.season).eq('week', meta.week).order('kickoff'),
    db.from('leagues').select('*').eq('id', params.id).single(),
  ]);
  const { data: entry } = await db
    .from('entries').select('*')
    .eq('league_id', params.id).eq('user_id', user.id)
    .eq('season', meta.season).eq('week', meta.week).maybeSingle();
  const { data: myPicks } = entry
    ? await db.from('picks').select('game_id, picked').eq('entry_id', entry.id)
    : { data: [] };

  const payLink = league.venmo_handle
    ? venmoLink(league.venmo_handle, league.entry_fee_cents, `${league.name} week ${meta.week}`)
    : null;

  return (
    <>
      <h1>Week {meta.week} picks</h1>
      {entry && !entry.paid && payLink && (
        <div className="card row">
          <span className="grow">Entry fee: <strong>{money(league.entry_fee_cents)}</strong> <span className="badge red">unpaid</span></span>
          <a className="btn" href={payLink}>Pay on Venmo</a>
        </div>
      )}
      {entry?.paid && <p className="note">Week {meta.week} entry paid. <span className="badge green">paid</span></p>}
      <PicksForm
        leagueId={params.id}
        season={meta.season}
        week={meta.week}
        games={games ?? []}
        initialPicks={Object.fromEntries((myPicks ?? []).map((p) => [p.game_id, p.picked]))}
        initialTiebreaker={entry?.tiebreaker ?? ''}
        entered={Boolean(entry)}
      />
    </>
  );
}
