// Self-check for the walkthroughs. Run: npm run check
import assert from 'node:assert';
import { playerSteps, commishChecklist } from './tour.js';
import { SPORTS } from './scores/sports.js';

const base = { name: 'Colin’s Pick Pool', scoring: 'straight', entry_fee_cents: 500, venmo_handle: '@colin' };
const plain = playerSteps(base, SPORTS.nfl, { fee: '$5.00' });
assert.equal(plain[0].title, 'Welcome to Colin’s Pick Pool');
assert.ok(plain.some((s) => s.title.startsWith('Entry is $5.00')));
assert.ok(!plain.some((s) => s.title === 'Survivor'));
assert.ok(!plain.some((s) => s.title === 'Lock of the week'));
assert.ok(plain.at(-1).title.startsWith('Two alerts'));
const loaded = playerSteps({ ...base, survivor: true, lock_of_week: true, duels: true, duty: 'Last buys wings', calls: false }, SPORTS.nfl);
assert.deepEqual(loaded.filter((s) => ['Survivor', 'Lock of the week', 'Duels', "Loser's duty"].includes(s.title)).length, 4);
assert.ok(!loaded.some((s) => s.title.startsWith('Entry is')));           // no fee, no money step
assert.ok(!loaded.find((s) => s.title === 'Chat').body.includes('call a game')); // calls off: not mentioned
assert.equal(loaded.find((s) => s.title === "Loser's duty").body, 'Last buys wings');
// Soccer talks in goals and matchweeks; the spread mode says so.
const footy = playerSteps({ ...base, scoring: 'spread' }, SPORTS.epl);
assert.match(footy[0].body, /matchweek/);
assert.match(footy[0].body, /against the line/);
assert.match(footy[2].body, /total goals/);

const fresh = commishChecklist({ entry_fee_cents: 100, venmo_handle: '' }, { members: 1 });
assert.deepEqual(fresh.map((i) => i.done), [false, false, false, false, false, false]);
const set = commishChecklist({ entry_fee_cents: 500, venmo_handle: '@c', survivor: true }, { members: 4, pushConfigured: true });
assert.deepEqual(set.map((i) => i.done), [true, true, true, true, true, false]);
assert.equal(commishChecklist({ entry_fee_cents: 0, venmo_handle: '' }).find((i) => i.key === 'venmo').done, true); // free league needs no Venmo
assert.equal(commishChecklist({ entry_fee_cents: 100, venmo_handle: '' }, { hasEntries: true }).find((i) => i.key === 'fee').done, true);

console.log('tour self-check: all good');
