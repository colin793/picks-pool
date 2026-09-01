import { NextResponse } from 'next/server';
import { syncScores } from '../../../../lib/espn';
import { sendRecaps } from '../../../../lib/recap';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Cron hits this daily at 13:00 UTC; it only acts on Tuesday mornings (ET),
// right after Monday night wraps. ?force=1 skips the Tuesday check for testing.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const url = new URL(request.url);
  const day = new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
  if (day !== 'Tue' && !url.searchParams.get('force')) {
    return NextResponse.json({ ok: true, skipped: 'not Tuesday' });
  }
  await syncScores(true); // make sure Monday's final is in before judging the week
  const result = await sendRecaps();
  return NextResponse.json({ ok: true, ...result });
}
