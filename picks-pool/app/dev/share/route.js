import { notFound } from 'next/navigation';
import { shareCard } from '../../../lib/share-card';
import { SPORTS } from '../../../lib/scores/sports';
import { LEAGUE, GAMES, ENTRIES, NAMES, NOW, visiblePicks } from '../../../lib/fixtures';

export const dynamic = 'force-dynamic';

// The share image over fixture data, for the /dev preview.
export async function GET() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PREVIEW) notFound();
  return shareCard({ league: LEAGUE, sport: SPORTS.nfl, label: 'Demo Week', games: GAMES, entries: ENTRIES, picks: visiblePicks('u-colin', NOW), names: NAMES });
}
