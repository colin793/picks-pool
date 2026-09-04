import { leagueContext, currentSlate, loadSlate, slateList } from '../../../../lib/league';
import { shareCard } from '../../../../lib/share-card';

export const dynamic = 'force-dynamic';

// The standings as an image, for sharing into the group text. Members only
// (leagueContext redirects everyone else). ?slate=<key> for a past slate.
export async function GET(request, { params }) {
  const { league, db, sport } = await leagueContext(params.id);
  const now = await currentSlate(league);
  if (!now) return new Response('No games yet', { status: 404 });
  const wanted = new URL(request.url).searchParams.get('slate');
  const slates = await slateList(db, league, now.season);
  const key = slates.some((s) => s.key === wanted) ? wanted : now.key;
  const label = slates.find((s) => s.key === key)?.label ?? now.label;
  const { games, entries, picks, names } = await loadSlate(db, league, now.season, key);
  const res = shareCard({ league, sport, label, games, entries, picks, names });
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
