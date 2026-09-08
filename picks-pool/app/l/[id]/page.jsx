import { leagueContext, currentSlate, loadSlate } from '../../../lib/league';
import { venmoLink, money } from '../../../lib/stats';
import PicksForm from '../../components/PicksForm';
import LiveRefresh from '../../components/LiveRefresh';
import { refreshPlan } from '../../../lib/live';
import { survivorStandings, entriesOpen } from '../../../lib/survivor';
import Link from 'next/link';

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

  // A one-line nudge when the survivor pool wants something from you this
  // week. Cheap on purpose: your own seat and picks, plus the games behind them.
  let survivorNote = null;
  if (league.survivor && games.some((g) => g.kickoff > new Date().toISOString())) {
    const seat = { league_id: league.id, user_id: user.id, season: slate.season };
    const [{ data: sEntry, error: sErr }, { data: sMine }, { data: sAll }] = await Promise.all([
      db.from('survivor_entries').select('user_id, paid').match(seat).maybeSingle(),
      db.from('survivor_picks').select('*').match(seat),
      db.from('survivor_picks').select('slate_key').eq('league_id', league.id).eq('season', slate.season), // RLS: what the viewer may see
    ]);
    if (!sErr) {
      const ids = (sMine ?? []).map((p) => p.game_id).filter((id) => !games.some((g) => g.id === id));
      const { data: extra } = ids.length ? await db.from('games').select('*').in('id', ids) : { data: [] };
      const known = [...games, ...(extra ?? [])];
      if (sEntry) {
        const me = survivorStandings(known, [sEntry], sMine ?? []).rows[0];
        if (me.status === 'alive' && !me.cells.get(slate.key)) survivorNote = `Survivor: you have no team for ${slate.label} yet.`;
      } else if (entriesOpen(sAll ?? [], games)) {
        survivorNote = 'This league runs a survivor pool. Take a seat before the first week locks.';
      }
    }
  }

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
            {league.scoring === 'spread' && ' · against the spread'}
          </p>
          <h1 className="h1 mt-1">{slate.label} picks</h1>
        </div>
        {entry && !entry.paid && payLink && (
          <a className="btn" href={payLink}>Pay {money(league.entry_fee_cents)} on Venmo</a>
        )}
        {entry?.paid && <span className="pill pill-good">Entry paid</span>}
        {entry && !entry.paid && !payLink && <span className="pill pill-warn">{money(league.entry_fee_cents)} due to the commissioner</span>}
      </div>

      {survivorNote && (
        <Link href={`/l/${league.id}/survivor`} className="mb-4 flex items-center gap-2 rounded-lg border border-warn/40 bg-warnsoft px-3 py-2 text-sm text-warn hover:brightness-95">
          <span className="min-w-0 flex-1">{survivorNote}</span><span className="shrink-0 font-semibold">Pick a team &rarr;</span>
        </Link>
      )}

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
          scoring={league.scoring}
        />
      )}
    </>
  );
}
