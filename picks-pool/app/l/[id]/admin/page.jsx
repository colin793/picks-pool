import { redirect } from 'next/navigation';
import { sb, currentUser } from '../../../../lib/supabase';
import { syncScores } from '../../../../lib/espn';
import { weekResults, money, venmoLink } from '../../../../lib/stats';
import { updateLeague, setPaid, recordPayout } from '../../../../lib/actions';

export const dynamic = 'force-dynamic';

export default async function Admin({ params }) {
  const user = await currentUser();
  const meta = await syncScores();
  const db = sb();
  const { data: league } = await db.from('leagues').select('*').eq('id', params.id).single();
  if (!league || league.commissioner !== user.id) redirect(`/l/${params.id}`);

  const { data: members } = await db
    .from('memberships').select('user_id, profiles(id, display_name, venmo_handle)')
    .eq('league_id', params.id);
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));

  const inviteUrl = `${process.env.APP_URL ?? ''}/join/${league.invite_code}`;

  // Current-week paid list + any completed week still owed a payout.
  let paidRows = [], owed = [];
  if (meta?.week) {
    const [{ data: allEntries }, { data: allGames }, { data: payouts }] = await Promise.all([
      db.from('entries').select('*').eq('league_id', params.id).eq('season', meta.season),
      db.from('games').select('*').eq('season', meta.season),
      db.from('payouts').select('*').eq('league_id', params.id).eq('season', meta.season),
    ]);
    const entryIds = (allEntries ?? []).map((e) => e.id);
    const { data: allPicks } = entryIds.length
      ? await db.from('picks').select('entry_id, game_id, picked').in('entry_id', entryIds)
      : { data: [] };

    paidRows = (allEntries ?? []).filter((e) => e.week === meta.week);
    const paidOutWeeks = new Set((payouts ?? []).map((p) => p.week));
    const weeks = [...new Set((allEntries ?? []).map((e) => e.week))];
    for (const week of weeks) {
      if (paidOutWeeks.has(week)) continue;
      const games = (allGames ?? []).filter((g) => g.week === week);
      const entries = (allEntries ?? []).filter((e) => e.week === week);
      const ids = new Set(entries.map((e) => e.id));
      const picks = (allPicks ?? []).filter((p) => ids.has(p.entry_id));
      const r = weekResults(games, entries, picks);
      if (r.complete && r.winners.length) {
        const pot = entries.length * league.entry_fee_cents;
        owed.push({
          week,
          winners: r.winners.map((w) => ({
            user_id: w.user_id,
            name: names.get(w.user_id)?.display_name ?? 'Player',
            venmo: names.get(w.user_id)?.venmo_handle ?? '',
            share: Math.floor(pot / r.winners.length),
          })),
          pot,
        });
      }
    }
  }

  return (
    <>
      <h1>Admin</h1>

      <div className="card">
        <h2>Invite link</h2>
        <p><a href={inviteUrl}>{inviteUrl}</a></p>
        <p className="note">Text this to anyone you want in the league.</p>
      </div>

      {owed.map((o) => (
        <div className="card" key={o.week}>
          <h2>Week {o.week} payout</h2>
          <p>Pot: <strong>{money(o.pot)}</strong>{o.winners.length > 1 ? `, split ${o.winners.length} ways` : ''}</p>
          {o.winners.map((w) => (
            <div className="row" key={w.user_id} style={{ marginBottom: 8 }}>
              <span className="grow">{w.name}: {money(w.share)}</span>
              {w.venmo
                ? <a className="btn" href={venmoLink(w.venmo, w.share, `${league.name} week ${o.week} winnings`)}>Venmo {w.name}</a>
                : <span className="note">No Venmo handle set</span>}
              <form action={recordPayout.bind(null, league.id, meta.season, o.week, w.user_id, w.share)}>
                <button className="btn gray">Mark sent</button>
              </form>
            </div>
          ))}
        </div>
      ))}

      <div className="card">
        <h2>Week {meta?.week} entry fees</h2>
        {paidRows.length === 0 && <p className="note">No entries yet.</p>}
        {paidRows.map((e) => (
          <div className="row" key={e.id} style={{ marginBottom: 6 }}>
            <span className="grow">{names.get(e.user_id)?.display_name ?? 'Player'}</span>
            {e.paid ? <span className="badge green">paid</span> : <span className="badge red">unpaid</span>}
            <form action={setPaid.bind(null, league.id, e.id, !e.paid)}>
              <button className="btn gray">{e.paid ? 'Mark unpaid' : 'Mark paid'}</button>
            </form>
          </div>
        ))}
        <p className="note">Check your Venmo, tick people off. The unpaid badge on the board does the nagging.</p>
      </div>

      <form action={updateLeague.bind(null, league.id)} className="card">
        <h2>League settings</h2>
        <label>League name</label>
        <input type="text" name="name" defaultValue={league.name} required />
        <label>Logo URL (any hosted image; blank for none)</label>
        <input type="url" name="logo_url" defaultValue={league.logo_url} placeholder="https://…/logo.png" />
        <div className="row">
          <div><label>Accent color</label><br /><input type="color" name="color1" defaultValue={league.color1} /></div>
          <div><label>Header color</label><br /><input type="color" name="color2" defaultValue={league.color2} /></div>
        </div>
        <label>Entry fee (dollars per week)</label>
        <input type="number" name="fee" step="0.25" min="0" defaultValue={(league.entry_fee_cents / 100).toFixed(2)} />
        <label>Your Venmo handle (entry fees go here)</label>
        <input type="text" name="venmo" defaultValue={league.venmo_handle} placeholder="@your-venmo" />
        <label style={{ display: 'block', margin: '8px 0' }}>
          <input type="checkbox" name="recap" defaultChecked={league.recap_enabled} /> Send the Tuesday AI recap email
        </label>
        <button className="btn">Save settings</button>
      </form>
    </>
  );
}
