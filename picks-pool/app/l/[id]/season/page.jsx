import { leagueContext, currentSlate, loadSeason } from '../../../../lib/league';
import { seasonStats, slateResults } from '../../../../lib/stats';
import { duelSeason, recordText } from '../../../../lib/duels';
import { callRecords } from '../../../../lib/calls';
import { draftResults } from '../../../../lib/draft';
import SeasonTable from '../../../components/SeasonTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Season' };

export default async function Season({ params }) {
  const { user, league, db, sport } = await leagueContext(params.id);
  const now = await currentSlate(league);
  if (!now) return <div className="card"><p>No games synced yet.</p></div>;

  const [{ games, entries, picks, payouts }, { data: members }] = await Promise.all([
    loadSeason(db, league, now.season),
    db.from('memberships').select('user_id, profiles(id, display_name, emoji)').eq('league_id', league.id),
  ]);

  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));
  const lock = Boolean(league.lock_of_week);
  // Duel records, slate by slate in season order, only from completed slates.
  let duels = null;
  if (league.duels) {
    const keys = [...new Set(games.map((g) => g.slate_key))].sort();
    duels = duelSeason(keys.map((k) => {
      const sg = games.filter((g) => g.slate_key === k), se = entries.filter((e) => e.slate_key === k);
      const ids = new Set(se.map((e) => e.id));
      const r = slateResults(sg, se, picks.filter((p) => ids.has(p.entry_id)), { scoring: league.scoring, lock });
      return { games: sg, entries: se, rows: r.rows, complete: r.complete };
    }));
  }
  // The weekly draft: weeks won, from every slate the draft has dealt.
  let draftWins = null;
  if (league.draft) {
    const { data: dp } = await db.from('draft_picks').select('*').eq('league_id', league.id).eq('season', now.season); // RLS: members
    if (dp?.length) {
      draftWins = new Map();
      for (const k of new Set(dp.map((p) => p.slate_key))) {
        const r = draftResults(dp.filter((p) => p.slate_key === k), games.filter((g) => g.slate_key === k));
        for (const w of r.winners) draftWins.set(w.user_id, (draftWins.get(w.user_id) ?? 0) + 1);
      }
    }
  }
  const stats = seasonStats(games, entries, picks, payouts, { scoring: league.scoring, lock }).map((s) => ({
    ...s,
    name: names.get(s.user_id)?.display_name ?? 'Player',
    emoji: names.get(s.user_id)?.emoji ?? '',
    ...(duels ? { duels: recordText(duels.get(s.user_id)), duelWins: duels.get(s.user_id)?.won ?? 0 } : {}),
    ...(draftWins ? { draftWins: draftWins.get(s.user_id) ?? 0 } : {}),
  }));
  // Call it: hit rate per person over the season's graded calls.
  let receipts = [];
  if (league.calls) {
    const { data: calls } = await db.from('calls').select('user_id, game_id, side, margin').eq('league_id', league.id); // RLS: members
    receipts = [...callRecords(calls ?? [], games).entries()]
      .map(([user_id, r]) => ({ user_id, ...r, name: names.get(user_id)?.display_name ?? 'Player', emoji: names.get(user_id)?.emoji ?? '' }))
      .sort((a, b) => b.hits - a.hits || a.total - b.total);
  }
  // The loser's duty: whoever sits last by wins, then right picks.
  const onHook = league.duty && stats.length > 1 ? [...stats].sort((a, b) => a.wins - b.wins || a.correct - b.correct)[0] : null;
  const slatesPlayed = new Set(entries.map((e) => e.slate_key)).size;

  return (
    <>
      <div className="mb-5">
        <p className="eyebrow">{sport.name} · {now.season} season · {slatesPlayed} {sport.mode === 'week' ? 'weeks' : 'slates'} played</p>
        <h1 className="h1 mt-1">Season standings</h1>
      </div>
      {onHook && (
        <section className="card mb-4 border-warn/40">
          <h2 className="h2 mb-1">Loser&rsquo;s duty</h2>
          <p className="text-sm">{league.duty}</p>
          <p className="mt-1 text-xs text-muted">On the hook right now: <span className="font-semibold text-ink">{onHook.emoji} {onHook.name}</span> ({onHook.wins} win{onHook.wins === 1 ? '' : 's'}, {onHook.correct} right).</p>
        </section>
      )}
      <section className="card">
        <SeasonTable rows={stats} me={user.id} lock={lock} duels={Boolean(duels)} draft={Boolean(draftWins)} />
        <p className="mt-3 text-xs text-muted">
          Tap a column to sort. Average finish counts only completed slates a player entered; ties share the better rank. Won is money the commissioner has marked as sent.
          {lock ? ' Pts adds one for each lock that hit.' : ''}{duels ? ' Duels is the head-to-head record, wins-losses-ties.' : ''}
        </p>
      </section>
      {receipts.length > 0 && (
        <section className="card mt-4">
          <h2 className="h2 mb-2">Receipts</h2>
          <ul className="grid gap-1 sm:grid-cols-2">
            {receipts.map((r) => (
              <li key={r.user_id} className={`flex items-center gap-2 border-t border-line py-1.5 text-sm ${r.user_id === user.id ? 'font-semibold' : ''}`}>
                <span>{r.emoji}</span><span className="flex-1 truncate">{r.name}</span>
                <span className="num">{r.hits} of {r.total}</span><span className="text-xs text-muted">calls hit</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Calls made in Chat, graded when the game went final. Talk is cheap; this is the invoice.</p>
        </section>
      )}
    </>
  );
}
