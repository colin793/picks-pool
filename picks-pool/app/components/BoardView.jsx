import { slateResults, potFor, money } from '../../lib/stats';
import Standings from './Standings';
import PickGrid from './PickGrid';
import SlatePicker from './SlatePicker';
import ShareButton from './ShareButton';
import Projections from './Projections';
import { rivalryText, finaleText } from '../../lib/moments';
import { Confetti } from './Pops';
import { slateDuels } from '../../lib/duels';

// The "This week" page body. Server page and /dev preview both render this.
export default function BoardView({ league, sport, label, isCurrent, slates, slateKey, games, entries, picks, names, me, now = Date.now(), shareUrl = null, reactions = [], demo = false }) {
  const scoring = league.scoring ?? 'straight';
  const lock = Boolean(league.lock_of_week);
  const { rows, complete, winners, actualTotal, lastGame, live, finals } = slateResults(games, entries, picks, { scoring, lock });
  // Duels: the slate's index in the season is the round, so pairings never repeat until everyone has met.
  const round = Math.max(0, slates.length - 1 - slates.findIndex((s) => s.key === slateKey));
  const duels = league.duels && games.length ? slateDuels(games, entries, rows, round, { complete }) : null;
  const { pot, share } = potFor(entries, league.entry_fee_cents, winners);
  const started = games.filter((g) => new Date(g.kickoff).getTime() <= now).length;
  const rivalry = rivalryText(rows, me, names);
  const finale = isCurrent && !complete ? finaleText(games, entries, picks, names, { scoring, homeFirst: Boolean(sport.homeFirst), me, lock }) : null;
  const iWon = complete && winners.some((w) => w.user_id === me);

  return (
    <>
      {iWon && !demo && <Confetti id={`won-${league.id}-${slateKey}`} />}
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

      {finale && (
        <div className="mb-4 rounded-xl border border-warn/40 bg-warnsoft px-4 py-3">
          <div className="font-display text-lg font-bold leading-tight text-warn">{finale.title}</div>
          <div className="text-sm text-ink2">{finale.text}</div>
        </div>
      )}

      <section className="card mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="h2">Standings</h2>
          {rivalry && !complete && <span className="text-xs font-semibold text-ink2">{rivalry}</span>}
          {live > 0 && <span className="pill pill-warn">Live</span>}
        </div>
        <Standings rows={rows} names={names} me={me} live={live} complete={complete} winners={winners} feeCents={league.entry_fee_cents} lock={lock} />
        <p className="mt-3 text-xs text-muted">
          {complete
            ? `Final. Tiebreaker target was ${actualTotal} total ${sport.unit}.`
            : 'Ties share the better rank. Other players’ tiebreakers appear once the last game kicks off. Scores refresh on every visit.'}
          {lock ? ' Lock of the week: a right pick on your lock counts double.' : ''}
          {league.duty ? <> <span className="font-semibold text-ink2">Loser&rsquo;s duty:</span> {league.duty}</> : ''}
        </p>
      </section>

      {duels && (
        <section className="card mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h2">Duels</h2>
            <span className="text-xs text-muted">{complete ? 'Final' : 'Points so far'}</span>
          </div>
          {duels.duels.length === 0 ? (
            <p className="text-sm text-muted">Pairings form at the first kickoff, among everyone who has entered by then.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {duels.duels.map((d) => {
                const side = (id, pts) => {
                  const p = names.get(id);
                  const won = d.winner === id, ahead = d.leading === id;
                  return (
                    <span className={`flex min-w-0 flex-1 items-center gap-1.5 ${id === me ? 'font-semibold' : ''} ${won ? 'text-good' : ahead ? 'text-accent' : ''}`}>
                      <span>{p?.emoji}</span><span className="truncate">{p?.display_name ?? 'Player'}</span><span className="num ml-auto text-base">{pts}</span>
                    </span>
                  );
                };
                return (
                  <li key={`${d.a}-${d.b}`} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${[d.a, d.b].includes(me) ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface2/60'}`}>
                    {side(d.a, d.aPts)}
                    <span className="text-xs font-bold text-muted">{d.tie ? 'TIE' : 'vs'}</span>
                    {side(d.b, d.bPts)}
                  </li>
                );
              })}
            </ul>
          )}
          {duels.bye && <p className="mt-2 text-xs text-muted">{names.get(duels.bye)?.display_name ?? 'Someone'} has the bye this week.</p>}
          <p className="mt-2 text-xs text-muted">One rival a week, everyone in turn. More points than them and the duel is yours; season records are on the Season tab.</p>
        </section>
      )}

      {isCurrent && rows.length > 0 && !complete && (
        <Projections games={games} entries={entries} picks={picks} names={names} me={me} draws={Boolean(sport.draws)} homeFirst={Boolean(sport.homeFirst)} scoring={scoring} lock={lock} />
      )}

      {rows.length > 0 && games.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Everyone&rsquo;s picks</h2>
          <PickGrid games={games} rows={rows} picks={picks} names={names} me={me} now={now} draws={Boolean(sport.draws)} homeFirst={Boolean(sport.homeFirst)} scoring={scoring} reactions={reactions} leagueId={league.id} demo={demo} lock={lock} />
          <p className="mt-3 text-xs text-muted">Each column reveals at that game&rsquo;s kickoff. A dot means hidden until then, a dash means no pick. Tap a revealed pick to react.</p>
        </section>
      )}
    </>
  );
}
