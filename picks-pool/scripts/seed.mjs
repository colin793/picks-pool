// Seeds a staging Supabase project with a league frozen mid-Sunday: six
// players, a 14-game slate with finals, live games and open games, picks,
// one unpaid entry. Kickoffs are shifted so "now" lands at the fixture's
// Sunday 4:40 PM. Set SCORES_FROZEN=1 on that deploy so ESPN sync leaves it.
//
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs you@example.com
//
// The email you pass becomes "Colin", the commissioner, so you can sign in
// with a magic link and see the league from the inside. Safe to re-run.

import { createClient } from '@supabase/supabase-js';
import { LEAGUE, GAMES, PLAYERS, ENTRIES, ALL_PICKS, NOW } from '../lib/fixtures.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const myEmail = process.argv[2];
if (!url || !key || !myEmail) {
  console.error('usage: NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed.mjs you@example.com');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const shift = Date.now() - NOW;
const shifted = (iso) => new Date(new Date(iso).getTime() + shift).toISOString();
const fail = (step, error) => { if (error) { console.error(step, error.message); process.exit(1); } };

// 1. users (idempotent: look up by email first)
const ids = new Map(); // fixture id -> real uuid
const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
for (const p of PLAYERS) {
  const email = p.id === 'u-colin' ? myEmail : p.email;
  let user = existing?.users?.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    fail(`create ${email}`, error);
    user = data.user;
  }
  ids.set(p.id, user.id);
  fail('profile', (await db.from('profiles').upsert({
    id: user.id, email, display_name: p.display_name, emoji: p.emoji, venmo_handle: p.venmo_handle,
  })).error);
}

// 2. league + members (find by name so re-runs reuse it)
let { data: league } = await db.from('leagues').select('id').eq('name', LEAGUE.name).maybeSingle();
if (!league) {
  const { data, error } = await db.from('leagues').insert({
    name: LEAGUE.name, sport: LEAGUE.sport, color1: LEAGUE.color1, color2: LEAGUE.color2,
    entry_fee_cents: LEAGUE.entry_fee_cents, venmo_handle: LEAGUE.venmo_handle, commissioner: ids.get('u-colin'),
  }).select('id').single();
  fail('league', error);
  league = data;
}
fail('members', (await db.from('memberships').upsert(PLAYERS.map((p) => ({ league_id: league.id, user_id: ids.get(p.id) })))).error);

// 3. games + sport_state
const games = GAMES.map((g) => ({ ...g, kickoff: shifted(g.kickoff) }));
fail('games', (await db.from('games').upsert(games)).error);
fail('state', (await db.from('sport_state').upsert({
  sport: 'nfl', season: 2026, season_type: 2, slate_key: '2026-2-00', slate_label: 'Demo Week', last_sync: new Date().toISOString(),
})).error);

// 4. entries + picks (wipe this league's slate first so re-runs are clean)
await db.from('entries').delete().eq('league_id', league.id).eq('season', 2026).eq('slate_key', '2026-2-00');
const entryIds = new Map();
for (const e of ENTRIES) {
  const { data, error } = await db.from('entries').insert({
    league_id: league.id, user_id: ids.get(e.user_id), season: 2026, slate_key: '2026-2-00',
    tiebreaker: e.user_id === 'u-colin' ? 44 : { 'u-kevin': 51, 'u-sam': 38, 'u-jess': 47, 'u-marco': 55 }[e.user_id] ?? null,
    paid: e.paid,
  }).select('id').single();
  fail('entry', error);
  entryIds.set(e.id, data.id);
}
fail('picks', (await db.from('picks').insert(ALL_PICKS.map((p) => ({ entry_id: entryIds.get(p.entry_id), game_id: p.game_id, picked: p.picked })))).error);

console.log(`Seeded "${LEAGUE.name}" (${league.id}) with ${PLAYERS.length} players and ${games.length} games.`);
console.log(`Sign in as ${myEmail}. Remember SCORES_FROZEN=1 on this deploy, or the next page view re-syncs real NFL games.`);
