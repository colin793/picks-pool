// Self-check for the little pops. Run: npm run check
import assert from 'node:assert';
import { countdown, isUpset, rivalryText, finaleText, sweatText, wrapText } from './moments.js';
import { slateResults } from './stats.js';

const NOW = Date.parse('2026-09-13T20:40:00Z');
const at = (min) => new Date(NOW + min * 60_000).toISOString();

// ---- countdown ----
assert.equal(countdown([{ kickoff: at(-10) }], NOW), null);
assert.equal(countdown([{ kickoff: at(25 * 60) }], NOW), null);
assert.deepEqual(countdown([{ kickoff: at(47) }, { kickoff: at(200) }], NOW).text, 'Next lock in 47 min');
assert.equal(countdown([{ kickoff: at(47) }], NOW).tone, 'warn');
assert.equal(countdown([{ kickoff: at(7) }], NOW).tone, 'urgent');
assert.equal(countdown([{ kickoff: at(220) }], NOW).text, 'Next lock in 3 h 40 min');
assert.equal(countdown([{ kickoff: at(220) }], NOW).tone, 'calm');
assert.equal(countdown([{ kickoff: new Date(NOW + 5000).toISOString() }], NOW).text, 'Next lock in 1 min');

// ---- upsets: the dog by 3+ wins outright ----
const fin = (spread, hs, as) => ({ state: 'post', home_spread: spread, home_score: hs, away_score: as, winner: hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE', home_abbr: 'H', away_abbr: 'A' });
assert.equal(isUpset(fin(-6.5, 17, 24)), true);   // home favored by 6.5, away won
assert.equal(isUpset(fin(-6.5, 24, 17)), false);
assert.equal(isUpset(fin(-2.5, 17, 24)), false);  // a coin flip is not an upset
assert.equal(isUpset(fin(3, 24, 17)), true);      // away favored by 3, home won
assert.equal(isUpset(fin(null, 17, 24)), false);
assert.equal(isUpset({ ...fin(-6.5, 17, 24), state: 'in' }), false);
assert.equal(isUpset(fin(-6.5, 20, 20)), false);

// ---- rivalry line ----
const names = new Map([['colin', { display_name: 'Colin' }], ['kevin', { display_name: 'Kevin' }], ['sam', { display_name: 'Sam' }]]);
const row = (user_id, correct, rank) => ({ user_id, correct, rank, id: `e-${user_id}` });
assert.equal(rivalryText([row('kevin', 9, 1), row('colin', 8, 2), row('sam', 5, 3)], 'colin', names), '1 behind Kevin');
assert.equal(rivalryText([row('kevin', 9, 1), row('colin', 9, 1), row('sam', 5, 3)], 'colin', names), 'Tied with Kevin at 9');
assert.equal(rivalryText([row('colin', 9, 1), row('kevin', 8, 2), row('sam', 5, 3)], 'colin', names), 'You lead by 1; Kevin is next');
assert.equal(rivalryText([row('kevin', 9, 1), row('colin', 8, 2), row('sam', 5, 3)], 'kevin', names), 'You lead by 1; Colin is next');
assert.equal(rivalryText([row('kevin', 10, 1), row('sam', 9, 2), row('colin', 8, 3)], 'sam', names), '1 behind Kevin');
assert.equal(rivalryText([row('kevin', 9, 1)], 'kevin', names), '');
assert.equal(rivalryText([row('kevin', 9, 1)], 'colin', names), '');

// ---- the finale ----
const W = '2026-2-01';
const g = (id, kickoff, opts = {}) => ({ id, slate_key: W, kickoff, state: 'post', winner: 'HOME', home_score: 20, away_score: 10, home_abbr: 'CIN', away_abbr: 'BAL', over_under: 47.5, ...opts });
const games = [g('a', '2026-09-13T17:00Z'), g('b', '2026-09-13T17:00Z'), g('c', '2026-09-14T00:20Z', { state: 'pre', winner: null, home_score: 0, away_score: 0 })];
const entries = [{ id: 'e-colin', user_id: 'colin', tiebreaker: 44 }, { id: 'e-kevin', user_id: 'kevin', tiebreaker: null }, { id: 'e-sam', user_id: 'sam', tiebreaker: 30 }];
const same = [
  { entry_id: 'e-colin', game_id: 'a', picked: 'HOME' }, { entry_id: 'e-colin', game_id: 'b', picked: 'HOME' }, { entry_id: 'e-colin', game_id: 'c', picked: 'HOME' },
  { entry_id: 'e-kevin', game_id: 'a', picked: 'HOME' }, { entry_id: 'e-kevin', game_id: 'b', picked: 'HOME' }, { entry_id: 'e-kevin', game_id: 'c', picked: 'HOME' },
  { entry_id: 'e-sam', game_id: 'a', picked: 'AWAY' },
];
let f = finaleText(games, entries, same, names, { me: 'colin' });
assert.equal(f.kind, 'tiebreaker');
assert.equal(f.title, 'Comes down to the tiebreaker in BAL @ CIN');
assert.equal(f.text, 'Tiebreakers reveal at kickoff. Vegas says 47.5.');   // Kevin's is hidden before kickoff
const liveGames = games.map((x) => (x.id === 'c' ? { ...x, state: 'in', home_score: 14, away_score: 17 } : x));
f = finaleText(liveGames, entries.map((e) => (e.user_id === 'kevin' ? { ...e, tiebreaker: 51 } : e)), same, names, { me: 'colin' });
assert.equal(f.text, 'You 44 vs Kevin 51. Running total 31.');
// The leaders split on the finale: the game decides, not the tiebreaker.
const split = same.map((p) => (p.entry_id === 'e-kevin' && p.game_id === 'c' ? { ...p, picked: 'AWAY' } : p));
f = finaleText(liveGames, entries, split, names, { me: 'colin' });
assert.equal(f.kind, 'picks');
assert.equal(f.title, 'BAL @ CIN decides it');
assert.equal(f.text, 'You have CIN, Kevin has BAL. BAL up right now.');
// No drama: someone leads outright, or a game other than the last is still open.
assert.equal(finaleText(games, entries, same.filter((p) => !(p.entry_id === 'e-kevin' && p.game_id === 'b')), names), null);
assert.equal(finaleText(games.map((x) => (x.id === 'b' ? { ...x, state: 'in' } : x)), entries, same, names), null);
// Nor once the slate is complete.
assert.equal(finaleText(games.map((x) => ({ ...x, state: 'post', winner: 'HOME' })), entries, same, names), null);

// ---- the sweat strip ----
const cell = (hs, as, side = 'AWAY', detail = 'Q2 1:52') => ({ result: 'live', team: 'GB', pick: { picked: side }, game: { home_score: hs, away_score: as, status_detail: detail } });
assert.deepEqual(sweatText(cell(14, 17)), { tone: 'up', text: 'Your season: GB up 3, Q2 1:52' });
assert.deepEqual(sweatText(cell(21, 17)), { tone: 'down', text: 'Your season: GB down 4, Q2 1:52' });
assert.equal(sweatText(cell(7, 7, 'AWAY', '')).text, 'Your season: GB level');
assert.equal(sweatText({ ...cell(14, 17), result: 'won' }), null);
assert.equal(sweatText(null), null);

// ---- the week wrap ----
const done = games.map((x) => ({ ...x, state: 'post', winner: 'HOME', home_score: 27, away_score: 24 }));
const res = slateResults(done, entries.map((e) => (e.user_id === 'kevin' ? { ...e, tiebreaker: 58 } : e)), same); // 44 and 58 are both 7 off the 51 total: a dead heat
assert.equal(wrapText(res, 'sam', names, 500, 'Week 2'), 'Week 2 is in the books: Colin and Kevin split $7.50, you finished 3rd at 0-3.');
assert.equal(wrapText(res, 'colin', names, 500, 'Week 2'), 'Week 2 is in the books: you and Kevin split $7.50 at 3-0.');
const solo = slateResults(done, entries.map((e) => (e.user_id === 'kevin' ? { ...e, tiebreaker: 60 } : e)), same);
assert.equal(wrapText(solo, 'colin', names, 500, 'Week 2'), 'Week 2 is in the books: you won $15.00 at 3-0.');
assert.equal(wrapText(solo, 'kevin', names, 500, 'Week 2'), 'Week 2 is in the books: Colin won $15.00, you finished 1st at 3-0.');
assert.equal(wrapText(solo, 'nobody', names, 500, 'Week 2'), 'Week 2 is in the books: Colin won $15.00.');
assert.equal(wrapText(slateResults(games, entries, same), 'colin', names, 500, 'Week 2'), '');

// ---- boot of the week ----
import { bootOf } from './moments.js';
assert.deepEqual(bootOf(res), ['sam']);                                             // last of three
assert.deepEqual(bootOf({ ...res, complete: false }), []);                            // not until the slate is done
assert.deepEqual(bootOf({ complete: true, rows: res.rows.slice(0, 2) }), []);         // two people: nobody gets booted
assert.deepEqual(bootOf({ complete: true, rows: [{ user_id: 'a', rank: 1 }, { user_id: 'b', rank: 2 }, { user_id: 'c', rank: 2 }] }).sort(), ['b', 'c']); // a tie at the bottom shares it

console.log('moments self-check: all good');
