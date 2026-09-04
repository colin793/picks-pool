import { NextResponse } from 'next/server';
import { syncAll } from '../../../../lib/scores/sync';
import { runPushJobs } from '../../../../lib/push/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Scores, then the push alerts. Point any scheduler at this every few
// minutes on game days (Vercel Pro cron, or a free pinger like cron-job.org):
//   curl -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/push"
// Page views run the same jobs after each real score sync, so this is the
// backstop for the hour nobody has the app open.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const sync = await syncAll(true);
  const push = await runPushJobs();
  return NextResponse.json({ ok: true, sync, push });
}
