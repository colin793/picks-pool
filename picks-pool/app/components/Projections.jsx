import { projections, needsText } from '../../lib/paths';

// "What needs to happen": the board panel for the games that are on right now.
export default function Projections({ games, entries, picks, names, me, draws = false, homeFirst = false, scoring = 'straight' }) {
  const p = projections(games, entries, picks, { me, draws, scoring });
  if (!p.live.length && !p.pending) return null;
  const nameOf = (id) => names.get(id)?.display_name ?? 'Player';
  const matchup = (g) => (homeFirst ? `${g.home_abbr} v ${g.away_abbr}` : `${g.away_abbr} @ ${g.home_abbr}`);
  const sideName = (g, side) => (side === 'HOME' ? g.home_abbr : side === 'AWAY' ? g.away_abbr : 'Draw');
  const branchText = (b) => {
    if (!b.ids.length) return 'nobody on top';
    const who = b.ids.map(nameOf);
    const list = who.length <= 2 ? who.join(' & ') : `${who.slice(0, -1).join(', ')} & ${who.at(-1)}`;
    if (b.ids.length > 1) return `${list} tied`;
    return `${list} leads${b.margin ? ` by ${b.margin}` : ''}`;
  };

  return (
    <section className="card mb-4" data-projections>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="h2">What needs to happen</h2>
        {p.live.length > 0 && <span className="pill pill-warn">Live</span>}
      </div>
      {p.live.length === 0 ? (
        <p className="text-sm text-muted">Nothing is on right now. {p.pending} game{p.pending === 1 ? '' : 's'} still to kick off; the math starts when they do.</p>
      ) : (
        <>
          {p.mine && (
            <p className="mb-3 text-sm font-semibold text-ink">
              {needsText(p.mine, { names, me, homeFirst })}{' '}
              {p.mine.outcomes > 0 && p.mine.outcomes < p.mine.total && (
                <span className="ml-2 font-normal text-muted">on top in {p.mine.outcomes} of {p.mine.total} ways this could go</span>
              )}
            </p>
          )}
          <ul className="divide-y divide-line text-sm">
            {p.live.map(({ game, branches }) => (
              <li key={game.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <span className="w-24 shrink-0 font-display font-semibold">{matchup(game)}</span>
                {branches.map((b) => (
                  <span key={b.side} className="min-w-0 text-ink2">
                    <span className="font-semibold text-ink">{sideName(game, b.side)}</span> → {branchText(b)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          {p.alive.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {p.alive.filter((a) => a.user_id !== me).map((a) => (
                <span key={a.user_id}>{needsText(a, { names, me, homeFirst })}</span>
              ))}
            </div>
          )}
          {p.tooMany && <p className="mt-2 text-xs text-muted">Too many games on at once to run every combination; the per-game lines above still hold.</p>}
          {p.pending > 0 && <p className="mt-2 text-xs text-muted">{p.pending} game{p.pending === 1 ? '' : 's'} still to kick off; other players&rsquo; picks on those stay hidden until then.</p>}
        </>
      )}
    </section>
  );
}
