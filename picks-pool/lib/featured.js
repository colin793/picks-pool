// Which games make a curated slate. Pure: games in, the chosen games out.
//
// A pick'em pool lives on games that split the room, so a matchup between
// two ranked teams outranks a top team playing a nobody, however good the
// top team is. The order:
//   1. ranked vs ranked, best combined rank first
//   2. ranked vs unranked, best rank first
//   3. the rest: power-conference games first, then everything, by kickoff
// A game against a lower-division team is skipped whoever is playing it:
// everybody picks the same side and nothing is decided. Within a tier a
// closer line wins (a 3-point game splits the room; a 24-point game does
// not), then kickoff, then id, so the result is stable across runs.

const kickoffOrder = (a, b) => new Date(a.kickoff) - new Date(b.kickoff) || String(a.id).localeCompare(String(b.id));

export function featuredGames(games, { n = 15, fbs = null, power = null } = {}) {
  const lower = (conf) => Boolean(fbs && conf && !fbs.has(String(conf)));
  const isPower = (conf) => Boolean(power && conf && power.has(String(conf)));
  const scored = [];
  for (const g of games) {
    const hr = g.home_rank ?? null, ar = g.away_rank ?? null;
    if (lower(g.home_conf) || lower(g.away_conf)) continue;
    let tier, score;
    if (hr && ar) { tier = 1; score = (26 - hr) + (26 - ar); }
    else if (hr || ar) { tier = 2; score = 26 - (hr || ar); }
    else { tier = 3; score = (isPower(g.home_conf) ? 1 : 0) + (isPower(g.away_conf) ? 1 : 0); }
    scored.push({ g, tier, score });
  }
  const closeness = (g) => (g.home_spread == null ? Infinity : Math.abs(Number(g.home_spread)));
  scored.sort((x, y) => x.tier - y.tier || y.score - x.score || closeness(x.g) - closeness(y.g) || kickoffOrder(x.g, y.g));
  return scored.slice(0, n).map((x) => x.g).sort(kickoffOrder);
}

// Keep only the games a league's curated set names. `rows` are slate_games
// rows for one league. A slate with no rows was never curated (an NFL
// league, or a slate nobody has opened yet) and plays every game.
export function applyFeatured(games, rows) {
  if (!rows?.length) return games;
  const bySlate = new Map();
  for (const r of rows) {
    if (!bySlate.has(r.slate_key)) bySlate.set(r.slate_key, new Set());
    bySlate.get(r.slate_key).add(r.game_id);
  }
  return games.filter((g) => !bySlate.has(g.slate_key) || bySlate.get(g.slate_key).has(g.id));
}

// "#3 UGA" or "UGA".
export function rankedAbbr(abbr, rank) {
  return rank ? `#${rank} ${abbr}` : abbr;
}
