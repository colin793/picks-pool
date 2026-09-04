import { leagueContext, currentSlate, loadSeason } from '../../../../lib/league';
import { seasonStats } from '../../../../lib/stats';
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
  const stats = seasonStats(games, entries, picks, payouts).map((s) => ({
    ...s,
    name: names.get(s.user_id)?.display_name ?? 'Player',
    emoji: names.get(s.user_id)?.emoji ?? '',
  }));
  const slatesPlayed = new Set(entries.map((e) => e.slate_key)).size;

  return (
    <>
      <div className="mb-5">
        <p className="eyebrow">{sport.name} · {now.season} season · {slatesPlayed} {sport.mode === 'week' ? 'weeks' : 'slates'} played</p>
        <h1 className="h1 mt-1">Season standings</h1>
      </div>
      <section className="card">
        <SeasonTable rows={stats} me={user.id} />
        <p className="mt-3 text-xs text-muted">
          Tap a column to sort. Average finish counts only completed slates a player entered; ties share the better rank. Won is money the commissioner has marked as sent.
        </p>
      </section>
    </>
  );
}
