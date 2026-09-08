// Self-check for the weekly draft. Run: npm run check
import assert from 'node:assert';
import { slateTeams, draftOrder, snakeDraft, draftResults, teamKey } from './draft.js';

const g = (id, home, away, spread, kickoff, state = 'pre', hs = 0, as = 0) => ({ id, home_abbr: home, away_abbr: away, home_name: home, away_name: away, home_spread: spread, kickoff, state, home_score: hs, away_score: as });
const games = [
  g('1', 'KC', 'LV', -10, '2026-09-13T17:00Z'),   // KC by 10
  g('2', 'DAL', 'PHI', 3, '2026-09-13T17:00Z'),    // PHI by 3
  g('3', 'NYJ', 'MIA', null, '2026-09-14T00:20Z'), // no line
];
const teams = slateTeams(games);
assert.equal(teams.length, 6);
assert.deepEqual(teams.slice(0, 2).map((t) => t.abbr), ['KC', 'PHI']);      // favorites first, biggest line first
assert.deepEqual(teams.slice(-2).map((t) => t.abbr), ['DAL', 'LV']);          // the biggest dog last
assert.equal(teams[0].key, teamKey('1', 'HOME'));

// The order is a shuffle that everyone can reproduce from the seed.
assert.deepEqual(draftOrder(['c', 'a', 'b'], 'L1-2026-2-01'), draftOrder(['b', 'c', 'a'], 'L1-2026-2-01'));
assert.notDeepEqual(draftOrder(['a', 'b', 'c', 'd', 'e', 'f'], 'seed-one'), draftOrder(['a', 'b', 'c', 'd', 'e', 'f'], 'seed-two'));
assert.deepEqual([...draftOrder(['a', 'b', 'c'], 'x')].sort(), ['a', 'b', 'c']);

// Three people, six teams: two rounds, snake, wishes honored when free.
const rankings = new Map([
  ['colin', [teamKey('3', 'AWAY'), teamKey('1', 'HOME')]],  // wants MIA, then KC
  ['kevin', [teamKey('1', 'HOME')]],                        // wants KC, then whatever is best
  ['sam', []],                                              // never ranked: takes the default order
]);
const d = snakeDraft(['colin', 'kevin', 'sam'], rankings, teams, 'L1-w1');
assert.equal(d.per, 2);
assert.equal(d.picks.length, 6);
assert.deepEqual(d.undrafted, []);
assert.deepEqual(d.picks.map((p) => p.pick_no), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(d.picks.slice(0, 3).map((p) => p.user_id), d.order);
assert.deepEqual(d.picks.slice(3).map((p) => p.user_id), [...d.order].reverse());       // the snake
const mine = (u) => d.picks.filter((p) => p.user_id === u).map((p) => p.team);
assert.ok(mine('colin').includes(teamKey('3', 'AWAY')));                                 // MIA was nobody else's wish
const kc = d.picks.find((p) => p.team === teamKey('1', 'HOME'));
assert.equal(kc.user_id, d.order[0]);                                                      // everyone's first wish (sam's by default) is KC: the first pick takes it
assert.equal(new Set(d.picks.map((p) => p.team)).size, 6);                              // no team twice
// Seven teams for three people: two each, one left over.
const d7 = snakeDraft(['a', 'b', 'c'], new Map(), [...teams, { key: 'x:HOME' }], 's');
assert.equal(d7.picks.length, 6);
assert.deepEqual(d7.undrafted, ['x:HOME']);
assert.deepEqual(snakeDraft([], new Map(), teams, 's').picks, []);

// Scoring: wins, then margin. Ties are losses, pending is pending.
const finals = [
  g('1', 'KC', 'LV', -10, '2026-09-13T17:00Z', 'post', 30, 10),   // KC by 20
  g('2', 'DAL', 'PHI', 3, '2026-09-13T17:00Z', 'post', 21, 24),   // PHI by 3
  g('3', 'NYJ', 'MIA', null, '2026-09-14T00:20Z', 'in', 7, 7),
];
const picks = [
  { user_id: 'colin', team: teamKey('1', 'HOME'), round: 1, pick_no: 1 }, { user_id: 'colin', team: teamKey('2', 'HOME'), round: 2, pick_no: 4 },
  { user_id: 'kevin', team: teamKey('2', 'AWAY'), round: 1, pick_no: 2 }, { user_id: 'kevin', team: teamKey('3', 'AWAY'), round: 2, pick_no: 3 },
];
const r = draftResults(picks, finals);
const by = Object.fromEntries(r.rows.map((x) => [x.user_id, x]));
assert.equal(by.colin.wins, 1); assert.equal(by.colin.losses, 1); assert.equal(by.colin.margin, 20);
assert.equal(by.kevin.wins, 1); assert.equal(by.kevin.pending, 1);
assert.equal(by.colin.rank, 1); assert.equal(by.kevin.rank, 2);     // same wins, KC's margin breaks it
assert.equal(r.complete, false);
assert.deepEqual(by.kevin.teams.map((t) => t.result), ['won', 'live']);
const done = draftResults(picks, finals.map((x) => (x.id === '3' ? { ...x, state: 'post', home_score: 20, away_score: 27 } : x)));
assert.equal(done.complete, true);
assert.deepEqual(done.winners.map((w) => w.user_id), ['kevin']);   // MIA wins: kevin 2-0
assert.deepEqual(draftResults([], finals).winners, []);

console.log('draft self-check: all good');
