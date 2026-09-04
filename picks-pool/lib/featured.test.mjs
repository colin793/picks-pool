// Self-check for the curated-slate rule. Run: npm run check
import assert from 'node:assert';
import { featuredGames, applyFeatured, rankedAbbr } from './featured.js';
import { CFB_CONFERENCES } from './scores/sports.js';

const SEC = '8', B1G = '5', ACC = '1', MAC = '15', FCS = '20'; // ESPN ids; 20 is not an FBS conference
let t = 0;
const g = (id, home, away, opts = {}) => ({
  id, kickoff: opts.kickoff ?? new Date(Date.UTC(2026, 8, 12, 16, t++)).toISOString(), slate_key: opts.slate ?? '2026-2-03',
  home_abbr: home, away_abbr: away,
  home_rank: opts.hr ?? null, away_rank: opts.ar ?? null,
  home_conf: opts.hc ?? SEC, away_conf: opts.ac ?? B1G,
});
const conf = { fbs: CFB_CONFERENCES.fbs, power: CFB_CONFERENCES.power };
const ids = (gs) => gs.map((x) => x.id);

// ---- ranked vs ranked beats the best team playing a nobody ----
const board = [
  g('cupcake', 'UGA', 'KENT', { hr: 1, ac: MAC }),          // #1 vs an unranked MAC team
  g('top10', 'OSU', 'PSU', { hr: 4, ar: 7 }),                 // two ranked teams
  g('mid', 'TENN', 'MISS', { hr: 12, ar: 14 }),               // two ranked teams, lower
  g('one', 'ALA', 'VANDY', { hr: 3 }),                        // #3 vs unranked SEC
  g('power', 'MICH', 'IOWA', { hc: B1G, ac: B1G }),           // unranked power game
  g('mac', 'TOL', 'BGSU', { hc: MAC, ac: MAC }),              // unranked group-of-five game
];
assert.deepEqual(ids(featuredGames(board, { n: 3, ...conf })).sort(), ['cupcake', 'mid', 'top10'].sort());
// ...and within the ranked-vs-ranked tier the better combined rank wins the last slot
assert.deepEqual(ids(featuredGames(board, { n: 2, ...conf })).sort(), ['mid', 'top10'].sort());
// The full order of preference, then power before group-of-five in the fill tier.
assert.deepEqual(ids(featuredGames(board, { n: 6, ...conf })), ids([...board].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))));
const order = featuredGames(board, { n: 5, ...conf });
assert.ok(ids(order).includes('power') && !ids(order).includes('mac'), 'power-conference game fills before a MAC game');

// ---- a lower-division opponent is skipped, ranked host or not ----
const withFcs = [g('fcs', 'LSU', 'NICH', { hr: 5, ac: FCS }), g('real', 'LSU2', 'ARK', { hr: 5, ar: 20 }), g('x', 'ARK2', 'SDAK', { ac: FCS })];
assert.deepEqual(ids(featuredGames(withFcs, { n: 5, ...conf })), ['real']);
// ...but only when the conference is known: an unknown conference is not assumed to be FCS
const unknown = [g('u', 'LSU', 'WHO', { hr: 5, ac: '' })];
assert.deepEqual(ids(featuredGames(unknown, { n: 5, ...conf })), ['u']);
// ...and with no conference table at all (a sport that never curates), nothing is skipped
assert.equal(featuredGames(withFcs, { n: 5 }).length, 3);

// ---- independents are not a power conference: UMass at UConn fills after a Big Ten game ----
const IND = '18';
const fill = [g('umass', 'UCONN', 'UMASS', { hc: IND, ac: IND }), g('b1g', 'IOWA', 'NEB', { hc: B1G, ac: B1G, kickoff: '2026-09-13T00:00:00Z' })];
assert.deepEqual(ids(featuredGames(fill, { n: 1, ...conf })), ['b1g']);

// ---- within a tier, the closer line wins the slot ----
const blowout = g('blowout', 'A', 'B', { hr: 3, ar: 20, kickoff: '2026-09-12T16:00:00Z' });
const nailbiter = g('nail', 'C', 'D', { hr: 3, ar: 20, kickoff: '2026-09-12T20:00:00Z' });
blowout.home_spread = -24; nailbiter.home_spread = -2.5;
assert.deepEqual(ids(featuredGames([blowout, nailbiter], { n: 1, ...conf })), ['nail']);
// ...but never across tiers: a ranked pair beats a close unranked game
const closeUnranked = g('closeU', 'E', 'F', { kickoff: '2026-09-12T16:00:00Z' }); closeUnranked.home_spread = -1;
assert.deepEqual(ids(featuredGames([closeUnranked, blowout], { n: 1, ...conf })), ['blowout']);
// ...and a game with no line sorts after one with a line, then by kickoff
const noLine = g('noline', 'G', 'H', { hr: 3, ar: 20, kickoff: '2026-09-12T12:00:00Z' });
assert.deepEqual(ids(featuredGames([noLine, blowout], { n: 1, ...conf })), ['blowout']);

// ---- output is in kickoff order whatever the tiers were ----
const late = g('late', 'A', 'B', { hr: 1, ar: 2, kickoff: '2026-09-13T00:00:00Z' });
const early = g('early', 'C', 'D', { kickoff: '2026-09-12T16:00:00Z' });
assert.deepEqual(ids(featuredGames([late, early], { n: 2, ...conf })), ['early', 'late']);

// ---- fewer games than the target: all of them, still in order ----
assert.equal(featuredGames(board, { n: 50, ...conf }).length, 6);
assert.equal(featuredGames([], { n: 15, ...conf }).length, 0);

// ---- no conference data (an NFL board, if it were ever curated): rank-free, kickoff order ----
const nfl = [g('n2', 'KC', 'BUF', { hc: '', ac: '' }), g('n1', 'SEA', 'NE', { hc: '', ac: '', kickoff: '2026-09-11T00:15:00Z' })];
assert.deepEqual(ids(featuredGames(nfl, { n: 1 })), ['n1']);

// ---- stable: same input, same answer, every time ----
assert.deepEqual(ids(featuredGames(board, { n: 4, ...conf })), ids(featuredGames([...board].reverse(), { n: 4, ...conf })));

// ---- applyFeatured keeps uncurated slates whole ----
const games = [g('a', 'A', 'B', { slate: 'w1' }), g('b', 'C', 'D', { slate: 'w1' }), g('c', 'E', 'F', { slate: 'w2' })];
assert.deepEqual(ids(applyFeatured(games, [])), ['a', 'b', 'c']);
assert.deepEqual(ids(applyFeatured(games, [{ slate_key: 'w1', game_id: 'b' }])), ['b', 'c']); // w2 untouched
assert.deepEqual(ids(applyFeatured(games, null)), ['a', 'b', 'c']);

assert.equal(rankedAbbr('UGA', 3), '#3 UGA');
assert.equal(rankedAbbr('UGA', null), 'UGA');

console.log('featured self-check: all good');
