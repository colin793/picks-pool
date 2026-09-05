import { slateResults, potFor, money } from '../../lib/stats';
import Standings from './Standings';
import PickGrid from './PickGrid';
import SlatePicker from './SlatePicker';
import ShareButton from './ShareButton';
import Projections from './Projections';

// The "This week" page body. Server page and /dev preview both render this.
export default function BoardView({ league, sport, label, isCurrent, slates, slateKey, games, entries, picks, names, me, now = Date.now(), shareUrl = null, reactions = [], demo = false }) {
  const scoring = league.scoring ?? 'straight';
  const { rows, complete, winners, actualTotal, lastGame, live, finals } = slateResults(games, entries, picks, { scoring });
  const { pot, share } = potFor(entries, league.entry_fee_cents, winners);
  const started = games.filter((g) => new Date(g.kickoff).getTime() <= now).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{sport.name} · {isCurrent ? 'current slate' : 'past slate'}{scoring === 'spread' ? ' · against the spread' : ''}</p>
          <h1 className="h1 mt-1">{label}</h1>
        </div>
        <div className="flex items-center gap-2">
          {shareUrl && rows.length > 0 && <ShareButton url={shareUrl} title={`${league.name} · ${label}`} text={`${league.name} standings, ${label}`} />}
          <SlatePicker slates={slates} current={slateKey} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card !p-3 sm:!p-4">
          <div className="eyebrow">Pot</div>
          <div className="num mt-1 text-2xl sm:text-3xl">{money(pot)}</div>
          <div className="text-xs text-muted">{entries.length} in at {money(league.entry_fee_cents)}</div>
        </div>
        <div className="card !p-3 sm:!p-4">
          <div className="eyebrow">Games</div>
          <div className="num mt-1 text-2xl sm:text-3xl">{finals}<span className="text-lg text-muted sm:text-xl">/{games.length}</span></div>
          <div className="text-xs text-muted">{live ? `${live} live now` : started === games.length ? 'all started' : `${games.length - started} still to kick off`}</div>
        </div>
        <div className="card !p-3 sm:!p-4">
          <div className="eyebrow">{complete ? 'Winner' : 'Tiebreaker'}</div>
          {complete && winners.length ? (
            <>
              <div className="mt-1 truncate font-display text-xl font-bold sm:text-2xl">
                {winners.map((w) => names.get(w.user_id)?.display_name ?? 'Player').join(' & ')}
              </div>
              <div className="text-xs text-muted">{winners.length > 1 ? `split, ${money(share)} each` : `takes ${money(pot)}`}{actualTotal != null ? ` · ${actualTotal} in the finale` : ''}</div>
            </>
          ) : (
            <>
              <div className="mt-1 truncate font-display text-xl font-bold sm:text-2xl">{lastGame ? (sport.homeFirst ? `${lastGame.home_abbr} v ${lastGame.away_abbr}` : `${lastGame.away_abbr} @ ${lastGame.home_abbr}`) : '–'}</div>
              <div className="text-xs text-muted">total {sport.unit} in the last game</div>
            </>
          )}
        </div>
      </div>

      <section className="card mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="h2">Standings</h2>
          {live > 0 && <span className="pill pill-warn">Live</span>}
        </div>
        <Standings rows={rows} names={names} me={me} live={live} complete={complete} winners={winners} feeCents={league.entry_fee_cents} />
        <p className="mt-3 text-xs text-muted">
          {complete
            ? `Final. Tiebreaker target was ${actualTotal} total ${sport.unit}.`
            : 'Ties share the better rank. Other players’ tiebreakers appear once the last game kicks off. Scores refresh on every visit.'}
        </p>
      </section>

      {isCurrent && rows.length > 0 && !complete && (
        <Projections games={games} entries={entries} picks={picks} names={names} me={me} draws={Boolean(sport.draws)} homeFirst={Boolean(sport.homeFirst)} scoring={scoring} />
      )}

      {rows.length > 0 && games.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Everyone&rsquo;s picks</h2>
          <PickGrid games={games} rows={rows} picks={picks} names={names} me={me} now={now} draws={Boolean(sport.draws)} homeFirst={Boolean(sport.homeFirst)} scoring={scoring} reactions={reactions} leagueId={league.id} demo={demo} />
          <p className="mt-3 text-xs text-muted">Each column reveals at that game&rsquo;s kickoff. A dot means hidden until then, a dash means no pick. Tap a revealed pick to react.</p>
        </section>
      )}
    </>
  );
}
