import { NextResponse } from 'next/server';
import { syncAll } from '../../../../lib/scores/sync';
import { sendRecaps } from '../../../../lib/recap';
import { sendReminders } from '../../../../lib/remind';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One daily cron (Vercel's free tier allows two). Runs at 13:00 UTC = 9 AM ET:
//   sync    every day, for every sport with a league
//   recap   whenever a slate finished in the last 40 hours (NFL: Tuesday)
//   remind  when today has kickoffs and someone hasn't entered (NFL: Thu, Sun)
// Test a piece by hand: ?task=recap  ?task=remind  ?task=sync
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const task = new URL(request.url).searchParams.get('task') ?? 'all';
  const out = { ok: true, task };
  if (task === 'all' || task === 'sync') out.sync = await syncAll(true);
  if (task === 'all' || task === 'recap') out.recap = await sendRecaps();
  if (task === 'all' || task === 'remind') out.remind = await sendReminders();
  return NextResponse.json(out);
}
