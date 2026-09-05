import { FlashPill } from './Flash';
import { outcome, ahead as aheadOf } from '../../lib/stats';
import ReactCell from './ReactCell';

// Everyone's picks, one row per player, one column per game. RLS decides
// what is visible: your own picks always, others' once the game kicks off,
// so a hidden pick is simply absent from `picks`.
// reactions: rows of { entry_id, game_id, user_id, emoji } the viewer may see.
export default function PickGrid({ games, rows, picks, names, me, now = Date.now(), draws = false, homeFirst = false, scoring = 'straight', reactions = [], leagueId = null, demo = false }) {
  const rx = new Map(); // `${entry}:${game}` -> { counts, mine }
  for (const r of reactions) {
    const k = `${r.entry_id}:${r.game_id}`;
    if (!rx.has(k)) rx.set(k, { counts: {}, mine: null });
    const cell = rx.get(k);
    cell.counts[r.emoji] = (cell.counts[r.emoji] ?? 0) + 1;
    if (r.user_id === me) cell.mine = r.emoji;
  }
  const byEntry = new Map();
  for (const p of picks) {
    if (!byEntry.has(p.entry_id)) byEntry.set(p.entry_id, new Map());
    byEntry.get(p.entry_id).set(p.game_id, p.picked);
  }
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-max">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface">Player</th>
            {games.map((g) => {
              const started = new Date(g.kickoff).getTime() <= now;
              return (
                <th key={g.id} className={`text-center font-display text-xs normal-case tracking-normal ${started ? 'text-ink2' : 'text-muted'}`}>
                  <span className="block">{homeFirst ? g.home_abbr : g.away_abbr}</span>
                  <span className="block text-[10px] text-muted">{homeFirst ? 'v' : '@'}</span>
                  <span className="block">{homeFirst ? g.away_abbr : g.home_abbr}</span>
                </th>
              );
            })}
            <th className="text-right">W</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = byEntry.get(r.id) ?? new Map();
            const p = names.get(r.user_id);
            return (
              <tr key={r.id} className={r.user_id === me ? 'bg-accent/5' : ''}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface font-semibold">
                  <span className="mr-1">{p?.emoji}</span>{p?.display_name ?? 'Player'}
                </td>
                {games.map((g) => {
                  const side = mine.get(g.id);
                  const started = new Date(g.kickoff).getTime() <= now;
                  if (!side) {
                    return <td key={g.id} className="text-center text-muted">{started ? <span title="No pick">–</span> : <span title="Hidden until kickoff">·</span>}</td>;
                  }
                  const abbr = side === 'HOME' ? g.home_abbr : side === 'AWAY' ? g.away_abbr : 'DRAW';
                  const color = side === 'HOME' ? g.home_color : side === 'AWAY' ? g.away_color : '';
                  const final = g.state === 'post';
                  const result = outcome(g, scoring);
                  const won = final && result === side;
                  const push = final && result === 'TIE' && !draws;
                  const lost = final && result && !won && !push;
                  const ahead = g.state === 'in' && aheadOf(g, scoring) === side;
                  return (
                    <td key={g.id} className="p-1 text-center">
                      {/* Flashes when this game's score changes: your row in team color, others quietly. */}
                      <FlashPill
                        value={`${g.state}:${g.home_score}-${g.away_score}`} color={color} soft={r.user_id !== me}
                        className={`inline-block min-w-[38px] rounded px-1.5 py-1 font-display text-xs font-bold tracking-wide
                          ${won ? 'bg-goodsoft text-good ring-1 ring-good/40' : lost ? 'bg-badsoft text-bad opacity-70' : ahead ? 'bg-accent/10 text-accent ring-1 ring-accent/50' : 'bg-surface2 text-ink2'}`}
                        style={!final && color ? { boxShadow: `inset 0 -3px 0 ${color}` } : undefined}
                        title={won ? 'Correct' : push ? 'Push' : lost ? 'Wrong' : ahead ? 'Leading' : ''}
                      >
                        {abbr}
                      </FlashPill>
                      {started && <ReactCell leagueId={leagueId} entryId={r.id} gameId={g.id} demo={demo} {...(rx.get(`${r.id}:${g.id}`) ?? {})} />}
                    </td>
                  );
                })}
                <td className="num text-right text-base text-good">{r.correct}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
