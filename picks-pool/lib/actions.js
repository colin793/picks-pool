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
export async function savePicks(leagueId, season, slateKey, picks, tiebreaker) {
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
  revalidatePath(`/l/${leagueId}`, 'layout');
  return { saved: rows.length, unchanged: openWanted.length - rows.length, refused, tiebreaker: tbSaved, entryId: entry.id };
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

export async function deleteMessage(leagueId, id) {
  await sb().from('messages').delete().eq('id', id); // RLS: own, or commissioner
  revalidatePath(`/l/${leagueId}/chat`);
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
