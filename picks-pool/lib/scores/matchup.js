// "About this matchup": what ESPN's per-game summary says, boiled down to a
// few lines a card can show. Fetched once per game when someone opens the
// fold, cached in public.game_notes. Everything here is defensive: the feed
// is unofficial, so a missing block means an empty section, never a crash.
import { sport as sportOf } from './sports.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

export async function fetchSummary(sportKey, gameId) {
  const s = sportOf(sportKey);
  try {
    const res = await fetch(`${BASE}/${s.path}/summary?event=${encodeURIComponent(gameId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const str = (v, n = 60) => String(v ?? '').trim().slice(0, n);
const sideOf = (teamLike, home, away) => {
  const abbr = str(teamLike?.abbreviation ?? teamLike?.team?.abbreviation);
  const id = String(teamLike?.id ?? teamLike?.team?.id ?? '');
  if (abbr && abbr === home.abbr) return 'home';
  if (abbr && abbr === away.abbr) return 'away';
  if (id && id === String(home.id)) return 'home';
  if (id && id === String(away.id)) return 'away';
  return null;
};

// summary JSON -> { lastFive, injuries, leaders, projection, venue }, each
// side keyed home/away. `home`/`away` are { abbr, id } from the games row.
export function normalizeSummary(data, home, away) {
  const out = { lastFive: { home: [], away: [] }, injuries: { home: [], away: [] }, leaders: { home: [], away: [] }, projection: null, venue: '' };
  if (!data || typeof data !== 'object') return out;

  for (const block of data.lastFiveGames ?? []) {
    const side = sideOf(block.team, home, away);
    if (!side) continue;
    out.lastFive[side] = (block.events ?? []).slice(0, 5).map((e) => ({
      result: str(e.gameResult, 1).toUpperCase() || '',
      score: str(e.score, 12),
      opp: `${str(e.atVs, 3) || 'vs'} ${str(e.opponent?.abbreviation, 6)}`.trim(),
    })).filter((e) => e.result);
  }

  for (const block of data.injuries ?? []) {
    const side = sideOf(block.team, home, away);
    if (!side) continue;
    out.injuries[side] = (block.injuries ?? []).slice(0, 6).map((i) => ({
      name: str(i.athlete?.displayName ?? i.athlete?.shortName, 40),
      pos: str(i.athlete?.position?.abbreviation, 4),
      status: str(i.status, 20),
    })).filter((i) => i.name);
  }

  // Pregame the leaders are season-to-date; in-game and after they are this game's.
  for (const block of data.leaders ?? []) {
    const side = sideOf(block.team, home, away);
    if (!side) continue;
    const rows = [];
    for (const cat of block.leaders ?? []) {
      const top = cat.leaders?.[0];
      if (!top?.athlete) continue;
      rows.push({
        stat: str(cat.shortDisplayName ?? cat.displayName ?? cat.name, 20),
        name: str(top.athlete.shortName ?? top.athlete.displayName, 40),
        pos: str(top.athlete.position?.abbreviation, 4),
        value: str(top.displayValue, 40),
      });
    }
    out.leaders[side] = rows.slice(0, 3);
  }

  const p = data.predictor;
  const hp = Number(p?.homeTeam?.gameProjection), ap = Number(p?.awayTeam?.gameProjection);
  if (Number.isFinite(hp) && Number.isFinite(ap)) out.projection = { home: Math.round(hp), away: Math.round(ap) };

  out.venue = str(data.gameInfo?.venue?.fullName, 60);
  return out;
}

// Does the fold have anything to say?
export function notesEmpty(n) {
  return !n || (!n.lastFive?.home?.length && !n.lastFive?.away?.length && !n.injuries?.home?.length && !n.injuries?.away?.length
    && !n.leaders?.home?.length && !n.leaders?.away?.length && !n.projection && !n.venue);
}
