// Pure scoring logic. No database, no framework: entries + picks + games in,
// ranks and winners out. lib/stats.test.mjs is the self-check.

// games: this week's games. entries: this week's entries (any shape with id,
// user_id, tiebreaker). picks: rows for those entries.
export function weekResults(games, entries, picks) {
  const finals = games.filter((g) => g.state === 'post');
  const complete = games.length > 0 && finals.length === games.length;
  const lastGame = [...games].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)).at(-1);
  const actualTotal =
    complete && lastGame ? lastGame.home_score + lastGame.away_score : null;

  const byEntry = new Map(entries.map((e) => [e.id, []]));
  for (const p of picks) byEntry.get(p.entry_id)?.push(p);

  const rows = entries.map((e) => {
    const mine = byEntry.get(e.id) ?? [];
    let correct = 0;
    for (const g of finals) {
      const p = mine.find((x) => x.game_id === g.id);
      if (p && g.winner === p.picked) correct += 1; // ties and missing picks score for nobody
    }
    return {
      ...e,
      correct,
      incorrect: finals.length - correct,
      decided: finals.length,
    };
  });

  rows.sort((a, b) => b.correct - a.correct);
  // Competition ranking: ties share the better rank, the next rank is skipped.
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

  return { rows, complete, winners, actualTotal, lastGame };
}

// Season aggregates per user across every completed-or-partial week.
// payouts: recorded payout rows (money actually sent).
export function seasonStats(allGames, allEntries, allPicks, payouts) {
  const weeks = [...new Set(allEntries.map((e) => e.week))].sort((a, b) => a - b);
  const users = new Map(); // user_id -> aggregate

  for (const week of weeks) {
    const games = allGames.filter((g) => g.week === week);
    const entries = allEntries.filter((e) => e.week === week);
    const entryIds = new Set(entries.map((e) => e.id));
    const picks = allPicks.filter((p) => entryIds.has(p.entry_id));
    const { rows, complete, winners } = weekResults(games, entries, picks);
    const winnerIds = new Set(winners.map((w) => w.user_id));

    for (const r of rows) {
      const u = users.get(r.user_id) ?? {
        user_id: r.user_id,
        weeks: 0,
        wins: 0,
        correct: 0,
        incorrect: 0,
        rankSum: 0,
        rankedWeeks: 0,
        money: 0,
      };
      u.weeks += 1;
      u.correct += r.correct;
      u.incorrect += r.incorrect;
      if (complete) {
        u.rankSum += r.rank; // avg finish counts only completed weeks they entered
        u.rankedWeeks += 1;
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
    avgFinish: u.rankedWeeks ? u.rankSum / u.rankedWeeks : null,
    pct: u.correct + u.incorrect ? u.correct / (u.correct + u.incorrect) : 0,
  }));
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
