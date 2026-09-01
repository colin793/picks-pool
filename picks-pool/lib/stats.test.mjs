// Self-check for the money-adjacent logic. Run: npm run check
import assert from 'node:assert';
import { weekResults, seasonStats, venmoLink } from './stats.js';

const g = (id, winner, kickoff, hs = 20, as = 10) => ({
  id, week: 1, kickoff, state: winner ? 'post' : 'pre',
  winner, home_score: hs, away_score: as,
});
const games = [
  g('a', 'HOME', '2026-09-10T00:15Z'),
  g('b', 'AWAY', '2026-09-13T17:00Z'),
  g('c', 'TIE', '2026-09-13T17:00Z', 17, 17),
  g('d', 'HOME', '2026-09-15T00:15Z', 27, 24), // last game, total 51
];
const entries = [
  { id: 'e1', user_id: 'colin', week: 1, tiebreaker: 45 },
  { id: 'e2', user_id: 'kevin', week: 1, tiebreaker: 60 },
  { id: 'e3', user_id: 'brian', week: 1, tiebreaker: null },
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

const r = weekResults(games, entries, picks);
assert.equal(r.complete, true);
assert.equal(r.actualTotal, 51);
const by = Object.fromEntries(r.rows.map((x) => [x.user_id, x]));
assert.equal(by.colin.correct, 2);
assert.equal(by.kevin.correct, 2);
assert.equal(by.brian.correct, 0);
assert.equal(by.brian.incorrect, 4); // no pick = loss on every decided game
// Both on 2 correct: colin |45-51|=6 beats kevin |60-51|=9
assert.deepEqual(r.winners.map((w) => w.user_id), ['colin']);
// Competition ranking: 1, 1, 3
assert.equal(by.colin.rank, 1);
assert.equal(by.kevin.rank, 1);
assert.equal(by.brian.rank, 3);

// Tiebreaker dead heat splits
const r2 = weekResults(games, entries.map((e) => ({ ...e, tiebreaker: 50 })), picks);
assert.deepEqual(r2.winners.map((w) => w.user_id).sort(), ['colin', 'kevin']);

// Season aggregates
const s = seasonStats(games, entries, picks, [{ user_id: 'colin', amount_cents: 300 }]);
const colin = s.find((x) => x.user_id === 'colin');
assert.equal(colin.wins, 1);
assert.equal(colin.money, 300);
assert.equal(colin.avgFinish, 1);
assert.ok(Math.abs(colin.pct - 0.5) < 1e-9);

// Incomplete week: no winners, no avg-finish contribution
const r3 = weekResults(games.map((x) => ({ ...x, state: 'pre', winner: null })), entries, picks);
assert.equal(r3.complete, false);
assert.equal(r3.winners.length, 0);

assert.equal(
  venmoLink('@colin-b', 100, 'Week 1'),
  'https://account.venmo.com/u/colin-b?txn=pay&amount=1.00&note=Week+1'
);

console.log('stats self-check: all good');
