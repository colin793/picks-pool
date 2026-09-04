import { redirect } from 'next/navigation';
import { leagueContext, currentSlate } from '../../../../lib/league';
import { appUrl } from '../../../../lib/supabase';
import { slateResults, potFor } from '../../../../lib/stats';
import AdminView from '../../../components/AdminView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin' };

export default async function Admin({ params }) {
  const { user, league, db, isCommish, sport } = await leagueContext(params.id);
  if (!isCommish) redirect(`/l/${params.id}`);
  const now = await currentSlate(league);

  const { data: members } = await db
    .from('memberships').select('user_id, created_at, profiles(id, display_name, emoji, email, venmo_handle)')
    .eq('league_id', league.id).order('created_at');
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));
  const inviteUrl = `${appUrl()}/join/${league.invite_code}`;

  // Current-slate fee list, plus any completed slate still owed a payout.
  let feeRows = [], owed = [], paidOut = [];
  if (now) {
    const [{ data: allEntries }, { data: allGames }, { data: payouts }] = await Promise.all([
      db.from('entries').select('*').eq('league_id', league.id).eq('season', now.season),
      db.from('games').select('*').eq('sport', league.sport).eq('season', now.season),
      db.from('payouts').select('*').eq('league_id', league.id).eq('season', now.season).order('created_at', { ascending: false }),
    ]);
    const entryIds = (allEntries ?? []).map((e) => e.id);
    const { data: allPicks } = entryIds.length
      ? await db.from('picks').select('entry_id, game_id, picked').in('entry_id', entryIds)
      : { data: [] };

    feeRows = (allEntries ?? []).filter((e) => e.slate_key === now.key);
    const labels = new Map((allGames ?? []).map((g) => [g.slate_key, g.slate_label]));
    paidOut = (payouts ?? []).map((p) => ({ ...p, label: labels.get(p.slate_key) }));
    const paidSlates = new Set(paidOut.map((p) => p.slate_key));
    for (const key of [...new Set((allEntries ?? []).map((e) => e.slate_key))].sort()) {
      if (paidSlates.has(key)) continue;
      const games = (allGames ?? []).filter((g) => g.slate_key === key);
      const entries = (allEntries ?? []).filter((e) => e.slate_key === key);
      const ids = new Set(entries.map((e) => e.id));
      const r = slateResults(games, entries, (allPicks ?? []).filter((p) => ids.has(p.entry_id)));
      if (r.complete && r.winners.length) {
        const { pot, share } = potFor(entries, league.entry_fee_cents, r.winners);
        owed.push({
          key, label: labels.get(key) ?? key, pot, share,
          winners: r.winners.map((w) => ({ user_id: w.user_id, name: names.get(w.user_id)?.display_name ?? 'Player', venmo: names.get(w.user_id)?.venmo_handle ?? '' })),
        });
      }
    }
  }

  return (
    <AdminView user={user} league={league} sport={sport} members={members ?? []} names={names}
      inviteUrl={inviteUrl} now={now} feeRows={feeRows} owed={owed} paidOut={paidOut} />
  );
}
