// Self-check for Call it. Run: npm run check
import assert from 'node:assert';
import { callText, gradeCall, resultText, receipts, callRecords } from './calls.js';

const g = (id, hs, as, state = 'post') => ({ id, home_abbr: 'KC', away_abbr: 'BUF', home_score: hs, away_score: as, state, winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null });
const kc10 = { user_id: 'kevin', game_id: '1', side: 'HOME', margin: 10 };
const buf = { user_id: 'colin', game_id: '1', side: 'AWAY', margin: null };
assert.equal(callText(kc10, g('1', 0, 0)), 'KC by 10');
assert.equal(callText(buf, g('1', 0, 0)), 'BUF wins');
assert.equal(callText(buf, undefined), 'a game that is gone');
assert.equal(gradeCall(kc10, g('1', 0, 0, 'pre')), 'pending');
assert.equal(gradeCall(kc10, g('1', 30, 17)), 'hit');   // by 13
assert.equal(gradeCall(kc10, g('1', 24, 17)), 'miss');  // by 7: not the full margin
assert.equal(gradeCall(kc10, g('1', 17, 24)), 'miss');
assert.equal(gradeCall(buf, g('1', 17, 24)), 'hit');
assert.equal(gradeCall(buf, g('1', 20, 20)), 'miss');   // a tie misses
assert.equal(gradeCall(kc10, undefined), 'pending');
assert.equal(resultText(g('1', 24, 17)), 'KC won by 7');
assert.equal(resultText(g('1', 20, 20)), 'it tied');
assert.equal(resultText(g('1', 0, 0, 'in')), '');

const names = new Map([['kevin', 'Kevin'], ['colin', 'Colin']]);
const lines = receipts([kc10, buf, { user_id: 'colin', game_id: '2', side: 'HOME' }], [g('1', 24, 17), g('2', 0, 0, 'in')], names);
assert.deepEqual(lines, ['Kevin called KC by 10; KC won by 7: miss.', 'Colin called BUF wins; KC won by 7: miss.']);
const hit = receipts([kc10], [g('1', 31, 10)], names);
assert.deepEqual(hit, ['Kevin called KC by 10; KC won by 21: hit.']);
const rec = callRecords([kc10, buf, { user_id: 'kevin', game_id: '2', side: 'AWAY' }], [g('1', 31, 10), g('2', 3, 6)]);
assert.deepEqual(rec.get('kevin'), { hits: 2, total: 2 });
assert.deepEqual(rec.get('colin'), { hits: 0, total: 1 });

console.log('calls self-check: all good');
