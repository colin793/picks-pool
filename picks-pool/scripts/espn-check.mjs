// Hits ESPN for real and prints what the sync would write. No database needed.
//   node scripts/espn-check.mjs nfl
//   node scripts/espn-check.mjs mlb
import { pullWeek, pullDates } from '../lib/scores/pull.js';
import { sport } from '../lib/scores/sports.js';

const key = process.argv[2] ?? 'nfl';
const s = sport(key);
const r = s.mode === 'week' ? await pullWeek(key) : await pullDates(key);
if (!r) { console.error('ESPN returned nothing for', key); process.exit(1); }
console.log(`${s.name}: current slate ${r.current.key} "${r.current.label}", ${r.rows.length} games`);
const bySlate = new Map();
for (const g of r.rows) bySlate.set(g.slate_key, (bySlate.get(g.slate_key) ?? 0) + 1);
for (const [k, n] of bySlate) console.log(`  ${k}  ${n} games`);
const g = r.rows[0];
console.log(`  e.g. ${g.away_abbr} @ ${g.home_abbr}, ${g.kickoff}, logo ${g.home_logo ? 'yes' : 'no'}, color ${g.home_color || 'none'}, state ${g.state}`);
