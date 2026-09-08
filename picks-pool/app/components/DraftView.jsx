import { slateTeams, draftResults } from '../../lib/draft';
import LocalTime from './LocalTime';
import RankingEditor from './RankingEditor';

const RESULT = { won: 'bg-goodsoft text-good ring-1 ring-good/40', lost: 'bg-badsoft text-bad opacity-70', tied: 'bg-badsoft text-bad opacity-70', live: 'bg-accent/10 text-accent ring-1 ring-accent/50', pending: 'bg-surface2 text-ink2' };

// The Draft tab. Before the first kickoff: rank the teams, save to be in.
// After: what the draft dealt, and the week's standings from it.
export default function DraftView({ league, sport, slate, games, names, ran, picks, mine, entered, me, now = Date.now(), serverNow, fixedNow, demo = false }) {
  const teams = slateTeams(games);
  const first = games.length ? [...games].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0] : null;
  const open = !ran && first && new Date(first.kickoff).getTime() > now;
  const results = ran ? draftResults(picks, games) : null;
  const name = (id) => names.get(id)?.display_name ?? 'Player';
  const per = results && results.rows.length ? Math.max(...results.rows.map((r) => r.teams.length)) : 0;
  const rounds = per ? Array.from({ length: per }, (_, i) => i + 1) : [];
  const order = results ? picks.filter((p) => p.round === 1).sort((a, b) => a.pick_no - b.pick_no).map((p) => p.user_id) : [];
  const undrafted = ran ? teams.filter((t) => !picks.some((p) => p.game_id === t.game.id && p.side === t.side)) : [];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            {sport.name} · {ran ? `drafted${results?.rows.length ? ` · ${results.rows.length} in` : ''}` : `${entered} in so far`}
            {!ran && first ? <> · runs at <LocalTime iso={first.kickoff} /></> : ''}
          </p>
          <h1 className="h1 mt-1">{slate.label} draft</h1>
        </div>
        {results?.complete && results.winners.length > 0 && (
          <span className="pill pill-good">{results.winners.map((w) => name(w.user_id)).join(' & ')} took the week</span>
        )}
      </div>

      {!ran && (
        <section className="card mb-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">Your ranking</h2>
            {mine ? <span className="pill pill-good">You&rsquo;re in</span> : <span className="pill pill-warn">Not in yet</span>}
          </div>
          <p className="mb-3 text-sm text-ink2">
            Put the teams you want at the top. Saving puts you in. At the first kickoff the draft deals {teams.length} teams round by round in a random order that reverses each round, giving everyone their highest-ranked team still on the board.
            {teams.length && entered ? ` With ${entered} in, that is ${Math.floor(teams.length / entered)} team${Math.floor(teams.length / entered) === 1 ? '' : 's'} each.` : ''}
          </p>
          {!open ? (
            <p className="text-sm text-muted">Rankings are closed: the first game has kicked off. The draft runs on the next refresh.</p>
          ) : (
            <RankingEditor leagueId={league.id} season={slate.season} slateKey={slate.key} teams={teams.map((t) => ({ key: t.key, abbr: t.abbr, name: t.name, logo: t.logo, color: t.color, edge: t.edge, kickoff: t.game.kickoff, opp: t.side === 'HOME' ? `vs ${t.game.away_abbr}` : `@ ${t.game.home_abbr}` }))}
              initial={mine?.ranking ?? null} entered={Boolean(mine)} demo={demo} />
          )}
        </section>
      )}

      {ran && results && (
        <>
          <section className="card mb-4">
            <h2 className="h2 mb-2">This week</h2>
            {results.rows.length === 0 ? (
              <p className="text-sm text-muted">Nobody saved a ranking, so nobody was dealt in. Next {sport.mode === 'week' ? 'week' : 'slate'}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl min-w-max">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th className="sticky left-0 z-10 bg-surface">Player</th>
                      <th className="text-right">Won</th>
                      <th className="text-right">Lost</th>
                      <th className="text-right" title="Total margin of the teams that won: the tiebreak">Margin</th>
                      {rounds.map((r) => <th key={r} className="text-center">R{r}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {results.rows.map((r) => (
                      <tr key={r.user_id} className={r.user_id === me ? 'bg-accent/5 font-semibold' : ''}>
                        <td className="num text-base text-muted">{r.rank}</td>
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-surface"><span className="mr-1.5">{names.get(r.user_id)?.emoji}</span>{name(r.user_id)}{results.complete && results.winners.some((w) => w.user_id === r.user_id) && <span className="pill pill-good ml-2">Winner</span>}</td>
                        <td className="num text-right text-base text-good">{r.wins}</td>
                        <td className="num text-right text-base text-muted">{r.losses}</td>
                        <td className="num text-right text-muted">{r.margin || '–'}</td>
                        {rounds.map((round) => {
                          const t = r.teams.find((x) => x.round === round);
                          return (
                            <td key={round} className="p-1 text-center">
                              {t ? <span className={`inline-block min-w-[38px] rounded px-1.5 py-1 font-display text-xs font-bold tracking-wide ${RESULT[t.result]}`} title={t.result} style={t.result === 'pending' && t.game ? { boxShadow: `inset 0 -3px 0 ${t.side === 'HOME' ? t.game.home_color : t.game.away_color}` } : undefined}>{t.abbr}</span> : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">
              A drafted team that wins is a point; a tie is not. Most points takes the {sport.mode === 'week' ? 'week' : 'slate'}; the total margin of your winners breaks a tie.
              {order.length ? ` Draft order was ${order.map(name).join(', ')}, then back the other way.` : ''}
              {undrafted.length ? ` Undrafted: ${undrafted.map((t) => t.abbr).join(', ')}.` : ''}
            </p>
          </section>
        </>
      )}
    </>
  );
}
