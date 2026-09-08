// Self-check for duels. Run: npm run check
import assert from 'node:assert';
import { pairings, duelists, slateDuels, duelSeason, recordText } from './duels.js';

// Six people: five rounds, everyone meets everyone exactly once.
const six = ['a', 'b', 'c', 'd', 'e', 'f'];
const seen = new Map();
for (let r = 0; r < 5; r++) {
  const { pairs, bye } = pairings(six, r);
  assert.equal(pairs.length, 3);
  assert.equal(bye, null);
  for (const [x, y] of pairs) { const k = `${x}${y}`; assert.ok(!seen.has(k), `repeat ${k} in round ${r}`); seen.set(k, r); }
}
assert.equal(seen.size, 15);
// Round 5 wraps back to round 0, and the order of the ids does not matter.
assert.deepEqual(pairings(six, 5).pairs, pairings(six, 0).pairs);
assert.deepEqual(pairings(['f', 'a', 'c', 'e', 'b', 'd'], 2).pairs, pairings(six, 2).pairs);
// Five people: two duels and a bye, and the bye moves around.
const byes = new Set([0, 1, 2, 3, 4].map((r) => pairings(['a', 'b', 'c', 'd', 'e'], r).bye));
assert.equal(byes.size, 5);
assert.deepEqual(pairings(['a'], 0), { pairs: [], bye: 'a' });
assert.deepEqual(pairings([], 0), { pairs: [], bye: null });

// Late entrants sit the week out.
const games = [{ kickoff: '2026-09-13T17:00:00Z' }, { kickoff: '2026-09-14T00:20:00Z' }];
const entries = [
  { user_id: 'colin', created_at: '2026-09-10T00:00:00Z' }, { user_id: 'kevin', created_at: '2026-09-12T00:00:00Z' },
  { user_id: 'sam', created_at: '2026-09-13T20:00:00Z' }, { user_id: 'jess' },
];
assert.deepEqual(duelists(games, entries).sort(), ['colin', 'jess', 'kevin']);

// One slate: points decide, a live slate only says who leads.
const rows = [{ user_id: 'colin', points: 9 }, { user_id: 'kevin', points: 7 }, { user_id: 'jess', points: 9 }, { user_id: 'sam', points: 12 }];
const live = slateDuels(games, entries, rows, 0);
assert.equal(live.duels.length, 1);
assert.equal(live.bye !== null, true);
assert.equal(live.duels[0].winner, null);
const done = slateDuels(games, entries, rows, 0, { complete: true });
const d = done.duels[0];
assert.ok(d.winner === 'colin' || d.winner === 'jess' || d.tie); // whichever pair round 0 dealt
// A season: records and head to head accumulate only from complete slates.
const s1 = { games, entries: entries.slice(0, 2), rows: rows.slice(0, 2), complete: true };          // colin 9 vs kevin 7
const s2 = { games, entries: entries.slice(0, 2), rows: [{ user_id: 'colin', points: 5 }, { user_id: 'kevin', points: 5 }], complete: true }; // tie
const s3 = { games, entries: entries.slice(0, 2), rows: [{ user_id: 'colin', points: 1 }, { user_id: 'kevin', points: 8 }], complete: false };
const season = duelSeason([s1, s2, s3]);
assert.deepEqual({ ...season.get('colin'), vs: undefined }, { won: 1, lost: 0, tied: 1, vs: undefined });
assert.deepEqual(season.get('kevin').vs.get('colin'), { won: 0, lost: 1, tied: 1 });
assert.equal(recordText(season.get('colin')), '1-0-1');
assert.equal(recordText(season.get('kevin')), '0-1-1');
assert.equal(recordText(undefined), '0-0');
assert.equal(recordText({ won: 3, lost: 2, tied: 0 }), '3-2');

console.log('duels self-check: all good');
