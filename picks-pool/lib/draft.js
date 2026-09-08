// The weekly draft: everyone ranks the slate's teams, and at the first
// kickoff a snake draft runs itself from the rankings. A drafted team that
// wins is a point; most points takes the week. Pure; lib/draft.test.mjs.
import { favored } from './line.js';

export const teamKey = (gameId, side) => `${gameId}:${side}`;

// The slate's teams in the default order (favorites first by the size of
// the line, then kickoff, then id): what an empty ranking means, and the
// fallback when a ranking runs out.
export function slateTeams(games) {
  const teams = [];
  for (const g of games) {
    for (const side of ['HOME', 'AWAY']) {
      const fav = favored(g);
      const edge = fav === side ? Math.abs(Number(g.home_spread)) : fav ? -Math.abs(Number(g.home_spread)) : 0;
      teams.push({
        key: teamKey(g.id, side), game: g, side, edge,
        abbr: side === 'HOME' ? g.home_abbr : g.away_abbr, name: side === 'HOME' ? g.home_name : g.away_name,
        logo: side === 'HOME' ? g.home_logo : g.away_logo, color: side === 'HOME' ? g.home_color : g.away_color,
      });
    }
  }
  return teams.sort((a, b) => b.edge - a.edge || new Date(a.game.kickoff) - new Date(b.game.kickoff) || String(a.game.id).localeCompare(String(b.game.id)) || (a.side === 'HOME' ? -1 : 1));
}

// A seeded shuffle, so the draft order is fair and everyone's page agrees.
function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function draftOrder(ids, seed) {
  const list = [...new Set(ids)].sort();
  let x = hash(seed) || 1;
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// Run it. entrants: user ids; rankings: Map(user_id -> [team keys]) in the
// order they want them; teams: slateTeams() (default order). Everyone gets
// the same number of teams; the leftovers go undrafted.
export function snakeDraft(entrants, rankings, teams, seed) {
  const order = draftOrder(entrants, seed);
  const n = order.length;
  const per = n ? Math.floor(teams.length / n) : 0;
  const pool = teams.map((t) => t.key);
  const taken = new Set();
  const picks = [];
  let pickNo = 0;
  for (let round = 1; round <= per; round++) {
    const turn = round % 2 ? order : [...order].reverse();
    for (const user_id of turn) {
      const wish = (rankings.get(user_id) ?? []).find((k) => pool.includes(k) && !taken.has(k)) ?? pool.find((k) => !taken.has(k));
      if (!wish) break;
      taken.add(wish);
      pickNo += 1;
      picks.push({ user_id, team: wish, round, pick_no: pickNo });
    }
  }
  return { order, per, picks, undrafted: pool.filter((k) => !taken.has(k)) };
}

// Score a drafted week. picks: rows with user_id and team (or game_id + side).
// Returns { rows, complete, winners } with rows ranked by wins, then by the
// total margin their winners won by (a tiebreak that needs no tiebreaker).
export function draftResults(picks, games, entrants = null) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const users = new Map();
  const ids = entrants ?? [...new Set(picks.map((p) => p.user_id))];
  for (const id of ids) users.set(id, { user_id: id, wins: 0, losses: 0, pending: 0, margin: 0, teams: [] });
  for (const p of picks) {
    const [gameId, side] = p.team ? p.team.split(':') : [p.game_id, p.side];
    const g = byId.get(gameId);
    const u = users.get(p.user_id);
    if (!u) continue;
    const abbr = g ? (side === 'HOME' ? g.home_abbr : g.away_abbr) : gameId;
    let result = 'pending';
    if (g?.state === 'post') {
      const diff = (side === 'HOME' ? 1 : -1) * (g.home_score - g.away_score);
      result = diff > 0 ? 'won' : diff < 0 ? 'lost' : 'tied';
      if (result === 'won') { u.wins += 1; u.margin += diff; } else u.losses += 1;
    } else if (g?.state === 'in') {
      result = 'live';
      u.pending += 1;
    } else u.pending += 1;
    u.teams.push({ team: p.team ?? teamKey(gameId, side), abbr, game: g ?? null, side, result, round: p.round, pick_no: p.pick_no });
  }
  const rows = [...users.values()];
  for (const r of rows) r.teams.sort((a, b) => (a.pick_no ?? 0) - (b.pick_no ?? 0));
  rows.sort((a, b) => b.wins - a.wins || b.margin - a.margin);
  rows.forEach((r, i) => { r.rank = i > 0 && r.wins === rows[i - 1].wins && r.margin === rows[i - 1].margin ? rows[i - 1].rank : i + 1; });
  const complete = picks.length > 0 && rows.every((r) => r.pending === 0);
  return { rows, complete, winners: complete ? rows.filter((r) => r.rank === 1) : [] };
}
