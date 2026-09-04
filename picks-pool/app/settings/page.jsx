import { redirect } from 'next/navigation';
import Link from 'next/link';
import { sb, currentUser } from '../../lib/supabase';
import { saveProfile, leaveLeague } from '../../lib/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

export default async function Settings() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = sb();
  const [{ data: p }, { data: memberships }] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).single(),
    db.from('memberships').select('leagues(id, name, commissioner)').eq('user_id', user.id),
  ]);
  const leagues = (memberships ?? []).map((m) => m.leagues).filter(Boolean);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">&larr; My leagues</Link>
      <h1 className="h1 mt-3 mb-4">My settings</h1>
      <form action={saveProfile} className="card">
        <label className="label">Display name</label>
        <input className="input" type="text" name="display_name" defaultValue={p?.display_name ?? ''} required maxLength={40} />
        <label className="label">Emoji avatar</label>
        <input className="input" type="text" name="emoji" defaultValue={p?.emoji ?? '🏈'} maxLength={8} />
        <label className="label">Venmo handle (so the winner link points at you when you win)</label>
        <input className="input" type="text" name="venmo_handle" defaultValue={p?.venmo_handle ?? ''} placeholder="@your-venmo" />
        <p className="mt-3 text-xs text-muted">Signed in as {user.email}. Your name, emoji and Venmo handle are visible to people in your leagues.</p>
        <button className="btn mt-4">Save</button>
      </form>

      {leagues.length > 0 && (
        <section className="card mt-4">
          <h2 className="h2 mb-2">Your leagues</h2>
          {leagues.map((l) => (
            <div key={l.id} className="flex items-center gap-2 border-t border-line py-2 text-sm">
              <span className="flex-1">{l.name}</span>
              {l.commissioner === user.id
                ? <span className="text-xs text-muted">you run it (delete or hand it off in Admin)</span>
                : <form action={leaveLeague.bind(null, l.id)}><button className="btn btn-ghost btn-sm">Leave</button></form>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
