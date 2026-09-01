import { NextResponse } from 'next/server';
import { syncScores } from '../../../../lib/espn';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const meta = await syncScores(true);
  return NextResponse.json({ ok: true, season: meta?.season, week: meta?.week });
}
