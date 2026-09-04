import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '../../lib/supabase';
import { createLeague } from '../../lib/actions';
import { SPORT_LIST } from '../../lib/scores/sports';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New league' };

export default async function NewLeague() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/new');

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">&larr; My leagues</Link>
      <h1 className="h1 mt-3 mb-4">Create a league</h1>
      <form action={createLeague} className="card">
        <label className="label">League name</label>
        <input className="input" type="text" name="name" required maxLength={60} placeholder="Draft With Purpose" autoFocus />
        <label className="label">Sport</label>
        <select name="sport" className="input" defaultValue="nfl">
          {SPORT_LIST.map((s) => <option key={s.key} value={s.key}>{s.name}{s.mode === 'date' ? ' (daily slates)' : ''}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">Fixed once the league exists. NFL and college football play by the week; the others play by the day.</p>
        <label className="label">Your Venmo handle (players pay their entry here)</label>
        <input className="input" type="text" name="venmo" placeholder="@your-venmo" />
        <button className="btn mt-4">Create league</button>
      </form>
      <p className="mt-3 text-xs text-muted">You become the commissioner. Entry fee, colors, logo and the rest live in the Admin tab.</p>
    </div>
  );
}
