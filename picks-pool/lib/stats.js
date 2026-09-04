// Pure scoring logic. No database, no framework: games + entries + picks in,
// ranks and winners out. lib/stats.test.mjs is the self-check.

// games: one slate's games. entries: that slate's entries (any shape with id,
// user_id, tiebreaker). picks: rows for those entries.
export function slateResults(games, entries, picks) {
  const finals = games.filter((g) => g.state === 'post');
  const live = games.filter((g) => g.state === 'in');
  const complete = games.length > 0 && finals.length === games.length;
  const lastGame = [...games].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff) || String(a.id).localeCompare(String(b.id))).at(-1);
  const actualTotal =
    complete && lastGame ? lastGame.home_score + lastGame.away_score : null;

  const byEntry = new Map(entries.map((e) => [e.id, new Map()]));
  for (const p of picks) byEntry.get(p.entry_id)?.set(p.game_id, p.picked);

  const rows = entries.map((e) => {
    const mine = byEntry.get(e.id) ?? new Map();
    let correct = 0;
    for (const g of finals) {
      if (mine.get(g.id) === g.winner) correct += 1; // ties and missing picks score for nobody
    }
    // Games in progress where the picked side currently leads. Display only.
    let leading = 0;
    for (const g of live) {
      const side = mine.get(g.id);
      if (!side) continue;
      const ahead = g.home_score > g.away_score ? 'HOME' : g.away_score > g.home_score ? 'AWAY' : 'TIE';
      if (ahead === side) leading += 1;
    }
    return {
      ...e,
      correct,
      incorrect: finals.length - correct,
      decided: finals.length,
      leading,
      picked: mine.size,
    };
  });

  rows.sort((a, b) => b.correct - a.correct || b.leading - a.leading);
  // Competition ranking on correct picks only: ties share the better rank,
  // the next rank is skipped. "leading" only orders the display.
  rows.forEach((r, i) => {
    r.rank = i > 0 && r.correct === rows[i - 1].correct ? rows[i - 1].rank : i + 1;
  });

  let winners = [];
  if (complete && rows.length) {
    const top = rows.filter((r) => r.rank === 1);
    if (top.length === 1 || actualTotal == null) {
      winners = top;
    } else {
      const dist = (r) =>
        r.tiebreaker == null ? Infinity : Math.abs(r.tiebreaker - actualTotal);
      const best = Math.min(...top.map(dist));
      winners = top.filter((r) => dist(r) === best);
      if (winners.length === 0) winners = top; // nobody entered a tiebreaker: split
    }
  }

  return { rows, complete, winners, actualTotal, lastGame, finals: finals.length, live: live.length };
}

// Season aggregates per user across every slate with entries.
// payouts: recorded payout rows (money actually sent).
export function seasonStats(allGames, allEntries, allPicks, payouts) {
  const slates = [...new Set(allEntries.map((e) => e.slate_key))].sort();
  const users = new Map(); // user_id -> aggregate

  for (const key of slates) {
    const games = allGames.filter((g) => g.slate_key === key);
    const entries = allEntries.filter((e) => e.slate_key === key);
    const entryIds = new Set(entries.map((e) => e.id));
    const picks = allPicks.filter((p) => entryIds.has(p.entry_id));
    const { rows, complete, winners } = slateResults(games, entries, picks);
    const winnerIds = new Set(winners.map((w) => w.user_id));

    for (const r of rows) {
      const u = users.get(r.user_id) ?? {
        user_id: r.user_id,
        slates: 0,
        wins: 0,
        correct: 0,
        incorrect: 0,
        rankSum: 0,
        rankedSlates: 0,
        money: 0,
      };
      u.slates += 1;
      u.correct += r.correct;
      u.incorrect += r.incorrect;
      if (complete) {
        u.rankSum += r.rank; // avg finish counts only completed slates they entered
        u.rankedSlates += 1;
        if (winnerIds.has(r.user_id)) u.wins += 1;
      }
      users.set(r.user_id, u);
    }
  }

  for (const p of payouts ?? []) {
    const u = users.get(p.user_id);
    if (u) u.money += p.amount_cents;
  }

  return [...users.values()].map((u) => ({
    ...u,
    avgFinish: u.rankedSlates ? u.rankSum / u.rankedSlates : null,
    pct: u.correct + u.incorrect ? u.correct / (u.correct + u.incorrect) : 0,
  }));
}

// Pot and shares for one slate. Winners split evenly, remainder stays unpaid
// (cents are cents; the commissioner rounds however the league likes).
export function potFor(entries, feeCents, winners = []) {
  const pot = entries.length * feeCents;
  const share = winners.length ? Math.floor(pot / winners.length) : 0;
  return { pot, share };
}

export const money = (cents) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function venmoLink(handle, amountCents, note) {
  const user = String(handle || '').replace(/^@/, '');
  const q = new URLSearchParams({
    txn: 'pay',
    amount: (amountCents / 100).toFixed(2),
    note,
  });
  return `https://account.venmo.com/u/${encodeURIComponent(user)}?${q}`;
}

// Black or white text for a team-colored background.
export function contrastText(hex) {
  const v = String(hex || '').replace('#', '');
  if (v.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.4 ? '#111111' : '#ffffff';
}
