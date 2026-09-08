// Call it: "KC by 10", posted in the room before kickoff and graded when the
// game goes final. Pure; lib/calls.test.mjs is the self-check.

export function callTeam(call, g) {
  return call.side === 'HOME' ? g.home_abbr : g.away_abbr;
}

// "KC by 10", "KC wins".
export function callText(call, g) {
  if (!g) return 'a game that is gone';
  const team = callTeam(call, g);
  return call.margin ? `${team} by ${call.margin}` : `${team} wins`;
}

// 'hit' | 'miss' | 'pending'. A tie misses; a margin call needs the full margin.
export function gradeCall(call, g) {
  if (!g || g.state !== 'post') return 'pending';
  if (g.winner !== call.side) return 'miss';
  const diff = Math.abs(g.home_score - g.away_score);
  return !call.margin || diff >= call.margin ? 'hit' : 'miss';
}

// "won by 3", "lost by 7", "tied".
export function resultText(g) {
  if (!g || g.state !== 'post') return '';
  const diff = Math.abs(g.home_score - g.away_score);
  if (g.winner === 'TIE') return 'it tied';
  const w = g.winner === 'HOME' ? g.home_abbr : g.away_abbr;
  return `${w} won by ${diff}`;
}

// Receipts for the recap: one line per graded call this slate, misses
// first (they are the fun ones). names.get(id) gives a display name.
export function receipts(calls, games, names) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const lines = [];
  for (const c of calls) {
    const g = byId.get(c.game_id);
    const grade = gradeCall(c, g);
    if (grade === 'pending') continue;
    lines.push({ grade, text: `${names.get(c.user_id) ?? 'Someone'} called ${callText(c, g)}; ${resultText(g)}: ${grade}.` });
  }
  lines.sort((a, b) => (a.grade === b.grade ? 0 : a.grade === 'miss' ? -1 : 1));
  return lines.map((l) => l.text);
}

// Season tally per user: { hits, total } over graded calls.
export function callRecords(calls, games) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const out = new Map();
  for (const c of calls) {
    const grade = gradeCall(c, byId.get(c.game_id));
    if (grade === 'pending') continue;
    const r = out.get(c.user_id) ?? { hits: 0, total: 0 };
    r.total += 1;
    if (grade === 'hit') r.hits += 1;
    out.set(c.user_id, r);
  }
  return out;
}
