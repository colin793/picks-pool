'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sb, admin, currentUser } from './supabase';

export async function createLeague(formData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const name = String(formData.get('name') || '').trim();
  if (!name) return;
  const { data: league, error } = await sb()
    .from('leagues')
    .insert({
      name,
      venmo_handle: String(formData.get('venmo') || '').trim(),
      commissioner: user.id,
    })
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
  const { data: league } = await db.from('leagues').select('id').eq('invite_code', code).single();
  if (!league) redirect(`/join/${code}?bad=1`);
  await db.from('memberships').upsert({ league_id: league.id, user_id: user.id });
  redirect(`/l/${league.id}`);
}

// picks: { [gameId]: 'HOME' | 'AWAY' }. RLS is the enforcement: rows for games
// already kicked off are rejected by the database, we just skip them politely.
export async function savePicks(leagueId, season, week, picks, tiebreaker) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = sb();

  const { data: entry, error } = await db
    .from('entries')
    .upsert(
      { league_id: leagueId, user_id: user.id, season, week },
      { onConflict: 'league_id,user_id,season,week' }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (tiebreaker !== null && tiebreaker !== '' && !Number.isNaN(Number(tiebreaker))) {
    await db.from('entries').update({ tiebreaker: Number(tiebreaker) }).eq('id', entry.id);
  }

  const { data: open } = await db.from('games').select('id').eq('season', season).eq('week', week).gt('kickoff', new Date().toISOString());
  const openIds = new Set((open ?? []).map((g) => g.id));
  const rows = Object.entries(picks)
    .filter(([gameId, side]) => openIds.has(gameId) && (side === 'HOME' || side === 'AWAY'))
    .map(([game_id, picked]) => ({ entry_id: entry.id, game_id, picked }));
  if (rows.length) {
    const { error: pickErr } = await db.from('picks').upsert(rows, { onConflict: 'entry_id,game_id' });
    if (pickErr) throw new Error(pickErr.message);
  }
  revalidatePath(`/l/${leagueId}`);
}

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

export async function updateLeague(leagueId, formData) {
  await sb()
    .from('leagues')
    .update({
      name: String(formData.get('name') || '').trim().slice(0, 60),
      logo_url: String(formData.get('logo_url') || '').trim(),
      color1: String(formData.get('color1') || '#1d4ed8'),
      color2: String(formData.get('color2') || '#111827'),
      entry_fee_cents: Math.max(0, Math.round(Number(formData.get('fee') || 1) * 100)),
      venmo_handle: String(formData.get('venmo') || '').trim(),
      recap_enabled: formData.get('recap') === 'on',
    })
    .eq('id', leagueId); // RLS: commissioner only
  revalidatePath(`/l/${leagueId}/admin`);
}

export async function setPaid(leagueId, entryId, paid) {
  await sb().from('entries').update({ paid }).eq('id', entryId); // trigger enforces commissioner
  revalidatePath(`/l/${leagueId}/admin`);
}

export async function recordPayout(leagueId, season, week, userId, amountCents) {
  await sb().from('payouts').insert({
    league_id: leagueId, season, week, user_id: userId, amount_cents: amountCents,
  }); // RLS: commissioner only
  revalidatePath(`/l/${leagueId}/admin`);
}

export async function signOut() {
  await sb().auth.signOut();
  redirect('/login');
}
