// Self-check for the live refresh plan. Run: npm run check
import assert from 'node:assert';
import { refreshPlan, refreshDelay } from './live.js';

const now = Date.parse('2026-09-13T20:40:00Z'); // Sunday 4:40 PM ET
const g = (id, kickoff, state) => ({ id, kickoff, state });
const MIN = 60_000;

// Nothing started yet: no polling, wake just after the first kickoff.
let plan = refreshPlan([g('a', '2026-09-13T21:00:00Z', 'pre'), g('b', '2026-09-14T00:20:00Z', 'pre')], now);
assert.deepEqual(plan, { live: false, nextKickoff: '2026-09-13T21:00:00.000Z' });
assert.equal(refreshDelay(plan, now), 20 * MIN + 5_000);

// Kickoff hours away: check in every half hour rather than sleeping through a schedule change.
plan = refreshPlan([g('b', '2026-09-14T00:20:00Z', 'pre')], now);
assert.equal(refreshDelay(plan, now), 30 * MIN);

// A game in progress: poll every minute, whatever else is scheduled.
plan = refreshPlan([g('a', '2026-09-13T20:25:00Z', 'in'), g('b', '2026-09-14T00:20:00Z', 'pre')], now);
assert.equal(plan.live, true);
assert.equal(refreshDelay(plan, now), MIN);
assert.equal(refreshDelay(plan, now, 45_000), 45_000);

// Kicked off but ESPN still says 'pre': treat as live so the reveal and lock land on time.
plan = refreshPlan([g('a', '2026-09-13T20:25:00Z', 'pre')], now);
assert.equal(plan.live, true);

// Everything final: nothing to do.
plan = refreshPlan([g('a', '2026-09-13T17:00:00Z', 'post')], now);
assert.deepEqual(plan, { live: false, nextKickoff: null });
assert.equal(refreshDelay(plan, now), null);

// Kickoff seconds away never schedules a zero or negative delay.
plan = refreshPlan([g('a', new Date(now + 1000).toISOString(), 'pre')], now);
assert.equal(refreshDelay(plan, now), 6_000);

console.log('live self-check: all good');
