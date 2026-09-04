import { NextResponse } from 'next/server';
import { syncAll, syncSport } from '../../../../lib/scores/sync';

export const dynamic = 'force-dynamic';

// Manual force-sync. Not on the cron schedule; the daily job covers that.
//   curl -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/scores?sport=nfl"
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const sport = new URL(request.url).searchParams.get('sport');
  const result = sport ? { [sport]: await syncSport(sport, true) } : await syncAll(true);
  return NextResponse.json({ ok: true, ...result });
}
