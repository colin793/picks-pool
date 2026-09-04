import { leagueContext, currentSlate, loadSlate } from '../../../lib/league';
import { venmoLink, money } from '../../../lib/stats';
import PicksForm from '../../components/PicksForm';
import LiveRefresh from '../../components/LiveRefresh';
import { refreshPlan } from '../../../lib/live';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Picks' };

export default async function PicksPage({ params }) {
  const { user, league, db, sport } = await leagueContext(params.id);
  const slate = await currentSlate(league);
  if (!slate) {
    return <div className="card"><p>No games synced yet for {sport.name}. ESPN usually shows up within a minute; refresh.</p></div>;
  }

  const { games, board, curated, entries, picks: visible } = await loadSlate(db, league, slate.season, slate.key);
  const entry = entries.find((e) => e.user_id === user.id) ?? null;
  const { data: myPicks } = entry
    ? await db.from('picks').select('game_id, picked').eq('entry_id', entry.id)
    : { data: [] };

  const payLink = league.venmo_handle && league.entry_fee_cents > 0
    ? venmoLink(league.venmo_handle, league.entry_fee_cents, `${league.name} ${slate.label}`)
    : null;

  return (
    <>
      <LiveRefresh {...refreshPlan(games)} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            {sport.name} · {entries.length} in this {sport.mode === 'week' ? 'week' : 'slate'}
            {curated && ` · ${games.length} of ${board.length} games featured`}
          </p>
          <h1 className="h1 mt-1">{slate.label} picks</h1>
        </div>
        {entry && !entry.paid && payLink && (
          <a className="btn" href={payLink}>Pay {money(league.entry_fee_cents)} on Venmo</a>
        )}
        {entry?.paid && <span className="pill pill-good">Entry paid</span>}
        {entry && !entry.paid && !payLink && <span className="pill pill-warn">{money(league.entry_fee_cents)} due to the commissioner</span>}
      </div>

      {games.length === 0 ? (
        <div className="card"><p className="text-muted">No games on this slate yet.</p></div>
      ) : (
        <PicksForm
          leagueId={league.id}
          season={slate.season}
          slate={slate.key}
          games={games}
          initialPicks={Object.fromEntries((myPicks ?? []).map((p) => [p.game_id, p.picked]))}
          initialTiebreaker={entry?.tiebreaker ?? ''}
          entry={entry}
          unit={sport.unit}
          draws={Boolean(sport.draws)}
          homeFirst={Boolean(sport.homeFirst)}
          serverNow={Date.now()}
          allPicks={visible}
          entryCount={entries.length}
        />
      )}
    </>
  );
}
