import { money, venmoLink } from '../../lib/stats';
import {
  updateLeague, setPaid, recordPayout, undoPayout, regenerateInvite,
  transferLeague, deleteLeague, removeMember, setFeatured, resetFeatured, syncNow,
} from '../../lib/actions';
import { rankedAbbr } from '../../lib/featured';
import CopyButton from './CopyButton';
import ConfirmForm from './ConfirmForm';
import LocalTime from './LocalTime';

// One row of the featured-games list: matchup with ranks, kickoff, and the swap button.
function SlateRow({ g, on, started, action }) {
  const matchup = `${rankedAbbr(g.away_abbr, g.away_rank)} @ ${rankedAbbr(g.home_abbr, g.home_rank)}`;
  const ranked = Boolean(g.home_rank || g.away_rank);
  return (
    <li className="flex items-center gap-3 border-t border-line py-2 text-sm">
      <span className={`min-w-0 flex-1 truncate ${ranked ? 'font-semibold' : ''}`}>{matchup}</span>
      <span className="hidden shrink-0 text-xs text-muted sm:inline">
        {g.state === 'post' ? 'Final' : g.state === 'in' ? <span className="text-accent">Live</span> : <LocalTime iso={g.kickoff} />}
      </span>
      {started
        ? <span className="pill pill-muted shrink-0">{on ? 'Locked in' : 'Started'}</span>
        : <form action={action}><button className="btn btn-ghost btn-sm">{on ? 'Remove' : 'Add'}</button></form>}
    </li>
  );
}

// The Admin page body. The server page computes the money state; /dev feeds fixtures.
export default function AdminView({ user, league, sport, members, names, inviteUrl, now, feeRows, owed, paidOut, slate = null, clock = Date.now(), hasEntries = false, lastSync = null }) {
  const inSlate = new Set((slate?.games ?? []).map((g) => g.id));
  const available = (slate?.board ?? []).filter((g) => !inSlate.has(g.id) && new Date(g.kickoff).getTime() > clock);
  return (
    <>
      <div className="mb-5">
        <p className="eyebrow">Commissioner</p>
        <h1 className="h1 mt-1">Admin</h1>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="card lg:col-span-2">
          <h2 className="h2 mb-2">Invite link</h2>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-surface2 px-3 py-2 text-sm">{inviteUrl}</code>
            <CopyButton text={inviteUrl} />
            <form action={regenerateInvite.bind(null, league.id)}>
              <button className="btn btn-ghost btn-sm" title="Old link stops working">New link</button>
            </form>
          </div>
          <p className="mt-2 text-xs text-muted">Text it to anyone you want in. Anyone with the link can join, so make a new one if it gets loose.</p>
        </section>

        <section className="card">
          <h2 className="h2 mb-1">Scores</h2>
          <p className="mb-2 text-xs text-muted">
            Scores come from ESPN whenever anyone opens the app, at most once a minute. If the board looks stale on a Sunday, pull them by hand.
            {lastSync ? <> Last sync <LocalTime iso={lastSync} extra={{ hour: 'numeric', minute: '2-digit' }} />.</> : ''}
          </p>
          <form action={syncNow.bind(null, league.id)}><button className="btn btn-ghost btn-sm">Sync now</button></form>
        </section>

        {slate?.curated && (
          <section className="card lg:col-span-2">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="h2">Featured games</h2>
              <span className="pill pill-muted">{slate.games.length} of {slate.board.length}</span>
              <form action={resetFeatured.bind(null, league.id, slate.season, slate.key)} className="ml-auto">
                <button className="btn btn-ghost btn-sm" title="Re-run the auto-pick over the whole board">Back to auto-pick</button>
              </form>
            </div>
            <p className="mb-2 text-xs text-muted">
              Picked from the rankings: ranked-vs-ranked first, then the best ranked teams, then power-conference games.
              Swap anything below. A game that has kicked off stays put, and removing a game deletes any picks on it.
            </p>
            <ul>
              {slate.games.map((g) => (
                <SlateRow key={g.id} g={g} on started={new Date(g.kickoff).getTime() <= clock}
                  action={setFeatured.bind(null, league.id, slate.season, slate.key, g.id, false)} />
              ))}
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink2">Add a game <span className="font-normal text-muted">({available.length} more on the board)</span></summary>
              <ul className="mt-1">
                {available.map((g) => (
                  <SlateRow key={g.id} g={g} on={false} started={false}
                    action={setFeatured.bind(null, league.id, slate.season, slate.key, g.id, true)} />
                ))}
              </ul>
            </details>
          </section>
        )}

        {owed.map((o) => (
          <section className="card border-good/40" key={o.key}>
            <h2 className="h2 mb-1">{o.label} payout</h2>
            <p className="text-sm text-ink2 mb-3">Pot {money(o.pot)}{o.winners.length > 1 ? `, split ${o.winners.length} ways` : ''}</p>
            {o.winners.map((w) => (
              <div className="flex flex-wrap items-center gap-2 border-t border-line py-2" key={w.user_id}>
                <span className="flex-1 font-semibold">{w.name} <span className="num text-good">{money(o.share)}</span></span>
                {w.venmo
                  ? <a className="btn btn-sm" href={venmoLink(w.venmo, o.share, `${league.name} ${o.label} winnings`)}>Venmo {w.name}</a>
                  : <span className="text-xs text-muted">No Venmo handle set</span>}
                <form action={recordPayout.bind(null, league.id, now.season, o.key, w.user_id, o.share)}>
                  <button className="btn btn-ghost btn-sm">Mark sent</button>
                </form>
              </div>
            ))}
          </section>
        ))}

        <section className="card">
          <h2 className="h2 mb-1">{now?.label ?? 'This slate'} entry fees</h2>
          <p className="mb-2 text-xs text-muted">Check your Venmo, tick people off. The unpaid badge on the board does the nagging.</p>
          {feeRows.length === 0 && <p className="text-sm text-muted">No entries yet.</p>}
          {feeRows.map((e) => (
            <div className="flex items-center gap-2 border-t border-line py-2" key={e.id}>
              <span className="flex-1">{names.get(e.user_id)?.emoji} {names.get(e.user_id)?.display_name ?? 'Player'}</span>
              {e.paid ? <span className="pill pill-good">paid</span> : <span className="pill pill-bad">unpaid</span>}
              <form action={setPaid.bind(null, league.id, e.id, !e.paid)}>
                <button className="btn btn-ghost btn-sm">{e.paid ? 'Mark unpaid' : 'Mark paid'}</button>
              </form>
            </div>
          ))}
        </section>

        <section className="card">
          <h2 className="h2 mb-1">Members</h2>
          <p className="mb-2 text-xs text-muted">{members?.length ?? 0} in the league. Removing someone keeps their past entries.</p>
          {(members ?? []).map((m) => (
            <div className="flex items-center gap-2 border-t border-line py-2" key={m.user_id}>
              <span className="flex-1 truncate">
                {m.profiles?.emoji} {m.profiles?.display_name ?? 'Player'}
                {m.user_id === league.commissioner && <span className="pill pill-muted ml-2">commish</span>}
                <span className="block text-xs text-muted">{m.profiles?.email}</span>
              </span>
              {m.user_id !== league.commissioner && (
                <form action={removeMember.bind(null, league.id, m.user_id)}>
                  <button className="btn btn-ghost btn-sm">Remove</button>
                </form>
              )}
            </div>
          ))}
          {paidOut.length > 0 && (
            <>
              <h3 className="eyebrow mt-4 mb-1">Payouts sent</h3>
              {paidOut.map((p) => (
                <div className="flex items-center gap-2 border-t border-line py-1.5 text-sm" key={p.id}>
                  <span className="flex-1">{names.get(p.user_id)?.display_name ?? 'Player'} · {money(p.amount_cents)} · {p.label ?? p.slate_key}</span>
                  <form action={undoPayout.bind(null, league.id, p.id)}><button className="text-xs text-muted hover:text-bad">undo</button></form>
                </div>
              ))}
            </>
          )}
        </section>

        <form action={updateLeague.bind(null, league.id)} className="card">
          <h2 className="h2 mb-1">League settings</h2>
          <p className="text-xs text-muted">Sport: <strong className="text-ink">{sport.name}</strong> (fixed once a league exists)</p>
          <label className="label">League name</label>
          <input className="input" type="text" name="name" defaultValue={league.name} required maxLength={60} />
          <label className="label">Logo URL (any hosted image; blank for none)</label>
          <input className="input" type="url" name="logo_url" defaultValue={league.logo_url} placeholder="https://…/logo.png" />
          <div className="mt-3 flex gap-6">
            <label className="text-xs font-semibold text-ink2">Accent<br /><input type="color" name="color1" defaultValue={league.color1} className="mt-1 h-9 w-14 cursor-pointer rounded border border-line bg-transparent" /></label>
            <label className="text-xs font-semibold text-ink2">Header<br /><input type="color" name="color2" defaultValue={league.color2} className="mt-1 h-9 w-14 cursor-pointer rounded border border-line bg-transparent" /></label>
          </div>
          <label className="label">Entry fee (dollars per slate)</label>
          <input className="input" type="number" name="fee" step="0.25" min="0" defaultValue={(league.entry_fee_cents / 100).toFixed(2)} />
          <label className="label">Scoring</label>
          <select className="input" name="scoring" defaultValue={league.scoring ?? 'straight'} disabled={hasEntries}>
            <option value="straight">Straight up: pick the winner</option>
            <option value="spread">Against the spread: pick who covers the line at kickoff</option>
          </select>
          <p className="mt-1 text-xs text-muted">{hasEntries ? 'Locked: the league already has entries. It is set for the season.' : 'Fixed once anyone enters. A push scores for nobody; a game with no line is scored straight up.'}</p>
          <label className="label">Your Venmo handle (entry fees go here)</label>
          <input className="input" type="text" name="venmo" defaultValue={league.venmo_handle} placeholder="@your-venmo" />
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="recap" defaultChecked={league.recap_enabled} /> Send the results recap email</label>
          <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" name="reminders" defaultChecked={league.reminders_enabled} /> Remind people who haven&rsquo;t entered</label>
          <button className="btn mt-4">Save settings</button>
        </form>

        <section className="card border-bad/30 lg:col-span-2">
          <h2 className="h2 mb-1 text-bad">Danger zone</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">Hand off the league</h3>
              <p className="mb-2 text-xs text-muted">The new commissioner gets the Admin tab; you stay a member.</p>
              <form action={transferLeague.bind(null, league.id)} className="flex gap-2">
                <select name="user_id" className="input" defaultValue="">
                  <option value="" disabled>Choose a member</option>
                  {(members ?? []).filter((m) => m.user_id !== user.id).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name ?? m.user_id}</option>
                  ))}
                </select>
                <button className="btn btn-ghost whitespace-nowrap">Hand off</button>
              </form>
            </div>
            <div>
              <h3 className="font-semibold">Delete this league</h3>
              <p className="mb-2 text-xs text-muted">Removes every entry, pick and payout record with it. There is no undo.</p>
              <ConfirmForm action={deleteLeague.bind(null, league.id)} phrase={league.name} buttonLabel="Delete league" />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
