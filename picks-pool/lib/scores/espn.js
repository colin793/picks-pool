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
  const sit = comp.situation ?? {};
  const line = odds(comp.odds?.[0], home, away);
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
    home_rank: rank(home),
    home_conf: String(home.team?.conferenceId ?? ''),
    away_abbr: away.team?.abbreviation ?? '',
    away_name: away.team?.shortDisplayName ?? away.team?.displayName ?? '',
    away_logo: away.team?.logo ?? '',
    away_color: hex(away.team?.color),
    away_rank: rank(away),
    away_conf: String(away.team?.conferenceId ?? ''),
    home_score: hs,
    away_score: as,
    state,
    status_detail: ev.status?.type?.shortDetail ?? '',
    winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null,
    // Live situation (only while a game is in progress; blank otherwise).
    possession: state === 'in' && sit.possession ? (String(sit.possession) === String(home.id) ? 'HOME' : String(sit.possession) === String(away.id) ? 'AWAY' : '') : '',
    down_distance: state === 'in' ? String(sit.shortDownDistanceText ?? sit.downDistanceText ?? '').slice(0, 40) : '',
    red_zone: state === 'in' && Boolean(sit.isRedZone),
    last_play: state === 'in' ? String(sit.lastPlay?.text ?? '').slice(0, 160) : '',
    // The line, from the home side: -3.5 means the home team is favored by 3.5.
    home_spread: line.homeSpread,
    over_under: line.overUnder,
    weather: String(ev.weather?.displayValue ?? '').slice(0, 40),
    temperature: Number.isFinite(Number(ev.weather?.temperature)) && ev.weather?.temperature != null ? Math.round(Number(ev.weather.temperature)) : null,
  };
}

// ESPN's odds block, resolved to the home side. `details` reads "KC -3.5";
// the team odds say who is favored; `spread` alone is ambiguous, so it is
// the last resort. A pick'em ("EVEN") is a spread of 0.
function odds(o, home, away) {
  if (!o) return { homeSpread: null, overUnder: null };
  const ou = Number(o.overUnder);
  const overUnder = Number.isFinite(ou) && ou > 0 ? ou : null;
  const details = String(o.details ?? '').trim();
  if (/^even$/i.test(details) || /^pk$/i.test(details)) return { homeSpread: 0, overUnder };
  const m = details.match(/^([A-Z&]+)\s+([+-]?\d+(?:\.\d+)?)$/i);
  const mag = m ? Math.abs(Number(m[2])) : Math.abs(Number(o.spread));
  if (!Number.isFinite(mag)) return { homeSpread: null, overUnder };
  let homeFavored;
  if (o.homeTeamOdds?.favorite === true || o.awayTeamOdds?.favorite === false && o.homeTeamOdds?.favorite != null) homeFavored = true;
  else if (o.awayTeamOdds?.favorite === true) homeFavored = false;
  else if (m && m[1].toUpperCase() === String(home.team?.abbreviation ?? '').toUpperCase()) homeFavored = true;
  else if (m && m[1].toUpperCase() === String(away.team?.abbreviation ?? '').toUpperCase()) homeFavored = false;
  else if (Number.isFinite(Number(o.spread))) homeFavored = Number(o.spread) < 0; // ESPN's spread is from the home side
  else return { homeSpread: null, overUnder };
  return { homeSpread: homeFavored ? -mag : mag, overUnder };
}

// AP Top 25 rank from ESPN's curatedRank (99 means unranked), else null.
function rank(c) {
  const r = Number(c?.curatedRank?.current);
  return Number.isInteger(r) && r >= 1 && r <= 25 ? r : null;
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

// "Sep 12 to 14" (or "Sep 30 to Oct 2") for a run of consecutive game days.
export function spanSlate(season, seasonType, firstKey, lastKey) {
  const short = (k) => { const [y, m, d] = k.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))); };
  const a = short(firstKey), b = short(lastKey);
  const label = firstKey === lastKey ? a : a.slice(0, 3) === b.slice(0, 3) ? `${a} to ${b.slice(4)}` : `${a} to ${b}`;
  return { key: firstKey, label, season, seasonType };
}
