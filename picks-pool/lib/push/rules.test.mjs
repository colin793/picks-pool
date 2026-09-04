// Self-check for what push says and to whom. Run: npm run check
import assert from 'node:assert';
import { lockWindow, lockMessage, leaders, leadMessages } from './rules.js';

const now = Date.parse('2026-09-10T23:30:00Z'); // Thursday 7:30 PM ET, 50 minutes to kickoff
const MIN = 60_000;
const g = (id, kickoff, state = 'pre', winner = null) => ({ id, kickoff, state, winner, home_score: 0, away_score: 0, away_abbr: 'NE', home_abbr: 'SEA' });

// ---- lock warnings ----
let w = lockWindow([g('a', '2026-09-11T00:20:00Z'), g('b', '2026-09-13T17:00:00Z')], now);
assert.equal(w.minutes, 50);
assert.equal(w.first.id, 'a');
assert.equal(w.open, 2);
assert.equal(lockWindow([g('a', '2026-09-11T02:00:00Z')], now), null);             // 2.5 hours out: not yet
assert.equal(lockWindow([g('a', '2026-09-10T20:00:00Z', 'in')], now), null);       // already kicked off: nothing to warn about
assert.equal(lockWindow([], now), null);
assert.equal(lockWindow([g('a', new Date(now + 20_000).toISOString())], now).minutes, 1); // never "0 min"
const league = { id: 'L1', name: 'Draft With Purpose' };
const m = lockMessage(league, 'Week 1', w, 'https://x/l/L1');
assert.equal(m.title, 'Draft With Purpose: picks lock in 50 min');
assert.match(m.body, /NE @ SEA kicks off first/);
assert.match(m.body, /2 games still open/);
assert.equal(m.url, 'https://x/l/L1');

// ---- leaders: by correct picks, ties included, only once something is final ----
const games = [g('a', '2026-09-11T00:20:00Z', 'post', 'HOME'), g('b', '2026-09-13T17:00:00Z', 'post', 'AWAY'), g('c', '2026-09-13T20:25:00Z', 'in')];
const entries = [{ id: 'e1', user_id: 'colin', tiebreaker: 1 }, { id: 'e2', user_id: 'kevin', tiebreaker: 1 }, { id: 'e3', user_id: 'sam', tiebreaker: 1 }];
const picks = [
  { entry_id: 'e1', game_id: 'a', picked: 'HOME' }, { entry_id: 'e1', game_id: 'b', picked: 'AWAY' },
  { entry_id: 'e2', game_id: 'a', picked: 'HOME' }, { entry_id: 'e2', game_id: 'b', picked: 'HOME' },
  { entry_id: 'e3', game_id: 'a', picked: 'AWAY' },
];
assert.deepEqual(leaders(games, entries, picks).ids, ['colin']);
assert.equal(leaders(games, entries, picks).key, 'colin');
// nothing final yet: no leader, whatever the live arrows say
assert.equal(leaders(games.map((x) => ({ ...x, state: 'pre', winner: null })), entries, picks).key, '');
// a tie at the top is one leader set, in stable order
const tiePicks = picks.map((p) => (p.entry_id === 'e2' && p.game_id === 'b' ? { ...p, picked: 'AWAY' } : p));
assert.deepEqual(leaders(games, entries, tiePicks).ids, ['colin', 'kevin']);
// everyone on zero is nobody in the lead
assert.equal(leaders(games, entries, [{ entry_id: 'e3', game_id: 'a', picked: 'AWAY' }]).key, '');

// ---- messages: three points of view ----
const names = new Map([['colin', { display_name: 'Colin' }], ['kevin', { display_name: 'Kevin' }], ['sam', { display_name: 'Sam' }]]);
let msgs = leadMessages(league, 'Week 1', ['colin'], ['kevin'], names, ['colin', 'kevin', 'sam'], 'https://x/l/L1');
const by = Object.fromEntries(msgs.map((x) => [x.user_id, x.payload]));
assert.equal(by.kevin.title, "You're in the lead in Draft With Purpose");
assert.equal(by.colin.title, 'Kevin just passed you in Draft With Purpose');
assert.equal(by.sam.title, 'Kevin took the lead in Draft With Purpose');
assert.equal(by.sam.url, 'https://x/l/L1/board');
// a tie forming: the newcomer is named, the incumbent hears they are tied
msgs = leadMessages(league, 'Week 1', ['colin'], ['colin', 'kevin'], names, ['colin', 'kevin', 'sam'], 'https://x/l/L1');
const tie = Object.fromEntries(msgs.map((x) => [x.user_id, x.payload]));
assert.equal(tie.colin.title, "You're tied for the lead in Draft With Purpose");
assert.match(tie.colin.body, /Kevin is up there with you/);
assert.equal(tie.sam.title, 'Kevin shares the lead in Draft With Purpose');
assert.equal(tie.kevin.title, "You're tied for the lead in Draft With Purpose");
// three names read as a list
msgs = leadMessages(league, 'Week 1', [], ['colin', 'kevin', 'sam'], names, ['x'], 'https://x/l/L1');
assert.match(msgs[0].payload.title, /Colin, Kevin and Sam share the lead/);
// nobody to tell: nothing to send
assert.deepEqual(leadMessages(league, 'Week 1', [], ['colin'], names, [], 'https://x/l/L1'), []);

console.log('push rules self-check: all good');
