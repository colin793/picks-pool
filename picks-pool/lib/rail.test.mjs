// Self-check for the league rail line. Run: npm run check
import assert from 'node:assert';
import { railLine } from './rail.js';

const rows = [
  { user_id: 'kevin', correct: 9, incorrect: 4, decided: 13, picked: 14, rank: 1 },
  { user_id: 'colin', correct: 8, incorrect: 5, decided: 13, picked: 14, rank: 2 },
  { user_id: 'sam', correct: 8, incorrect: 5, decided: 13, picked: 14, rank: 2 },
];
assert.deepEqual(railLine({ rows }, 'colin', 'Week 2', { live: true }), { text: 'Wk 2 · 8-5 · 2nd (tied)', live: true });
assert.deepEqual(railLine({ rows }, 'kevin', 'Week 2'), { text: 'Wk 2 · 9-4 · 1st', live: false });
assert.deepEqual(railLine({ rows }, 'nobody', 'Week 2'), { text: 'Wk 2 · not in yet', live: false });
assert.deepEqual(railLine({ rows: [{ user_id: 'colin', correct: 0, incorrect: 0, decided: 0, picked: 11, rank: 1 }] }, 'colin', 'Week 3'), { text: 'Wk 3 · 11 picked', live: false });
assert.deepEqual(railLine(null, 'colin', 'Week 2'), { text: 'No games yet', live: false });
assert.equal(railLine({ rows }, 'colin', 'Wild Card').text, 'Wild Card · 8-5 · 2nd (tied)');

console.log('rail self-check: all good');
