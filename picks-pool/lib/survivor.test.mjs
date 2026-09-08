// Self-check for survivor. Run: npm run check
import assert from 'node:assert';
import { survivorStandings, entriesOpen, pickResult, outText, survivorPot, startSlate } from './survivor.js';

const NOW = Date.parse('2026-09-20T21:00:00Z'); // Week 2, Sunday late afternoon
const W1 = '2026-2-01', W2 = '2026-2-02', W3 = '2026-2-03';
const g = (id, slate, label, kickoff, home, away, hs = 0, as = 0, state = 'pre') => ({
  id, slate_key: slate, slate_label: label, kickoff, home_abbr: home, away_abbr: away, home_score: hs, away_score: as, state,
  winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null,
});
const games = [
  g('a', W1, 'Week 1', '2026-09-13T17:00:00Z', 'KC', 'BUF', 31, 28, 'post'),
  g('b', W1, 'Week 1', '2026-09-13T17:00:00Z', 'PHI', 'DAL', 20, 27, 'post'),
  g('c', W1, 'Week 1', '2026-09-14T00:20:00Z', 'PIT', 'CLE', 13, 13, 'post'),
  g('d', W2, 'Week 2', '2026-09-20T17:00:00Z', 'DET', 'MIN', 34, 10, 'post'),
  g('e', W2, 'Week 2', '2026-09-20T20:25:00Z', 'CHI', 'GB', 14, 17, 'in'),
  g('f', W2, 'Week 2', '2026-09-21T00:20:00Z', 'CIN', 'BAL'),
];
const entries = ['colin', 'kevin', 'brian', 'sam', 'jess'].map((u) => ({ user_id: u, paid: true }));
const pk = (user, slate, game, side, team) => ({ user_id: user, slate_key: slate, game_id: game, picked: side, team });
const picks = [
  pk('colin', W1, 'a', 'HOME', 'KC'), pk('colin', W2, 'e', 'AWAY', 'GB'),   // alive, live pick leading
  pk('kevin', W1, 'b', 'HOME', 'PHI'),                                        // lost week 1
  pk('brian', W1, 'a', 'HOME', 'KC'), pk('brian', W2, 'd', 'HOME', 'DET'),   // alive, 2 wins
  pk('sam', W1, 'c', 'HOME', 'PIT'),                                          // tied: out
  pk('jess', W1, 'a', 'HOME', 'KC'),                                          // no week 2 pick, week 2 not fully kicked off: still alive
];

const s = survivorStandings(games, entries, picks, { now: NOW });
const by = Object.fromEntries(s.rows.map((r) => [r.user_id, r]));
assert.equal(s.start, W1);
assert.deepEqual(s.slates.map((x) => x.key), [W1, W2]);
assert.equal(by.colin.status, 'alive');
assert.equal(by.colin.cells.get(W2).result, 'live');
assert.equal(by.brian.status, 'alive');
assert.equal(by.brian.survived, 2);
assert.equal(by.kevin.status, 'out');
assert.equal(by.kevin.outSlate, W1);
assert.equal(by.kevin.outReason, 'lost');
assert.equal(outText(by.kevin), 'Out in Week 1: took PHI, lost 20-27');
assert.equal(by.sam.status, 'out');
assert.equal(by.sam.outReason, 'tied');
assert.equal(outText(by.sam), 'Out in Week 1: took PIT, tied 13-13');
assert.equal(by.jess.status, 'alive');
assert.equal(by.jess.cells.get(W2), null);
assert.equal(s.alive, 3);
assert.equal(s.complete, false);
assert.deepEqual(s.winners, []);
assert.deepEqual([...by.colin.used.keys()].sort(), ['GB', 'KC']);
// Alive rows come first; among the fallen, the most recent first.
assert.deepEqual(s.rows.slice(0, 3).map((r) => r.status), ['alive', 'alive', 'alive']);

// Monday night: every Week 2 game has kicked off. Jess never picked: out, missed.
const MON = Date.parse('2026-09-21T00:30:00Z');
const s2 = survivorStandings(games, entries, picks, { now: MON });
const jess2 = s2.rows.find((r) => r.user_id === 'jess');
assert.equal(jess2.status, 'out');
assert.equal(jess2.outReason, 'missed');
assert.equal(outText(jess2), 'Out in Week 2: no pick');
assert.equal(s2.alive, 2);

// Week 3: Colin and Brian both lose the same week. Nobody left: they split.
const w3 = [...games, g('h', W3, 'Week 3', '2026-09-27T17:00:00Z', 'LAR', 'SF', 10, 24, 'post'), g('i', W3, 'Week 3', '2026-09-27T20:25:00Z', 'DEN', 'LV', 3, 27, 'post')];
const p3 = [...picks, pk('colin', W3, 'h', 'HOME', 'LAR'), pk('brian', W3, 'i', 'HOME', 'DEN')];
const s3 = survivorStandings(w3.map((x) => (x.id === 'e' ? { ...x, state: 'post', home_score: 14, away_score: 24, winner: 'AWAY' } : x)), entries, p3, { now: Date.parse('2026-09-28T12:00:00Z') });
assert.equal(s3.complete, true);
assert.deepEqual(s3.winners.map((w) => w.user_id).sort(), ['brian', 'colin']);
assert.deepEqual(survivorPot(entries, 1000, s3.winners), { pot: 5000, share: 2500 });
// If only Brian had lost in Week 3, Colin is the last one standing.
const s3b = survivorStandings(w3.map((x) => (x.id === 'e' ? { ...x, state: 'post', home_score: 14, away_score: 24, winner: 'AWAY' } : x)), entries,
  p3.map((p) => (p.user_id === 'colin' && p.slate_key === W3 ? { ...p, picked: 'AWAY', team: 'SF' } : p)), { now: Date.parse('2026-09-28T12:00:00Z') });
assert.equal(s3b.complete, false);
assert.equal(s3b.alive, 1);

// A pick on a game the standings do not know decides nothing.
assert.equal(pickResult(undefined, 'HOME'), 'pending');
assert.equal(pickResult(games[0], 'AWAY'), 'out');
assert.equal(pickResult(games[0], 'HOME'), 'won');

// Hidden picks are safe: with Colin's Week 2 pick absent (as another viewer
// would see it before kickoff), Colin is still alive, not "missed".
const hidden = picks.filter((p) => !(p.user_id === 'colin' && p.slate_key === W2));
assert.equal(survivorStandings(games, entries, hidden, { now: NOW }).rows.find((r) => r.user_id === 'colin').status, 'alive');

// Entries: open until the first slate's last game kicks off.
assert.equal(entriesOpen([], games, NOW), true);
assert.equal(entriesOpen(picks, games, Date.parse('2026-09-13T20:00:00Z')), true);  // Week 1 Sunday night still to come
assert.equal(entriesOpen(picks, games, NOW), false);                                 // Week 1 is done
assert.equal(entriesOpen(picks, games.filter((x) => x.slate_key === W2), NOW), false); // start slate unknown: closed
assert.equal(startSlate(picks), W1);

// Nobody entered yet.
const empty = survivorStandings(games, [], [], { now: NOW });
assert.equal(empty.complete, false);
assert.equal(empty.start, null);
assert.deepEqual(empty.slates, []);

console.log('survivor self-check: all good');

// ---- who needs a nudge, and what the recap says ----
import { survivorNeeds, survivorRecapFacts } from './survivor.js';
// Week 2, Sunday afternoon: Jess is alive with no team; Colin and Brian have picked; Kevin and Sam are out.
assert.deepEqual(survivorNeeds(games, entries, picks, W2, { now: NOW }), ['jess']);
// Nobody needs anything on a slate that has already been judged.
assert.deepEqual(survivorNeeds(games, entries, picks, W1, { now: NOW }), []);
const nm = new Map([['colin', 'Colin'], ['kevin', 'Kevin'], ['brian', 'Brian'], ['sam', 'Sam'], ['jess', 'Jess']]);
assert.equal(survivorRecapFacts(games, entries, picks, W1, nm, { now: NOW }),
  'Survivor: 3 of 5 still alive. Fell this week: Kevin (took PHI, lost 20-27); Sam (took PIT, tied 13-13).');
assert.equal(survivorRecapFacts(games, [], [], W1, nm, { now: NOW }), '');
assert.match(survivorRecapFacts(s3 && w3.map((x) => (x.id === 'e' ? { ...x, state: 'post', home_score: 14, away_score: 24, winner: 'AWAY' } : x)), entries, p3, W3, nm, { now: Date.parse('2026-09-28T12:00:00Z') }),
  /Survivor pool is over: Colin and Brian fell together and split the pot\./);
console.log('survivor nudges self-check: all good');
