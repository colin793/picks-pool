// Self-check for the board's projections. Run: npm run check
import assert from 'node:assert';
import { projections, needsText } from './paths.js';

const g = (id, state, winner = null, home = 'H' + id, away = 'A' + id) => ({ id, kickoff: `2026-09-13T${state === 'pre' ? '23' : '17'}:00:00Z`, state, winner, home_abbr: home, away_abbr: away, home_score: 0, away_score: 0 });
// Two finals, two live games, one still to come.
const games = [g('f1', 'post', 'HOME'), g('f2', 'post', 'AWAY'), g('l1', 'in', null, 'GB', 'CHI'), g('l2', 'in', null, 'DEN', 'LV'), g('o1', 'pre')];
const entries = [{ id: 'e1', user_id: 'colin', tiebreaker: 1 }, { id: 'e2', user_id: 'sam', tiebreaker: 1 }, { id: 'e3', user_id: 'brian', tiebreaker: 1 }];
const pick = (e, gid, s) => ({ entry_id: e, game_id: gid, picked: s });
const picks = [
  pick('e1', 'f1', 'HOME'), pick('e1', 'f2', 'AWAY'), pick('e1', 'l1', 'HOME'), pick('e1', 'l2', 'HOME'), // colin: 2-0, has GB and DEN
  pick('e2', 'f1', 'HOME'), pick('e2', 'f2', 'AWAY'), pick('e2', 'l1', 'AWAY'), pick('e2', 'l2', 'HOME'), // sam: 2-0, has CHI and DEN
  pick('e3', 'f1', 'AWAY'), pick('e3', 'f2', 'AWAY'), pick('e3', 'l1', 'AWAY'), pick('e3', 'l2', 'AWAY'), // brian: 1-1, has CHI and LV
];
const names = new Map([['colin', { display_name: 'Colin' }], ['sam', { display_name: 'Sam' }], ['brian', { display_name: 'Brian' }]]);

const p = projections(games, entries, picks, { me: 'colin' });
assert.equal(p.pending, 1);                      // the night game is not projected
assert.equal(p.live.length, 2);
assert.equal(p.total, 4);                        // 2^2 outcomes
// GB wins -> Colin alone on top by 1; CHI wins -> Sam alone by 1 (Brian also gets one but started behind).
const gb = p.live.find((x) => x.game.id === 'l1');
assert.deepEqual(gb.branches.find((b) => b.side === 'HOME'), { side: 'HOME', ids: ['colin'], margin: 1, correct: 3 });
assert.deepEqual(gb.branches.find((b) => b.side === 'AWAY').ids, ['sam']);
// DEN wins -> Colin and Sam tied; LV wins -> still tied at 2 (Brian climbs to 2 as well: three-way tie)
const den = p.live.find((x) => x.game.id === 'l2');
assert.deepEqual(den.branches.find((b) => b.side === 'HOME').ids.sort(), ['colin', 'sam']);
assert.equal(den.branches.find((b) => b.side === 'HOME').margin, 2); // the tied pair's gap to Brian
assert.deepEqual(den.branches.find((b) => b.side === 'AWAY').ids.sort(), ['brian', 'colin', 'sam']);
// Alive: Colin wins outright whenever GB wins (2 of 4 outcomes), and only then.
const colin = p.alive.find((a) => a.user_id === 'colin');
assert.equal(colin.outcomes, 2);
assert.equal(colin.sole, 2);
assert.deepEqual(colin.needs.map((n) => `${n.side}:${n.game.id}`), ['HOME:l1']); // needs GB; DEN/LV does not matter
assert.equal(needsText(colin, { names, me: 'colin' }), 'You need GB');
// Sam is on top whenever CHI wins.
const sam = p.alive.find((a) => a.user_id === 'sam');
assert.equal(needsText(sam, { names, me: 'colin' }), 'Sam needs CHI');
// Brian is only tied on top if CHI and LV both win.
const brian = p.alive.find((a) => a.user_id === 'brian');
assert.equal(brian.outcomes, 1);
assert.equal(brian.sole, 0);
assert.equal(needsText(brian, { names, me: 'colin' }), 'Brian needs CHI and LV'); // both fixed: 1 of 1 remaining outcome, so no help needed
// A player whose must-haves are necessary but not sufficient is told so.
assert.equal(needsText({ user_id: 'x', outcomes: 3, total: 16, sides: 2, needs: [{ game: { home_abbr: 'LAR', away_abbr: 'SF' }, side: 'HOME' }, { game: { home_abbr: 'LAC', away_abbr: 'ARI' }, side: 'HOME' }] }, { names }), 'Player needs LAR and LAC, plus some help');
assert.equal(needsText({ user_id: 'x', outcomes: 4, total: 16, sides: 2, needs: [{ game: { home_abbr: 'LAR', away_abbr: 'SF' }, side: 'HOME' }, { game: { home_abbr: 'LAC', away_abbr: 'ARI' }, side: 'HOME' }] }, { names }), 'Player needs LAR and LAC');
assert.equal(p.mine.user_id, 'colin');

// Nothing live: nothing to project, but the pending count still tells the story.
const quiet = projections(games.map((x) => (x.state === 'in' ? { ...x, state: 'pre' } : x)), entries, picks);
assert.equal(quiet.live.length, 0);
assert.equal(quiet.total, 0);
assert.equal(quiet.pending, 3);
assert.deepEqual(quiet.alive, []);

// A player who cannot catch up says so; a runaway leader says so.
const lockedIn = projections([g('f1', 'post', 'HOME'), g('f2', 'post', 'HOME'), g('l1', 'in')], entries,
  [pick('e1', 'f1', 'HOME'), pick('e1', 'f2', 'HOME'), pick('e2', 'l1', 'HOME'), pick('e3', 'l1', 'AWAY')], { me: 'sam' });
assert.equal(needsText(lockedIn.alive.find((a) => a.user_id === 'colin'), { names }), 'Colin leads whatever happens');
assert.equal(needsText(lockedIn.mine, { names, me: 'sam' }), 'You are out of it today');

// Draws as an outcome (soccer): three branches per game.
const soccer = projections([g('m1', 'in', null, 'CHE', 'ARS')], entries.slice(0, 2), [pick('e1', 'm1', 'TIE'), pick('e2', 'm1', 'HOME')], { draws: true, me: 'colin' });
assert.equal(soccer.live[0].branches.length, 3);
assert.equal(soccer.total, 3);
assert.equal(needsText(soccer.mine, { names, me: 'colin', homeFirst: true }), 'You need a draw in CHE v ARS');

// Too many live games: the combinatorics are skipped, the per-game branches are not.
const many = projections(Array.from({ length: 11 }, (_, i) => g(`x${i}`, 'in')), entries, []);
assert.equal(many.tooMany, true);
assert.equal(many.live.length, 11);
assert.deepEqual(many.alive, []);

console.log('paths self-check: all good');
