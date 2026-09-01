import { sb, currentUser } from '../../../../lib/supabase';
import { syncScores } from '../../../../lib/espn';
import { weekResults, money } from '../../../../lib/stats';

export const dynamic = 'force-dynamic';

export default async function Board({ params }) {
  const user = await currentUser();
  const meta = await syncScores();
  const db = sb();
  if (!meta?.week) return <div className="card"><p>No games synced yet. Refresh in a minute.</p></div>;

  const [{ data: games }, { data: entries }, { data: league }, { data: members }] = await Promise.all([
    db.from('games').select('*').eq('season', meta.season).eq('week', meta.week).order('kickoff'),
    db.from('entries_board').select('*').eq('league_id', params.id).eq('season', meta.season).eq('week', meta.week),
    db.from('leagues').select('*').eq('id', params.id).single(),
    db.from('memberships').select('user_id, profiles(id, display_name, emoji)').eq('league_id', params.id),
  ]);
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));

  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: picks } = entryIds.length
    ? await db.from('picks').select('entry_id, game_id, picked').in('entry_id', entryIds)
    : { data: [] };

  const { rows, complete, winners, actualTotal, lastGame } = weekResults(games ?? [], entries ?? [], picks ?? []);
  const pot = (entries?.length ?? 0) * league.entry_fee_cents;

  return (
    <>
      <div className="card row">
        <div className="grow">
          <div className="meta">Week {meta.week} pot ({entries?.length ?? 0} in at {money(league.entry_fee_cents)})</div>
          <div className="pot">{money(pot)}</div>
        </div>
        {complete && winners.length > 0 && (
          <div>
            <span className="badge blue">
              winner{winners.length > 1 ? 's' : ''}: {winners.map((w) => names.get(w.user_id)?.display_name ?? '?').join(', ')}
            </span>
          </div>
        )}
      </div>

      <div className="card scrollx">
        <h2>Standings</h2>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Player</th><th>Correct</th><th>Wrong</th><th>TB</th><th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = names.get(r.user_id);
              return (
                <tr key={r.id} style={r.user_id === user.id ? { fontWeight: 700 } : undefined}>
                  <td>{r.rank}</td>
                  <td>{p?.emoji} {p?.display_name ?? 'Player'}</td>
                  <td>{r.correct}</td>
                  <td>{r.incorrect}</td>
                  <td>{r.tiebreaker ?? '–'}</td>
                  <td>{r.paid ? <span className="badge green">paid</span> : <span className="badge red">unpaid</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6}>Nobody's in yet this week.</td></tr>}
          </tbody>
        </table>
        {complete && lastGame && (
          <p className="note">Tiebreaker target: {actualTotal} total points in {lastGame.away_abbr} @ {lastGame.home_abbr}.</p>
        )}
        {!complete && <p className="note">Tiebreakers stay hidden until the last game kicks off. Scores refresh on every visit during games.</p>}
      </div>
    </>
  );
}
