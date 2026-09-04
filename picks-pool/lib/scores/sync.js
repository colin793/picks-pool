// Pulls the current slate for one sport from ESPN into public.games and
// records where "now" is in public.sport_state. Throttled to once per two
// minutes per sport so page views can call it freely; the daily cron is a
// backstop. Set SCORES_FROZEN=1 on a staging deploy to leave seeded data alone.

import { admin } from '../supabase.js';
import { sport as sportOf } from './sports.js';
import { pullWeek, pullDates } from './pull.js';

const THROTTLE_MS = 120_000;

export async function syncSport(sportKey, force = false) {
  const db = admin();
  const { data: state } = await db.from('sport_state').select('*').eq('sport', sportKey).maybeSingle();
  if (process.env.SCORES_FROZEN) return state;
  if (!force && state?.last_sync && Date.now() - new Date(state.last_sync).getTime() < THROTTLE_MS) {
    return state;
  }

  const s = sportOf(sportKey);
  const result = s.mode === 'week' ? await pullWeek(sportKey) : await pullDates(sportKey);
  if (!result) return state; // ESPN unreachable: keep serving what we have

  const { rows, current } = result;
  if (rows.length) await db.from('games').upsert(rows);
  const next = {
    sport: sportKey,
    season: current.season,
    season_type: current.seasonType,
    slate_key: current.key,
    slate_label: current.label,
    last_sync: new Date().toISOString(),
  };
  await db.from('sport_state').upsert(next);
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
