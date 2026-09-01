import { admin } from './supabase';

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

// Pulls the current week's games/scores from ESPN into the games table.
// Throttled to once per 2 minutes so page views can call it freely; the daily
// cron is just a backstop. ponytail: sync-on-view instead of a minutely cron,
// upgrade to a real scheduler if the pool outgrows Vercel's free tier.
export async function syncScores(force = false) {
  const db = admin();
  const { data: meta } = await db.from('meta').select('*').eq('id', 1).single();
  if (!force && meta?.last_sync && Date.now() - new Date(meta.last_sync).getTime() < 120_000) {
    return meta;
  }

  let data = await fetchJson(SCOREBOARD);
  if (!data) return meta;

  // Outside the regular season ESPN's default board shows preseason/postseason;
  // pin to regular-season week 1 until it starts.
  if (data?.season?.type !== 2) {
    data = (await fetchJson(`${SCOREBOARD}?seasontype=2&week=1&dates=${data?.season?.year ?? new Date().getFullYear()}`)) ?? data;
  }

  const season = data?.season?.year;
  const week = data?.week?.number;
  const rows = (data?.events ?? []).map((ev) => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c) => c.homeAway === 'away');
    if (!home || !away) return null;
    const state = ev.status?.type?.state ?? 'pre'; // pre | in | post
    const hs = Number(home.score ?? 0);
    const as = Number(away.score ?? 0);
    return {
      id: String(ev.id),
      season,
      week,
      kickoff: ev.date,
      home_abbr: home.team?.abbreviation ?? '',
      home_name: home.team?.shortDisplayName ?? home.team?.displayName ?? '',
      away_abbr: away.team?.abbreviation ?? '',
      away_name: away.team?.shortDisplayName ?? away.team?.displayName ?? '',
      home_score: hs,
      away_score: as,
      state,
      winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null,
    };
  }).filter(Boolean);

  if (rows.length) await db.from('games').upsert(rows);
  const next = { id: 1, season, week, last_sync: new Date().toISOString() };
  await db.from('meta').upsert(next);
  return next;
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // ESPN down: keep serving whatever is already in the table
  }
}
