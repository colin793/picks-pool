import { money } from '../../lib/stats';

// Standings for one slate. rows from slateResults(); names: user_id -> profile.
export default function Standings({ rows, names, me, live, complete, feeCents, showFees = true }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>Player</th>
            <th className="text-right">Right</th>
            <th className="text-right">Wrong</th>
            {live > 0 && <th className="text-right" title="Picks currently ahead in games in progress">Leading</th>}
            <th className="hidden text-right sm:table-cell">TB</th>
            {showFees && <th className="text-right">Fee</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = names.get(r.user_id);
            const mine = r.user_id === me;
            return (
              <tr key={r.id} className={mine ? 'bg-accent/5 font-semibold' : ''}>
                <td className="num text-base text-muted">{r.rank}</td>
                <td className="whitespace-nowrap">
                  <span className="mr-1.5">{p?.emoji}</span>{p?.display_name ?? 'Player'}
                  {complete && r.rank === 1 && <span className="pill pill-good ml-2">Winner</span>}
                </td>
                <td className="num text-right text-base text-good">{r.correct}</td>
                <td className="num text-right text-base text-muted">{r.incorrect}</td>
                {live > 0 && <td className="num text-right text-base text-accent">{r.leading || ''}</td>}
                <td className="hidden text-right text-muted sm:table-cell">{r.tiebreaker ?? '–'}</td>
                {showFees && (
                  <td className="text-right">
                    {r.paid ? <span className="pill pill-good">paid</span> : <span className="pill pill-bad"><span className="hidden sm:inline">{money(feeCents)}&nbsp;</span>due</span>}
                  </td>
                )}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="py-6 text-center text-muted">Nobody's in yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
