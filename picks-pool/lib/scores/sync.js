// Pulls the current slate for one sport from ESPN into public.games and
// records where "now" is in public.sport_state. Throttled to once a minute
// per sport so page views (and the live refresh while games are on) can call
// it freely; the daily cron is a backstop. Set SCORES_FROZEN=1 on a staging deploy to leave seeded data alone.

import { admin } from '../supabase.js';
import { sport as sportOf } from './sports.js';
import { pullWeek, pullDates, pullSpan, pullSpecificWeek } from './pull.js';

const THROTTLE_MS = 60_000;

export async function syncSport(sportKey, force = false) {
  const db = admin();
  const { data: state } = await db.from('sport_state').select('*').eq('sport', sportKey).maybeSingle();
  if (process.env.SCORES_FROZEN) return state;
  if (!force && state?.last_sync && Date.now() - new Date(state.last_sync).getTime() < THROTTLE_MS) {
    return state;
  }

  const s = sportOf(sportKey);
  const result = s.mode === 'week' ? await pullWeek(sportKey) : s.mode === 'span' ? await pullSpan(sportKey) : await pullDates(sportKey);
  if (!result) return state; // ESPN unreachable: keep serving what we have

  const { rows, current } = result;
  if (rows.length) {
    // A game never moves between slates once stored: entries and picks are
    // keyed to it. Matters for span mode, where a cluster's first day can
    // fall out of the fetch window. Re-sync scores, keep the slate.
    const { data: known } = await db.from('games').select('id, slate_key, slate_label').in('id', rows.map((r) => r.id));
    const keep = new Map((known ?? []).map((g) => [g.id, g]));
    for (const r of rows) {
      const k = keep.get(r.id);
      if (k) { r.slate_key = k.slate_key; r.slate_label = k.slate_label; }
    }
    await db.from('games').upsert(rows);
  }

  // Week mode: when the board rolls to a new week, keep scoring the old one
  // until every game there is final (a Monday game that was 'in' at the
  // last sync would otherwise never finish).
  if (s.mode === 'week' && state?.slate_key && state.slate_key !== current.key) {
    const { count } = await db.from('games').select('id', { count: 'exact', head: true })
      .eq('sport', sportKey).eq('slate_key', state.slate_key).neq('state', 'post');
    if (count) {
      const [season, type, week] = state.slate_key.split('-').map(Number);
      const old = await pullSpecificWeek(sportKey, season, type, week);
      if (old?.length) await db.from('games').upsert(old);
    }
  }
  const next = {
    sport: sportKey,
    season: current.season,
    season_type: current.seasonType,
    slate_key: current.key,
    slate_label: current.label,
    last_sync: new Date().toISOString(),
  };
  await db.from('sport_state').upsert(next);

  // Fresh scores may mean a new leader, and a kickoff may be close: push.
  // Never lets a push problem break the scores.
  try {
    const { runPushJobs } = await import('../push/jobs.js');
    await runPushJobs(sportKey);
  } catch (e) {
    console.error('push after sync failed:', e?.message);
  }
  return next;
}

// Every sport that has at least one league. Used by the cron.
export async function syncAll(force = false) {
  const db = admin();
  const { data } = await db.from('leagues').select('sport');
  const keys = [...new Set((data ?? []).map((l) => l.sport))];
  const out = {};
  for (const k of keys) out[k] = await syncSport(k, force);
  return out;
}
