// Self-check for the money-adjacent logic. Run: npm run check
import assert from 'node:assert';
import { slateResults, seasonStats, potFor, venmoLink, contrastText } from './stats.js';

const W1 = '2026-2-01';
const g = (id, winner, kickoff, hs = 20, as = 10, slate = W1, state) => ({
  id, slate_key: slate, kickoff, state: state ?? (winner ? 'post' : 'pre'),
  winner, home_score: hs, away_score: as,
});
const games = [
  g('a', 'HOME', '2026-09-10T00:15Z'),
  g('b', 'AWAY', '2026-09-13T17:00Z'),
  g('c', 'TIE', '2026-09-13T17:00Z', 17, 17),
  g('d', 'HOME', '2026-09-15T00:15Z', 27, 24), // last game, total 51
];
const entries = [
  { id: 'e1', user_id: 'colin', slate_key: W1, tiebreaker: 45 },
  { id: 'e2', user_id: 'kevin', slate_key: W1, tiebreaker: 60 },
  { id: 'e3', user_id: 'brian', slate_key: W1, tiebreaker: null },
];
const picks = [
  { entry_id: 'e1', game_id: 'a', picked: 'HOME' },
  { entry_id: 'e1', game_id: 'b', picked: 'AWAY' },
  { entry_id: 'e1', game_id: 'c', picked: 'HOME' }, // tie: no point
  { entry_id: 'e1', game_id: 'd', picked: 'AWAY' },
  { entry_id: 'e2', game_id: 'a', picked: 'HOME' },
  { entry_id: 'e2', game_id: 'b', picked: 'HOME' },
  { entry_id: 'e2', game_id: 'd', picked: 'HOME' }, // missing pick on c = loss
  { entry_id: 'e3', game_id: 'a', picked: 'AWAY' },
];

// ---- one completed slate ----
const r = slateResults(games, entries, picks);
assert.equal(r.complete, true);
assert.equal(r.actualTotal, 51);
const by = Object.fromEntries(r.rows.map((x) => [x.user_id, x]));
assert.equal(by.colin.correct, 2);
assert.equal(by.kevin.correct, 2);
assert.equal(by.brian.correct, 0);
assert.equal(by.brian.incorrect, 4); // no pick = loss on every decided game
assert.equal(by.brian.picked, 1);
// Both on 2 correct: colin |45-51|=6 beats kevin |60-51|=9
assert.deepEqual(r.winners.map((w) => w.user_id), ['colin']);
// Competition ranking: 1, 1, 3
assert.equal(by.colin.rank, 1);
assert.equal(by.kevin.rank, 1);
assert.equal(by.brian.rank, 3);

// Tiebreaker dead heat splits
const r2 = slateResults(games, entries.map((e) => ({ ...e, tiebreaker: 50 })), picks);
assert.deepEqual(r2.winners.map((w) => w.user_id).sort(), ['colin', 'kevin']);

// Nobody entered a tiebreaker: split among the tied leaders
const r2b = slateResults(games, entries.map((e) => ({ ...e, tiebreaker: null })), picks);
assert.deepEqual(r2b.winners.map((w) => w.user_id).sort(), ['colin', 'kevin']);

// Pot math
assert.deepEqual(potFor(entries, 100, r2.winners), { pot: 300, share: 150 });
assert.deepEqual(potFor(entries, 100, []), { pot: 300, share: 0 });
assert.deepEqual(potFor(entries, 100, r2.winners.concat([{}])), { pot: 300, share: 100 });

// ---- incomplete slate ----
const r3 = slateResults(games.map((x) => ({ ...x, state: 'pre', winner: null })), entries, picks);
assert.equal(r3.complete, false);
assert.equal(r3.winners.length, 0);
assert.equal(r3.actualTotal, null);

// ---- live slate: "leading" orders the board but never decides rank ----
const liveGames = [
  g('a', 'HOME', '2026-09-10T00:15Z'),                          // final: colin, kevin right
  g('b', null, '2026-09-13T17:00Z', 3, 14, W1, 'in'),           // away leads: colin's AWAY pick leading
  g('c', null, '2026-09-13T17:00Z', 0, 0, W1, 'in'),            // tied, nobody leads
  g('d', null, '2026-09-15T00:15Z'),
];
const r4 = slateResults(liveGames, entries, picks);
const live = Object.fromEntries(r4.rows.map((x) => [x.user_id, x]));
assert.equal(r4.complete, false);
assert.equal(live.colin.correct, 1);
assert.equal(live.colin.leading, 1);
assert.equal(live.kevin.correct, 1);
assert.equal(live.kevin.leading, 0);
assert.equal(live.colin.rank, 1);
assert.equal(live.kevin.rank, 1); // still tied on correct; leading is not a tiebreaker
assert.equal(r4.rows[0].user_id, 'colin'); // but colin shows first
assert.equal(r4.live, 2);

// ---- season across slates, including a postseason slate ----
const WC = '2026-3-01';
const wcGames = [g('p1', 'AWAY', '2027-01-10T18:00Z', 10, 20, WC), g('p2', 'HOME', '2027-01-11T01:00Z', 31, 7, WC)];
const wcEntries = [
  { id: 'e4', user_id: 'colin', slate_key: WC, tiebreaker: 40 },
  { id: 'e5', user_id: 'brian', slate_key: WC, tiebreaker: 38 }, // closer to 38
];
const wcPicks = [
  { entry_id: 'e4', game_id: 'p1', picked: 'AWAY' },
  { entry_id: 'e4', game_id: 'p2', picked: 'HOME' },
  { entry_id: 'e5', game_id: 'p1', picked: 'AWAY' },
  { entry_id: 'e5', game_id: 'p2', picked: 'HOME' },
];
const s = seasonStats(
  [...games, ...wcGames],
  [...entries, ...wcEntries],
  [...picks, ...wcPicks],
  [{ user_id: 'colin', amount_cents: 300 }, { user_id: 'brian', amount_cents: 200 }]
);
const colin = s.find((x) => x.user_id === 'colin');
const brian = s.find((x) => x.user_id === 'brian');
assert.equal(colin.slates, 2);
assert.equal(colin.wins, 1);      // won week 1, lost the wild card tiebreaker
assert.equal(brian.wins, 1);      // 2-0 in the wild card, tiebreaker 38 vs total 38
assert.equal(colin.money, 300);
assert.equal(brian.money, 200);
assert.equal(colin.avgFinish, 1); // rank 1 both slates (tied on top in WC)
assert.equal(brian.avgFinish, 2); // (3 + 1) / 2
assert.ok(Math.abs(colin.pct - 4 / 6) < 1e-9);

// A withdrawal is invisible to the season: the slate is simply one they did
// not play, and a stray payout row for a departed player is ignored.
const sw = seasonStats(
  [...games, ...wcGames],
  [...entries.filter((e) => e.id !== 'e2'), ...wcEntries],
  [...picks, ...wcPicks],
  [{ user_id: 'kevin', amount_cents: 500 }]
);
assert.equal(sw.find((x) => x.user_id === 'kevin'), undefined);
assert.equal(sw.find((x) => x.user_id === 'colin').avgFinish, 1);
assert.equal(sw.find((x) => x.user_id === 'brian').avgFinish, 1.5); // 2nd, then 1st

// An unfinished postseason slate counts as one they entered, but has no finish
// to average and no decided games to move the percentage.
const SB = '2026-3-05';
const sbGames = [g('sb1', null, '2027-02-08T23:30Z', 0, 0, SB, 'in')];
const s2 = seasonStats(
  [...games, ...wcGames, ...sbGames],
  [...entries, ...wcEntries, { id: 'e6', user_id: 'colin', slate_key: SB, tiebreaker: 50 }],
  [...picks, ...wcPicks, { entry_id: 'e6', game_id: 'sb1', picked: 'HOME' }],
  []
);
const colin2 = s2.find((x) => x.user_id === 'colin');
assert.equal(colin2.slates, 3);
assert.equal(colin2.wins, 1);
assert.equal(colin2.avgFinish, 1);
assert.ok(Math.abs(colin2.pct - 4 / 6) < 1e-9);

// Slate keys and labels are checked against their builders in
// lib/scores/slates.test.mjs, including postseason and date-mode ordering.

// ---- draws as a pickable outcome (soccer): a TIE pick on a level game wins, others lose ----
const drawGames = [g('s1', 'TIE', '2026-09-12T14:00Z', 1, 1, '2026-09-12'), g('s2', 'HOME', '2026-09-12T16:30Z', 2, 0, '2026-09-12')];
const drawEntries = [{ id: 'd1', user_id: 'colin', slate_key: '2026-09-12', tiebreaker: 3 }, { id: 'd2', user_id: 'kevin', slate_key: '2026-09-12', tiebreaker: 2 }];
const drawPicks = [
  { entry_id: 'd1', game_id: 's1', picked: 'TIE' }, { entry_id: 'd1', game_id: 's2', picked: 'HOME' },
  { entry_id: 'd2', game_id: 's1', picked: 'HOME' }, { entry_id: 'd2', game_id: 's2', picked: 'HOME' },
];
const rd = slateResults(drawGames, drawEntries, drawPicks);
assert.deepEqual(rd.winners.map((w) => w.user_id), ['colin']);
assert.equal(rd.rows.find((r) => r.user_id === 'colin').correct, 2);
assert.equal(rd.rows.find((r) => r.user_id === 'kevin').correct, 1);

// ---- ties and missing picks, stated plainly ----
// A tie is decided, so it counts against everyone who picked a side, and the
// game nobody picked counts against them too. Neither ever scores a point.
assert.equal(by.colin.decided, 4);
assert.equal(by.colin.picked, 4);
assert.equal(by.kevin.picked, 3);    // kevin never picked the tie game
assert.equal(by.kevin.incorrect, 2); // the tie he picked wrong, and the one he skipped

// ---- withdrawn entries ----
// Withdrawing removes the entry; the database cascades the picks, but the
// scorer must not care if a caller hands it orphans.
const survivors = entries.filter((e) => e.id !== 'e2'); // kevin withdraws
const rw = slateResults(games, survivors, picks);       // kevin's picks left behind
assert.equal(rw.rows.length, 2);
assert.ok(!rw.rows.some((r) => r.user_id === 'kevin'));
const wby = Object.fromEntries(rw.rows.map((x) => [x.user_id, x]));
assert.equal(wby.colin.correct, 2);
assert.equal(wby.brian.correct, 0);
assert.equal(wby.colin.rank, 1);
assert.equal(wby.brian.rank, 2);
// With kevin gone colin leads outright, so the tiebreaker never runs.
assert.deepEqual(rw.winners.map((w) => w.user_id), ['colin']);
// And he is out of the pot: two entries, one winner, the whole $2.
assert.deepEqual(potFor(survivors, 100, rw.winners), { pot: 200, share: 200 });

// ---- split pots ----
// Three winners on a $5 pot take $1.66 each; the odd cents stay unpaid rather
// than inventing money.
assert.deepEqual(potFor([{}, {}, {}, {}, {}], 100, [{}, {}, {}]), { pot: 500, share: 166 });
assert.deepEqual(potFor([], 100, []), { pot: 0, share: 0 });
assert.deepEqual(potFor(entries, 0, r2.winners), { pot: 0, share: 0 }); // a free league still ranks

// ---- tiebreaker dead heats ----
// Equidistant from opposite sides is a dead heat: 44 and 58 against a real 51.
const deadHeat = slateResults(
  games,
  [{ ...entries[0], tiebreaker: 44 }, { ...entries[1], tiebreaker: 58 }, entries[2]],
  picks
);
assert.equal(deadHeat.actualTotal, 51);
assert.deepEqual(deadHeat.winners.map((w) => w.user_id).sort(), ['colin', 'kevin']);
// Any guess beats no guess.
const oneGuess = slateResults(
  games,
  [entries[0], { ...entries[1], tiebreaker: null }, entries[2]],
  picks
);
assert.deepEqual(oneGuess.winners.map((w) => w.user_id), ['colin']);

// ---- a date-mode slate, scored end to end ----
const NOV14 = '2026-11-14';
const nbaGames = [
  g('n1', 'HOME', '2026-11-15T00:00Z', 112, 104, NOV14),
  g('n2', 'AWAY', '2026-11-15T03:00Z', 98, 110, NOV14),
  g('n3', 'HOME', '2026-11-15T03:00Z', 120, 118, NOV14), // same tip-off as n2
];
const nbaEntries = [
  { id: 'n1e', user_id: 'colin', slate_key: NOV14, tiebreaker: 240 },
  { id: 'n2e', user_id: 'kevin', slate_key: NOV14, tiebreaker: 236 },
];
const nbaPicks = [
  { entry_id: 'n1e', game_id: 'n1', picked: 'HOME' },
  { entry_id: 'n1e', game_id: 'n2', picked: 'AWAY' },
  { entry_id: 'n1e', game_id: 'n3', picked: 'AWAY' },
  { entry_id: 'n2e', game_id: 'n1', picked: 'HOME' },
  { entry_id: 'n2e', game_id: 'n2', picked: 'AWAY' },
  { entry_id: 'n2e', game_id: 'n3', picked: 'HOME' },
];
const rn = slateResults(nbaGames, nbaEntries, nbaPicks);
assert.equal(rn.complete, true);
// Two games tip off together, so the id decides which one carries the total.
// It only has to be deterministic, or the tiebreaker moves between renders.
assert.equal(rn.lastGame.id, 'n3');
assert.equal(rn.actualTotal, 238);
assert.deepEqual(rn.winners.map((w) => w.user_id), ['kevin']); // 3-0, no tiebreaker needed

// ---- helpers ----
assert.equal(
  venmoLink('@colin-b', 100, 'Week 1'),
  'https://account.venmo.com/u/colin-b?txn=pay&amount=1.00&note=Week+1'
);
assert.equal(contrastText('#002a5c'), '#ffffff'); // navy
assert.equal(contrastText('#ffb612'), '#111111'); // Steelers gold
assert.equal(contrastText(''), '#ffffff');

console.log('stats self-check: all good');
