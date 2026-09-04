// ESPN's public scoreboard feed, normalized into rows for public.games.
// No API key. If ESPN is down we return null and keep serving the table.

import { sport as sportOf } from './sports.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

export async function fetchScoreboard(sportKey, query = {}) {
  const s = sportOf(sportKey);
  const q = new URLSearchParams(s.params);
  for (const [k, v] of Object.entries(query)) if (v != null && v !== '') q.set(k, String(v));
  const url = `${BASE}/${s.path}/scoreboard${q.size ? `?${q}` : ''}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// One ESPN event -> one games row. slate: { key, label, season, seasonType }.
export function normalizeEvent(sportKey, ev, slate) {
  const comp = ev.competitions?.[0];
  const home = comp?.competitors?.find((c) => c.homeAway === 'home');
  const away = comp?.competitors?.find((c) => c.homeAway === 'away');
  if (!home || !away) return null;
  const state = ev.status?.type?.state ?? 'pre'; // pre | in | post
  const hs = Number(home.score ?? 0);
  const as = Number(away.score ?? 0);
  return {
    id: String(ev.id),
    sport: sportKey,
    season: slate.season,
    season_type: slate.seasonType,
    slate_key: slate.key,
    slate_label: slate.label,
    kickoff: ev.date,
    home_abbr: home.team?.abbreviation ?? '',
    home_name: home.team?.shortDisplayName ?? home.team?.displayName ?? '',
    home_logo: home.team?.logo ?? '',
    home_color: hex(home.team?.color),
    away_abbr: away.team?.abbreviation ?? '',
    away_name: away.team?.shortDisplayName ?? away.team?.displayName ?? '',
    away_logo: away.team?.logo ?? '',
    away_color: hex(away.team?.color),
    home_score: hs,
    away_score: as,
    state,
    status_detail: ev.status?.type?.shortDetail ?? '',
    winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null,
  };
}

function hex(c) {
  if (!c) return '';
  const v = String(c).replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{6}$/.test(v) ? `#${v}` : '';
}

// Calendar date of an instant in US Eastern time, as YYYY-MM-DD.
export function easternDate(iso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// "Sat Nov 14" for a YYYY-MM-DD key.
export function dateLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d))).replace(',', '');
}

export function weekSlate(sportKey, season, seasonType, week) {
  const s = sportOf(sportKey);
  const label = seasonType === 3
    ? (s.postLabels?.[week] ?? `Playoffs ${week}`)
    : seasonType === 1 ? `Preseason ${week}` : `Week ${week}`;
  return { key: `${season}-${seasonType}-${String(week).padStart(2, '0')}`, label, season, seasonType, week };
}

export function dateSlate(season, seasonType, dateKey) {
  return { key: dateKey, label: dateLabel(dateKey), season, seasonType };
}
