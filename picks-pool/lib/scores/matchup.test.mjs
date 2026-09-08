// Self-check for the matchup fold's parsing. Run: npm run check
import assert from 'node:assert';
import { normalizeSummary, notesEmpty } from './matchup.js';

const home = { abbr: 'KC', id: '12' }, away = { abbr: 'BUF', id: '2' };
const summary = {
  gameInfo: { venue: { fullName: 'GEHA Field at Arrowhead Stadium' } },
  predictor: { homeTeam: { id: '12', gameProjection: '61.4' }, awayTeam: { id: '2', gameProjection: '38.6' } },
  lastFiveGames: [
    { team: { id: '12', abbreviation: 'KC' }, events: [
      { gameResult: 'W', score: '27-20', atVs: 'vs', opponent: { abbreviation: 'LV' } },
      { gameResult: 'L', score: '17-24', atVs: '@', opponent: { abbreviation: 'DEN' } },
    ] },
    { team: { id: '2', abbreviation: 'BUF' }, events: [{ gameResult: 'W', score: '30-10', atVs: 'vs', opponent: { abbreviation: 'NYJ' } }] },
    { team: { id: '99', abbreviation: 'XXX' }, events: [{ gameResult: 'W' }] }, // not in this game: ignored
  ],
  injuries: [
    { team: { id: '12' }, injuries: [{ status: 'Questionable', athlete: { displayName: 'Travis Kelce', position: { abbreviation: 'TE' } } }] },
  ],
  leaders: [
    { team: { abbreviation: 'BUF' }, leaders: [
      { name: 'passingYards', shortDisplayName: 'PASS', leaders: [{ displayValue: '612 YDS, 5 TD', athlete: { shortName: 'J. Allen', position: { abbreviation: 'QB' } } }] },
      { name: 'rushingYards', shortDisplayName: 'RUSH', leaders: [] },
      { name: 'receivingYards', shortDisplayName: 'REC', leaders: [{ displayValue: '210 YDS', athlete: { displayName: 'Khalil Shakir', position: { abbreviation: 'WR' } } }] },
    ] },
  ],
};
const n = normalizeSummary(summary, home, away);
assert.equal(n.venue, 'GEHA Field at Arrowhead Stadium');
assert.deepEqual(n.projection, { home: 61, away: 39 });
assert.deepEqual(n.lastFive.home, [{ result: 'W', score: '27-20', opp: 'vs LV' }, { result: 'L', score: '17-24', opp: '@ DEN' }]);
assert.equal(n.lastFive.away.length, 1);
assert.deepEqual(n.injuries.home, [{ name: 'Travis Kelce', pos: 'TE', status: 'Questionable' }]);
assert.deepEqual(n.injuries.away, []);
assert.deepEqual(n.leaders.away.map((l) => l.name), ['J. Allen', 'Khalil Shakir']); // an empty category is skipped
assert.equal(n.leaders.away[0].value, '612 YDS, 5 TD');
assert.equal(notesEmpty(n), false);

// Nothing useful in, nothing harmful out.
assert.equal(notesEmpty(normalizeSummary(null, home, away)), true);
assert.equal(notesEmpty(normalizeSummary({ predictor: { homeTeam: {} } }, home, away)), true);
assert.equal(notesEmpty(normalizeSummary('garbage', home, away)), true);

console.log('matchup self-check: all good');
