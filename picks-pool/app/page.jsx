import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sb, currentUser } from '../lib/supabase';
import { signOut } from '../lib/actions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = sb();
  const [{ data: memberships }, { data: profile }] = await Promise.all([
    db.from('memberships').select('league_id, leagues(id, name, logo_url, color1)').eq('user_id', user.id),
    db.from('profiles').select('*').eq('id', user.id).single(),
  ]);
  const leagues = (memberships ?? []).map((m) => m.leagues).filter(Boolean);
  if (leagues.length === 1) redirect(`/l/${leagues[0].id}`);

  return (
    <div className="wrap">
      <h1>Hey {profile?.display_name || 'there'} {profile?.emoji}</h1>
      {leagues.length === 0 && (
        <div className="card">
          <p>You're not in a league yet. Create one, or open the invite link someone sent you.</p>
        </div>
      )}
      {leagues.map((l) => (
        <Link key={l.id} href={`/l/${l.id}`}>
          <div className="card row">
            {l.logo_url ? <img src={l.logo_url} alt="" height={32} /> : null}
            <strong className="grow" style={{ color: l.color1 }}>{l.name}</strong>
            <span>&rarr;</span>
          </div>
        </Link>
      ))}
      <div className="card row">
        <Link className="btn" href="/new">Create a league</Link>
        <Link className="btn gray" href="/settings">My settings</Link>
        <form action={signOut} className="grow" style={{ textAlign: 'right' }}>
          <button className="note" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
        </form>
      </div>
    </div>
  );
}
