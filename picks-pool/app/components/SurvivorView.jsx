import Link from 'next/link';
import { survivorStandings, entriesOpen, outText, survivorPot } from '../../lib/survivor';
import { money } from '../../lib/stats';
import SurvivorPicker from './SurvivorPicker';

const RESULT_STYLE = {
  won: 'bg-goodsoft text-good ring-1 ring-good/40',
  out: 'bg-badsoft text-bad opacity-80',
  live: 'bg-accent/10 text-accent ring-1 ring-accent/50',
  pending: 'bg-surface2 text-ink2',
};

// The Survivor tab: your seat and this week's pick up top, everyone's road
// below. Server page and /dev preview both render this.
export default function SurvivorView({ league, sport, slate, games, entries, picks, names, me, now = Date.now(), serverNow, fixedNow, demo = false, base = '' }) {
  const standings = survivorStandings(games, entries, picks, { now });
  const { rows, alive, complete, winners, slates } = standings;
  const open = entriesOpen(picks, games, now);
  const mine = rows.find((r) => r.user_id === me) ?? null;
  const entered = Boolean(mine);
  const thisWeek = games.filter((g) => g.slate_key === slate.key).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff) || String(a.id).localeCompare(String(b.id)));
  const myPick = mine?.cells.get(slate.key) ?? null;
  const used = mine ? [...mine.used.entries()].filter(([, k]) => k !== slate.key).map(([team, k]) => [team, slates.find((s) => s.key === k)?.label ?? k]) : [];
  const { pot, share } = survivorPot(entries, league.survivor_fee_cents ?? 0, winners);
  const canPick = (entered && mine.status === 'alive') || (!entered && open);
  const short = (label) => String(label).replace(/^Week /, 'Wk ');
  const name = (id) => names.get(id)?.display_name ?? 'Player';

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{sport.name} · {entries.length ? `${alive} of ${entries.length} still alive` : 'nobody in yet'}{pot ? ` · ${money(pot)} pot` : ''}</p>
          <h1 className="h1 mt-1">Survivor</h1>
        </div>
        {mine && (mine.status === 'alive'
          ? <span className="pill pill-good">Alive{mine.survived ? ` · ${mine.survived} straight` : ''}</span>
          : <span className="pill pill-bad">{outText(mine)}</span>)}
      </div>

      {complete && (
        <section className="card mb-4 border-good/40">
          <h2 className="h2 mb-1">{winners.length > 1 ? 'Last ones standing' : 'Last one standing'}</h2>
          <p className="text-sm">
            {winners.map((w) => name(w.user_id)).join(' and ')} {winners.length > 1 ? `fell together in ${winners[0].outLabel} and split the pot, ${money(share)} each` : `outlasted everyone and takes ${money(pot)}`}.
          </p>
        </section>
      )}

      {!complete && (
        <section className="card mb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">{slate.label}: {canPick ? 'your team' : 'this week'}</h2>
            {mine && !mine.paid && league.survivor_fee_cents > 0 && <span className="pill pill-bad">{money(league.survivor_fee_cents)} buy-in due</span>}
            {mine?.paid && <span className="pill pill-good">Buy-in paid</span>}
          </div>
          {canPick ? (
            <>
              {!entered && <p className="mb-3 text-sm text-ink2">Buy-in {league.survivor_fee_cents ? money(league.survivor_fee_cents) : 'free'}, once for the season. Your first pick takes your seat.{league.venmo_handle && league.survivor_fee_cents > 0 ? ` Venmo ${league.venmo_handle}.` : ''}</p>}
              {thisWeek.length === 0
                ? <p className="text-sm text-muted">No games on this slate yet.</p>
                : <SurvivorPicker leagueId={league.id} season={slate.season} slateKey={slate.key} slateLabel={slate.label} games={thisWeek} used={used}
                    initial={myPick ? { gameId: myPick.pick.game_id, side: myPick.pick.picked } : null} entered={entered} open={open}
                    serverNow={serverNow} fixedNow={fixedNow} homeFirst={Boolean(sport.homeFirst)} demo={demo} />}
            </>
          ) : mine ? (
            <p className="text-sm text-muted">{outText(mine)}. Watch the rest fall.</p>
          ) : (
            <p className="text-sm text-muted">Entries closed when the pool&rsquo;s first {sport.mode === 'week' ? 'week' : 'slate'} locked. Next season.</p>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="h2 mb-2">Everyone&rsquo;s road</h2>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Nobody has a seat yet. The first pick opens the pool; entries close when that {sport.mode === 'week' ? 'week' : 'slate'} locks.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-max">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface">Player</th>
                  <th>Status</th>
                  {slates.map((s) => <th key={s.key} className="text-center font-display text-xs normal-case tracking-normal">{short(s.label)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = names.get(r.user_id);
                  return (
                    <tr key={r.user_id} className={r.user_id === me ? 'bg-accent/5' : ''}>
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-surface font-semibold"><span className="mr-1">{p?.emoji}</span>{p?.display_name ?? 'Player'}{!r.paid && league.survivor_fee_cents > 0 && <span className="pill pill-bad ml-2">due</span>}</td>
                      <td className="whitespace-nowrap text-xs">
                        {r.status === 'alive'
                          ? <span className="font-semibold text-good">Alive</span>
                          : <span className="text-bad" title={outText(r)}>Out · {short(r.outLabel)}</span>}
                      </td>
                      {slates.map((s) => {
                        const cell = r.cells.get(s.key);
                        const kicked = games.filter((g) => g.slate_key === s.key).every((g) => new Date(g.kickoff).getTime() <= now);
                        if (cell === undefined) return <td key={s.key} className="text-center text-muted"><span title={r.status === 'out' ? 'Already out' : 'Not yet'}>{r.status === 'out' ? '' : '·'}</span></td>;
                        if (cell === null) return <td key={s.key} className="text-center text-muted">{kicked ? <span title="No pick">–</span> : <span title="Hidden until kickoff">·</span>}</td>;
                        const color = cell.game ? (cell.pick.picked === 'HOME' ? cell.game.home_color : cell.game.away_color) : '';
                        return (
                          <td key={s.key} className="p-1 text-center">
                            <span className={`inline-block min-w-[38px] rounded px-1.5 py-1 font-display text-xs font-bold tracking-wide ${RESULT_STYLE[cell.result]}`}
                              style={cell.result === 'pending' && color ? { boxShadow: `inset 0 -3px 0 ${color}` } : undefined}
                              title={cell.result === 'won' ? 'Won' : cell.result === 'out' ? 'Out' : cell.result === 'live' ? 'In progress' : 'Not started'}>
                              {cell.team}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          One team a {sport.mode === 'week' ? 'week' : 'slate'}, straight up, never the same team twice. Lose or tie and you are out; miss a {sport.mode === 'week' ? 'week' : 'slate'} and you are out.
          Picks show once their game kicks off. Last one standing takes the pot; if the last few fall in the same {sport.mode === 'week' ? 'week' : 'slate'}, they split it.
          {base ? <> The pick&rsquo;em lives on <Link className="underline" href={base}>Picks</Link>.</> : ''}
        </p>
      </section>
    </>
  );
}
