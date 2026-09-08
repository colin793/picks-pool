// Self-check for the room's take. Run: npm run check
import assert from 'node:assert';
import { roomTake, takeText } from './room.js';

const g = (id, home, away, hs, as, state = 'post') => ({ id, home_abbr: home, away_abbr: away, home_score: hs, away_score: as, state, winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null });
const games = [
  g('1', 'KC', 'LV', 27, 13), g('2', 'KC', 'DEN', 17, 24), g('3', 'BUF', 'KC', 20, 23), g('4', 'KC', 'NYJ', 0, 0, 'pre'),
  g('5', 'DAL', 'PHI', 20, 20),
];
const entries = [{ id: 'e1', user_id: 'colin' }, { id: 'e2', user_id: 'kevin' }, { id: 'e3', user_id: 'sam' }];
const pk = (e, game, side) => ({ entry_id: e, game_id: game, picked: side });
const picks = [
  pk('e1', '1', 'HOME'), pk('e2', '1', 'HOME'), pk('e3', '1', 'AWAY'),   // KC 2 of 3, KC won
  pk('e1', '2', 'AWAY'), pk('e2', '2', 'HOME'), pk('e3', '2', 'HOME'),   // KC 2 of 3, KC lost; colin against KC and right
  pk('e1', '3', 'AWAY'), pk('e2', '3', 'AWAY'), pk('e3', '3', 'HOME'),   // KC (away) 2 of 3, KC won
  pk('e2', '4', 'HOME'),                                                // pending: counts for share, not for records
  pk('e1', '5', 'HOME'), pk('e2', '5', 'AWAY'),                          // a tie decides nothing
];
const t = roomTake(games, entries, picks, 'colin');
const kc = t.get('KC');
assert.equal(kc.games, 10);                 // 3 + 3 + 3 + 1 picks on KC games
assert.equal(kc.share, 7 / 10);
assert.deepEqual(kc.room, { won: 4, lost: 2 });
assert.deepEqual(kc.mine, { won: 2, lost: 0 });      // colin backed KC in games 1 and 3, right both times
assert.deepEqual(kc.against, { won: 1, lost: 0 });   // and faded them in game 2, rightly
assert.deepEqual(kc.rider, { user_id: 'kevin', n: 4 });
assert.equal(t.get('DEN').mine.won, 1);
assert.deepEqual(t.get('DAL').room, { won: 0, lost: 0 });
assert.equal(t.get('NYJ').rider, null);
assert.equal(t.get('LV').share, 1 / 3);

const names = new Map([['kevin', { display_name: 'Kevin' }]]);
assert.deepEqual(takeText('KC', kc, { me: 'colin', names }), [
  'The room takes KC 70% of the time, and is 4-2 when it does.',
  'You are 2-0 backing KC and 1-0 against them.',
  'Kevin has ridden KC 4 times.',
]);
assert.deepEqual(takeText('KC', kc, { me: 'kevin', names }).length, 2); // the rider is not told about himself
assert.deepEqual(takeText('ZZZ', undefined), []);
assert.deepEqual(takeText('DAL', t.get('DAL'), { me: 'sam' }), ['The room takes DAL 50% of the time.']);

console.log('room self-check: all good');
