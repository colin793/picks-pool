'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sb, admin, currentUser } from './supabase';
import { SPORTS, sport as sportOf } from './scores/sports';
import { featuredGames } from './featured';

// ---------- leagues ----------

export async function createLeague(formData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const name = String(formData.get('name') || '').trim().slice(0, 60);
  const sport = String(formData.get('sport') || 'nfl');
  if (!name || !SPORTS[sport]) return;
  const { data: league, error } = await sb()
    .from('leagues')
    .insert({ name, sport, venmo_handle: String(formData.get('venmo') || '').trim().slice(0, 60), commissioner: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await admin().from('memberships').insert({ league_id: league.id, user_id: user.id });
  redirect(`/l/${league.id}`);
}

export async function joinLeague(formData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const code = String(formData.get('code') || '').trim().toLowerCase();
  const db = admin();
  const { data: league } = await db.from('leagues').select('id').eq('invite_code', code).maybeSingle();
  if (!league) redirect(`/join/${code}?bad=1`);
  await db.from('memberships').upsert({ league_id: league.id, user_id: user.id });
  redirect(`/l/${league.id}`);
}

// Typed on the home page: accepts a bare code or a whole invite link.
export async function joinByCode(formData) {
  const raw = String(formData.get('code') || '').trim();
  const code = raw.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  if (!code) return;
  redirect(`/join/${code}`);
}

export async function updateLeague(leagueId, formData) {
  const { error } = await sb()
    .from('leagues')
    .update({
      name: String(formData.get('name') || '').trim().slice(0, 60),
      logo_url: String(formData.get('logo_url') || '').trim(),
      color1: String(formData.get('color1') || '#1d4ed8'),
      color2: String(formData.get('color2') || '#111827'),
      entry_fee_cents: Math.max(0, Math.round(Number(formData.get('fee') || 1) * 100)),
      venmo_handle: String(formData.get('venmo') || '').trim().slice(0, 60),
      recap_enabled: formData.get('recap') === 'on',
      reminders_enabled: formData.get('reminders') === 'on',
      // A disabled select posts nothing; leave scoring alone then. The database refuses a change once entries exist.
      ...(formData.get('scoring') ? { scoring: ['straight', 'spread'].includes(formData.get('scoring')) ? formData.get('scoring') : 'straight' } : {}),
      // The survivor fields only post once the survivor SQL has run (the form
      // hides them until the columns exist), so an older database is never written to.
      ...(formData.has('survivor_fee') ? {
        survivor: formData.get('survivor') === 'on',
        survivor_fee_cents: Math.max(0, Math.round(Number(formData.get('survivor_fee') || 0) * 100)),
      } : {}),
      // Room modes, same rule: only once the columns exist (the form hides them until then).
      ...(formData.has('duty') ? {
        lock_of_week: formData.get('lock_of_week') === 'on',
        duels: formData.get('duels') === 'on',
        duty: String(formData.get('duty') || '').trim().slice(0, 120),
        calls: formData.get('calls') === 'on',
      } : {}),
    })
    .eq('id', leagueId); // RLS: commissioner only
  if (error) throw new Error(error.message);
  revalidatePath(`/l/${leagueId}`, 'layout');
}

export async function regenerateInvite(leagueId) {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
  await sb().from('leagues').update({ invite_code: code }).eq('id', leagueId); // RLS: commissioner only
  revalidatePath(`/l/${leagueId}/admin`);
}

export async function transferLeague(leagueId, formData) {
  const to = String(formData.get('user_id') || '');
  if (!to) return;
  const { error } = await sb().from('leagues').update({ commissioner: to }).eq('id', leagueId); // RLS: must be a member
  if (error) throw new Error(error.message);
  redirect(`/l/${leagueId}`);
}

export async function deleteLeague(leagueId) {
  const { error } = await sb().from('leagues').delete().eq('id', leagueId); // RLS: commissioner only, cascades
  if (error) throw new Error(error.message);
  redirect('/?deleted=1');
}

export async function leaveLeague(leagueId) {
  const user = await currentUser();
  if (!user) redirect('/login');
  await sb().from('memberships').delete().eq('league_id', leagueId).eq('user_id', user.id); // RLS: not the commissioner
  redirect('/');
}

export async function removeMember(leagueId, userId) {
  await sb().from('memberships').delete().eq('league_id', leagueId).eq('user_id', userId); // RLS: commissioner only
  revalidatePath(`/l/${leagueId}/admin`);
}

// ---------- picks ----------

// picks: { [gameId]: 'HOME' | 'AWAY' }. The database is the enforcement (a
// pick on a started game is rejected by RLS); this reports what happened
// instead of pretending everything saved.
// lock: undefined leaves the lock of the week alone, null clears it, a game
// id sets it. The entries trigger is the referee (mode on, open game, in slate).
export async function savePicks(leagueId, season, slateKey, picks, tiebreaker, lock = undefined) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = sb();
  let wanted = Object.entries(picks ?? {}).filter(([, s]) => s === 'HOME' || s === 'AWAY' || s === 'TIE');

  const { data: league } = await db.from('leagues').select('sport').eq('id', leagueId).maybeSingle();
  if (!league) throw new Error('You are no longer in this league.');
  const draws = Boolean(SPORTS[league.sport]?.draws);
  if (!draws) wanted = wanted.filter(([, s]) => s !== 'TIE');
  const { data: games } = await db
    .from('games').select('id, kickoff')
    .eq('sport', league.sport).eq('season', season).eq('slate_key', slateKey);
  const nowIso = new Date().toISOString();
  const open = new Set((games ?? []).filter((g) => g.kickoff > nowIso).map((g) => g.id));
  const known = new Set((games ?? []).map((g) => g.id));

  let { data: entry } = await db
    .from('entries').select('*')
    .eq('league_id', leagueId).eq('user_id', user.id).eq('season', season).eq('slate_key', slateKey)
    .maybeSingle();

  const openWanted = wanted.filter(([id]) => open.has(id));
  if (!entry) {
    if (!openWanted.length) throw new Error('Pick at least one game that has not started.');
    const { data, error } = await db
      .from('entries')
      .insert({ league_id: leagueId, user_id: user.id, season, slate_key: slateKey })
      .select().single();
    if (error) throw new Error(error.message);
    entry = data;
  }

  let tbSaved = false;
  const tb = tiebreaker === '' || tiebreaker == null ? null : Number(tiebreaker);
  if (tb != null && !Number.isNaN(tb) && tb !== entry.tiebreaker) {
    const { error } = await db.from('entries').update({ tiebreaker: tb }).eq('id', entry.id);
    if (!error) tbSaved = true;
  }

  const { data: existing } = await db.from('picks').select('game_id, picked').eq('entry_id', entry.id);
  const current = new Map((existing ?? []).map((p) => [p.game_id, p.picked]));

  const rows = openWanted
    .filter(([id, side]) => current.get(id) !== side)
    .map(([game_id, picked]) => ({ entry_id: entry.id, game_id, picked }));
  const refused = wanted
    .filter(([id, side]) => known.has(id) && !open.has(id) && current.get(id) !== side)
    .map(([id]) => id);

  if (rows.length) {
    const { error } = await db.from('picks').upsert(rows, { onConflict: 'entry_id,game_id' });
    if (error) throw new Error(error.message);
  }

  let lockNote = null;
  if (lock !== undefined && (lock ?? null) !== (entry.lock_game_id ?? null)) {
    if (lock && !wanted.some(([id]) => id === lock)) lockNote = 'Pick that game before locking it.';
    else {
      const { error } = await db.from('entries').update({ lock_game_id: lock }).eq('id', entry.id); // trigger: mode on, open game, in slate
      if (error) lockNote = /kicked off/i.test(error.message) ? 'Your lock has kicked off and stays put.' : /does not play/i.test(error.message) ? 'The lock of the week is switched off.' : 'Lock not saved: it has to be one of your open games this week.';
    }
  }
  revalidatePath(`/l/${leagueId}`, 'layout');
  return { saved: rows.length, unchanged: openWanted.length - rows.length, refused, tiebreaker: tbSaved, entryId: entry.id, lockNote };
}

export async function withdrawEntry(leagueId, entryId) {
  // RLS: own + unlocked, or commissioner. A filtered-out delete is not an error, so check the count.
  const { data, error } = await sb().from('entries').delete().eq('id', entryId).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Your entry is locked: one of your picked games has started.');
  revalidatePath(`/l/${leagueId}`, 'layout');
}

// ---------- curated slate (commissioner) ----------

// Picks on a game that left the slate no longer count and would confuse the
// grid, so they go with it. Service role: the rows belong to other players.
async function dropPicksOn(leagueId, season, slateKey, gameIds) {
  if (!gameIds.length) return;
  const a = admin();
  const { data: entries } = await a.from('entries').select('id').eq('league_id', leagueId).eq('season', season).eq('slate_key', slateKey);
  if (entries?.length) await a.from('picks').delete().in('game_id', gameIds).in('entry_id', entries.map((e) => e.id));
}

export async function setFeatured(leagueId, season, slateKey, gameId, on) {
  const db = sb();
  if (on) {
    const { error } = await db.from('slate_games').insert({ league_id: leagueId, season, slate_key: slateKey, game_id: gameId }); // RLS: commissioner
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  } else {
    // RLS: commissioner, and only while the game has not kicked off. A filtered-out delete is 0 rows, not an error.
    const { data, error } = await db.from('slate_games').delete()
      .match({ league_id: leagueId, season, slate_key: slateKey, game_id: gameId }).select('game_id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('That game has kicked off, so it stays in the slate.');
    await dropPicksOn(leagueId, season, slateKey, [gameId]);
  }
  revalidatePath(`/l/${leagueId}`, 'layout');
}

// Re-run the auto-pick over the board. Games that have kicked off stay
// whatever the rule says; everything else is replaced.
export async function resetFeatured(leagueId, season, slateKey) {
  const db = sb();
  const { data: league } = await db.from('leagues').select('id, sport').eq('id', leagueId).single();
  const sport = sportOf(league?.sport);
  if (!sport.featured) return;
  const [{ data: board }, { data: current }] = await Promise.all([
    db.from('games').select('*').eq('sport', league.sport).eq('season', season).eq('slate_key', slateKey),
    db.from('slate_games').select('game_id').eq('league_id', leagueId).eq('season', season).eq('slate_key', slateKey),
  ]);
  const now = Date.now();
  const started = new Set((board ?? []).filter((g) => new Date(g.kickoff).getTime() <= now).map((g) => g.id));
  const keep = new Set((current ?? []).map((r) => r.game_id).filter((id) => started.has(id)));
  const open = (board ?? []).filter((g) => !started.has(g.id));
  const want = new Set([...keep, ...featuredGames(open, { n: Math.max(0, sport.featured - keep.size), ...(sport.conferences ?? {}) }).map((g) => g.id)]);
  const have = new Set((current ?? []).map((r) => r.game_id));
  const remove = [...have].filter((id) => !want.has(id));
  const add = [...want].filter((id) => !have.has(id));
  if (remove.length) {
    const { error } = await db.from('slate_games').delete().eq('league_id', leagueId).eq('season', season).eq('slate_key', slateKey).in('game_id', remove); // RLS
    if (error) throw new Error(error.message);
    await dropPicksOn(leagueId, season, slateKey, remove);
  }
  if (add.length) {
    const { error } = await db.from('slate_games').insert(add.map((game_id) => ({ league_id: leagueId, season, slate_key: slateKey, game_id }))); // RLS
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/l/${leagueId}`, 'layout');
}

// ---------- push notifications ----------

export async function savePushSubscription(sub, userAgent = '') {
  const user = await currentUser();
  if (!user) redirect('/login');
  const endpoint = String(sub?.endpoint || '');
  const p256dh = String(sub?.keys?.p256dh || '');
  const auth = String(sub?.keys?.auth || '');
  if (!endpoint || !p256dh || !auth) throw new Error('That browser did not hand back a usable subscription.');
  const { error } = await sb().from('push_subscriptions')
    .upsert({ user_id: user.id, endpoint, p256dh, auth, user_agent: String(userAgent).slice(0, 200) }, { onConflict: 'endpoint' }); // RLS: own rows
  if (error) throw new Error(error.message);
}

export async function removePushSubscription(endpoint) {
  if (!endpoint) return;
  await sb().from('push_subscriptions').delete().eq('endpoint', String(endpoint)); // RLS: own rows
}

// ---------- chat ----------

export async function postMessage(leagueId, formData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const body = String(formData.get('body') || '').trim().slice(0, 500);
  if (!body) return;
  const { error } = await sb().from('messages').insert({ league_id: leagueId, user_id: user.id, body }); // RLS: members
  if (error) throw new Error(error.message);
  revalidatePath(`/l/${leagueId}/chat`);
}

// Call it: "KC by 10" on an open game. RLS: member, calls on, open game in the slate.
export async function postCall(leagueId, formData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const game_id = String(formData.get('game_id') || '');
  const side = String(formData.get('side') || '');
  const marginRaw = String(formData.get('margin') || '').trim();
  const margin = marginRaw ? Math.min(99, Math.max(1, Math.round(Number(marginRaw)) || 1)) : null;
  const body = String(formData.get('body') || '').trim().slice(0, 140);
  if (!game_id || (side !== 'HOME' && side !== 'AWAY')) return;
  const { error } = await sb().from('calls').insert({ league_id: leagueId, user_id: user.id, game_id, side, margin, body });
  if (error) throw new Error(/row-level security/i.test(error.message) ? 'That game has kicked off, or calls are switched off.' : error.message);
  revalidatePath(`/l/${leagueId}/chat`);
}

export async function deleteCall(leagueId, id) {
  await sb().from('calls').delete().eq('id', id); // RLS: own before kickoff, or commissioner
  revalidatePath(`/l/${leagueId}/chat`);
}

export async function deleteMessage(leagueId, id) {
  await sb().from('messages').delete().eq('id', id); // RLS: own, or commissioner
  revalidatePath(`/l/${leagueId}/chat`);
}

// ---------- scores (commissioner) ----------

// Force a score sync for this league's sport, throttle or no throttle.
export async function syncNow(leagueId) {
  const { data: league } = await sb().from('leagues').select('id, sport, commissioner').eq('id', leagueId).maybeSingle(); // RLS: members
  const user = await currentUser();
  if (!league || !user || league.commissioner !== user.id) return;
  const { syncSport } = await import('./scores/sync.js');
  await syncSport(league.sport, true);
  revalidatePath(`/l/${leagueId}`, 'layout');
}

// ---------- survivor ----------

// One team for this slate. The first pick also takes the seat (a
// survivor_entries row). The database is the referee: entries open only
// until the pool's first slate locks, a pick must be on an unstarted game
// in this league's slate, and a team used earlier in the season is refused
// by the unique key. This turns those refusals into plain English.
export async function saveSurvivorPick(leagueId, season, slateKey, gameId, side) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (side !== 'HOME' && side !== 'AWAY') throw new Error('Pick a side.');
  const db = sb();
  const seat = { league_id: leagueId, user_id: user.id, season };
  const { data: entry } = await db.from('survivor_entries').select('user_id').match(seat).maybeSingle();
  if (!entry) {
    const { error } = await db.from('survivor_entries').insert(seat); // RLS: member, pool on, entries open
    if (error) throw new Error(/row-level security/i.test(error.message) ? 'Entries are closed: the pool\u2019s first week has already locked.' : error.message);
  }
  const { error } = await db.from('survivor_picks')
    .upsert({ ...seat, slate_key: slateKey, game_id: gameId, picked: side }, { onConflict: 'league_id,user_id,season,slate_key' }); // RLS: own, open game, in slate
  if (error) {
    if (/survivor_picks_league_id_user_id_season_team_key|duplicate key/i.test(error.message)) throw new Error('You already used that team this season.');
    if (/row-level security/i.test(error.message)) throw new Error('That game has kicked off, or your pick for this week is locked.');
    throw new Error(error.message);
  }
  revalidatePath(`/l/${leagueId}`, 'layout');
  return { ok: true };
}

export async function clearSurvivorPick(leagueId, season, slateKey) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { data, error } = await sb().from('survivor_picks').delete()
    .match({ league_id: leagueId, user_id: user.id, season, slate_key: slateKey }).select('game_id'); // RLS: own, game not started
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('That pick is locked: its game has kicked off.');
  revalidatePath(`/l/${leagueId}`, 'layout');
}

// Leave the pool. RLS: only while entries are open, or as the commissioner.
export async function withdrawSurvivor(leagueId, season, userId = null) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { data, error } = await sb().from('survivor_entries').delete()
    .match({ league_id: leagueId, user_id: userId ?? user.id, season }).select('user_id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Entries have locked; ask the commissioner.');
  revalidatePath(`/l/${leagueId}`, 'layout');
}

export async function setSurvivorPaid(leagueId, userId, season, paid) {
  await sb().from('survivor_entries').update({ paid }).match({ league_id: leagueId, user_id: userId, season }); // RLS: commissioner
  revalidatePath(`/l/${leagueId}`, 'layout');
}

// ---------- the matchup fold ----------

// What ESPN's summary says about one game, cached in game_notes: a day
// before kickoff, forever once the game is final. Anyone signed in may ask;
// the write is the server's. Returns the notes, or null when ESPN has nothing.
export async function loadMatchup(gameId) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = sb();
  const { data: game } = await db.from('games').select('id, sport, state, home_abbr, away_abbr, kickoff').eq('id', String(gameId)).maybeSingle();
  if (!game) return null;
  const a = admin();
  const { data: cached, error } = await a.from('game_notes').select('notes, fetched_at').eq('game_id', game.id).maybeSingle();
  if (error) return null; // the table is not there yet: the fold shows the room's take only
  const age = cached ? Date.now() - new Date(cached.fetched_at).getTime() : Infinity;
  const fresh = cached && (game.state === 'post' || age < 24 * 3600_000);
  if (fresh) return cached.notes;
  const { fetchSummary, normalizeSummary, notesEmpty } = await import('./scores/matchup.js');
  const data = await fetchSummary(game.sport, game.id);
  const notes = normalizeSummary(data, { abbr: game.home_abbr }, { abbr: game.away_abbr });
  if (notesEmpty(notes)) return cached?.notes ?? null;
  await a.from('game_notes').upsert({ game_id: game.id, notes, fetched_at: new Date().toISOString() });
  return notes;
}

// ---------- reactions ----------

// One reaction per person per pick: tapping the same emoji again removes it,
// a different one replaces it. RLS: members, own row, kicked-off games only.
export async function react(leagueId, entryId, gameId, emoji) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = sb();
  const key = { entry_id: entryId, game_id: gameId, user_id: user.id };
  const { data: existing } = await db.from('reactions').select('emoji').match(key).maybeSingle();
  if (existing?.emoji === emoji) await db.from('reactions').delete().match(key);
  else {
    const { error } = await db.from('reactions').upsert({ league_id: leagueId, ...key, emoji }, { onConflict: 'entry_id,game_id,user_id' });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/l/${leagueId}/board`);
}

// ---------- tours ----------

// Remember a finished walkthrough on the profile ('player' or 'commish');
// reset: true forgets it so the tour runs again. RLS: your own row.
export async function markTour(kind, reset = false) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!['player', 'commish'].includes(kind)) return;
  const db = sb();
  const { data } = await db.from('profiles').select('tours').eq('id', user.id).maybeSingle();
  const tours = { ...(data?.tours ?? {}) };
  if (reset) delete tours[kind]; else tours[kind] = new Date().toISOString();
  await db.from('profiles').update({ tours }).eq('id', user.id);
  revalidatePath('/', 'layout');
}

// ---------- profile ----------

export async function saveProfile(formData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  await sb()
    .from('profiles')
    .update({
      display_name: String(formData.get('display_name') || '').trim().slice(0, 40),
      emoji: String(formData.get('emoji') || '🏈').slice(0, 8),
      venmo_handle: String(formData.get('venmo_handle') || '').trim().slice(0, 60),
    })
    .eq('id', user.id);
  redirect('/');
}

// ---------- money (commissioner) ----------

export async function setPaid(leagueId, entryId, paid) {
  await sb().from('entries').update({ paid }).eq('id', entryId); // trigger enforces commissioner
  revalidatePath(`/l/${leagueId}`, 'layout');
}

export async function recordPayout(leagueId, season, slateKey, userId, amountCents) {
  await sb().from('payouts').insert({
    league_id: leagueId, season, slate_key: slateKey, user_id: userId, amount_cents: amountCents,
  }); // RLS: commissioner only
  revalidatePath(`/l/${leagueId}`, 'layout');
}

export async function undoPayout(leagueId, payoutId) {
  await sb().from('payouts').delete().eq('id', payoutId); // RLS: commissioner only
  revalidatePath(`/l/${leagueId}`, 'layout');
}

export async function signOut() {
  await sb().auth.signOut();
  redirect('/login');
}
