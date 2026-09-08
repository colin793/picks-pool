// Duels: every week you are paired with one other entrant; more points than
// them and you win the duel. A second table beside the standings, for the
// people the money race has left behind. Pure; lib/duels.test.mjs checks it.

// Round-robin pairings by the circle method: `ids` sorted, one fixed, the
// rest rotate by `round`. An odd count leaves one bye. Deterministic, so
// everyone's page agrees without anything stored.
export function pairings(ids, round) {
  const list = [...new Set(ids)].sort();
  if (list.length < 2) return { pairs: [], bye: list[0] ?? null };
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rot = list.slice(1);
  const r = ((round % (n - 1)) + (n - 1)) % (n - 1);
  const turned = [...rot.slice(rot.length - r), ...rot.slice(0, rot.length - r)];
  const arr = [list[0], ...turned];
  const pairs = [];
  let bye = null;
  for (let i = 0; i < n / 2; i++) {
    const a = arr[i], b = arr[n - 1 - i];
    if (a == null) bye = b; else if (b == null) bye = a; else pairs.push([a, b].sort());
  }
  return { pairs, bye };
}

// Who duels this slate: entrants who were in before the first kickoff. Late
// entrants sit the week out, so the pairings never shift under anyone.
export function duelists(games, entries) {
  const first = Math.min(...games.map((g) => new Date(g.kickoff).getTime()));
  if (!Number.isFinite(first)) return [];
  return entries.filter((e) => !e.created_at || new Date(e.created_at).getTime() <= first).map((e) => e.user_id);
}

// One slate's duels. rows: slateResults() rows (points per user). round: the
// slate's index in the season. Returns [{ a, b, aPts, bPts, winner, tie }]
// plus the bye, with `winner` null while the slate is still open.
export function slateDuels(games, entries, rows, round, { complete = false } = {}) {
  const ids = duelists(games, entries);
  const { pairs, bye } = pairings(ids, round);
  const pts = new Map(rows.map((r) => [r.user_id, r.points ?? r.correct]));
  const duels = pairs.map(([a, b]) => {
    const aPts = pts.get(a) ?? 0, bPts = pts.get(b) ?? 0;
    const tie = aPts === bPts;
    return { a, b, aPts, bPts, tie: complete && tie, winner: complete && !tie ? (aPts > bPts ? a : b) : null, leading: !complete && !tie ? (aPts > bPts ? a : b) : null };
  });
  return { duels, bye };
}

// Season duel records. slates: [{ games, entries, rows, complete }] in season
// order. Returns Map(user_id -> { won, lost, tied, vs: Map(opponent -> { won, lost, tied }) }).
export function duelSeason(slates) {
  const out = new Map();
  const rec = (id) => { if (!out.has(id)) out.set(id, { won: 0, lost: 0, tied: 0, vs: new Map() }); return out.get(id); };
  const vs = (id, opp) => { const r = rec(id); if (!r.vs.has(opp)) r.vs.set(opp, { won: 0, lost: 0, tied: 0 }); return r.vs.get(opp); };
  slates.forEach((s, i) => {
    if (!s.complete) return;
    for (const d of slateDuels(s.games, s.entries, s.rows, i, { complete: true }).duels) {
      if (d.tie) { rec(d.a).tied += 1; rec(d.b).tied += 1; vs(d.a, d.b).tied += 1; vs(d.b, d.a).tied += 1; continue; }
      const w = d.winner, l = w === d.a ? d.b : d.a;
      rec(w).won += 1; rec(l).lost += 1; vs(w, l).won += 1; vs(l, w).lost += 1;
    }
  });
  return out;
}

export const recordText = (r) => (r ? `${r.won}-${r.lost}${r.tied ? `-${r.tied}` : ''}` : '0-0');
