// Survivor: one team per slate, never the same team twice, one loss and you
// are out. Pure: games + entries + picks in, who is alive and who won out.
// lib/survivor.test.mjs is the self-check.
//
// Straight up, whatever the league's pick'em scoring: a survivor pick has to
// win the game. A tie is out. A slate with no pick, once every game in it has
// kicked off, is out ("missed"). The pool starts on the slate of the first
// pick anyone in the league makes; entries close when that slate's last game
// kicks off. When nobody is left standing, whoever lasted longest wins, and a
// group that fell in the same slate splits.

import { outcome } from './stats.js';

export function teamOf(g, side) {
  return side === 'HOME' ? g.home_abbr : side === 'AWAY' ? g.away_abbr : '';
}

// What one pick did: 'won' | 'out' | 'live' | 'pending'. Unknown game (dropped
// from a curated slate, say) stays pending; it decides nothing.
export function pickResult(g, side) {
  if (!g) return 'pending';
  if (g.state === 'post') return outcome(g) === side ? 'won' : 'out';
  return g.state === 'in' ? 'live' : 'pending';
}

// The slate the pool started on: the earliest slate with a pick, or null.
export function startSlate(picks) {
  let start = null;
  for (const p of picks) if (start == null || p.slate_key < start) start = p.slate_key;
  return start;
}

// May someone still enter? Yes until the start slate's last game kicks off.
// `games` must cover the start slate; when they do not (the caller only has
// the current slate and the pool started earlier) the answer is no.
export function entriesOpen(picks, games, now = Date.now()) {
  const start = startSlate(picks);
  if (start == null) return true;
  const sg = games.filter((g) => g.slate_key === start);
  if (!sg.length) return false;
  return sg.some((g) => new Date(g.kickoff).getTime() > now);
}

// games: the league's games for the season (curated slates already applied).
// entries: survivor_entries rows (user_id, paid). picks: survivor_picks rows
// the viewer may see (own always, others' once the game kicks off). Hidden
// picks are simply absent, which is safe: a slate is only judged "missed"
// once every game in it has kicked off, and by then every pick is visible.
export function survivorStandings(games, entries, picks, { now = Date.now() } = {}) {
  const slateKeys = [...new Set(games.map((g) => g.slate_key))].sort();
  const labels = new Map();
  for (const g of games) if (!labels.has(g.slate_key)) labels.set(g.slate_key, g.slate_label);
  const bySlate = new Map(slateKeys.map((k) => [k, games.filter((g) => g.slate_key === k)]));
  const byId = new Map(games.map((g) => [g.id, g]));
  const start = startSlate(picks);
  const played = start == null ? [] : slateKeys.filter((k) => k >= start);
  const allKicked = (k) => bySlate.get(k).every((g) => new Date(g.kickoff).getTime() <= now);

  const mine = new Map(); // user_id -> Map(slate_key -> pick)
  for (const p of picks) {
    if (!mine.has(p.user_id)) mine.set(p.user_id, new Map());
    mine.get(p.user_id).set(p.slate_key, p);
  }

  const rows = entries.map((e) => {
    const picksBySlate = mine.get(e.user_id) ?? new Map();
    const cells = new Map(); // slate_key -> { pick, game, team, result } | null (no pick)
    const used = new Map();  // team -> slate_key
    let status = 'alive', outSlate = null, outReason = null, survived = 0;
    for (const p of picksBySlate.values()) used.set(p.team || teamOf(byId.get(p.game_id) ?? {}, p.picked), p.slate_key);
    for (const k of played) {
      const p = picksBySlate.get(k);
      if (!p) {
        cells.set(k, null);
        if (allKicked(k)) { status = 'out'; outSlate = k; outReason = 'missed'; break; }
        continue;
      }
      const g = byId.get(p.game_id) ?? null;
      const team = p.team || (g ? teamOf(g, p.picked) : '');
      const result = pickResult(g, p.picked);
      cells.set(k, { pick: p, game: g, team, result });
      if (result === 'won') survived += 1;
      if (result === 'out') { status = 'out'; outSlate = k; outReason = outcome(g) === 'TIE' ? 'tied' : 'lost'; break; }
    }
    return { ...e, status, outSlate, outLabel: outSlate ? labels.get(outSlate) ?? outSlate : null, outReason, cells, used, survived };
  });

  // Alive first, then the fallen, most recent first.
  rows.sort((a, b) => (a.status === b.status ? 0 : a.status === 'alive' ? -1 : 1) || (b.outSlate ?? '').localeCompare(a.outSlate ?? '') || b.survived - a.survived);

  const alive = rows.filter((r) => r.status === 'alive');
  let winners = [];
  if (rows.length && !alive.length) {
    const last = rows.reduce((m, r) => (r.outSlate > m ? r.outSlate : m), '');
    winners = rows.filter((r) => r.outSlate === last);
  }
  return {
    rows, alive: alive.length, complete: rows.length > 0 && alive.length === 0, winners, start,
    slates: played.map((k) => ({ key: k, label: labels.get(k) ?? k })),
  };
}

// "Out in Week 3: took DAL, lost 27-20" / "Out in Week 4: no pick".
export function outText(row, { homeFirst = false } = {}) {
  if (row.status !== 'out') return '';
  const cell = row.cells.get(row.outSlate);
  if (!cell) return `Out in ${row.outLabel}: no pick`;
  const g = cell.game;
  const score = g ? (cell.pick.picked === 'HOME' ? `${g.home_score}-${g.away_score}` : `${g.away_score}-${g.home_score}`) : '';
  const how = row.outReason === 'tied' ? `tied ${score}` : `lost ${score}`;
  return `Out in ${row.outLabel}: took ${cell.team}, ${how}`;
}

// Pot and shares, same shape as potFor().
export function survivorPot(entries, feeCents, winners = []) {
  const pot = entries.length * feeCents;
  return { pot, share: winners.length ? Math.floor(pot / winners.length) : 0 };
}

// Who is alive and has no team for this slate: the people a lock warning or
// a morning reminder should reach. User ids.
export function survivorNeeds(games, entries, picks, slateKey, { now = Date.now() } = {}) {
  const { rows } = survivorStandings(games, entries, picks, { now });
  return rows.filter((r) => r.status === 'alive' && !r.cells.get(slateKey)).map((r) => r.user_id);
}

// Plain facts for the recap: how many stand, who fell this slate and how.
// `names.get(id)` gives a display name. Empty string when nobody is in.
export function survivorRecapFacts(games, entries, picks, slateKey, names, { now = Date.now() } = {}) {
  const { rows, alive, complete, winners } = survivorStandings(games, entries, picks, { now });
  if (!rows.length) return '';
  const name = (id) => names.get(id) ?? 'Player';
  const fell = rows.filter((r) => r.status === 'out' && r.outSlate === slateKey);
  const lines = [];
  if (complete) lines.push(`Survivor pool is over: ${winners.map((w) => name(w.user_id)).join(' and ')} ${winners.length > 1 ? 'fell together and split the pot' : 'outlasted everyone and takes the pot'}.`);
  else lines.push(`Survivor: ${alive} of ${rows.length} still alive.`);
  if (fell.length) lines.push(`Fell this week: ${fell.map((r) => `${name(r.user_id)} (${outText(r).replace(/^Out in [^:]+: /, '')})`).join('; ')}.`);
  return lines.join(' ');
}
