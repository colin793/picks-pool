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
      <div className="homehead">
        <p className="hi">{profile?.emoji} Hey, {profile?.display_name || 'there'}</p>
        <p className="sub">
          {leagues.length === 0
            ? 'No leagues yet. Start one, or open the invite link someone sent you.'
            : 'Pick a league.'}
        </p>
      </div>

      {leagues.map((l) => (
        <Link key={l.id} href={`/l/${l.id}`}>
          <div className="leaguecard" style={{ '--lc': l.color1 }}>
            {l.logo_url ? <img src={l.logo_url} alt="" height={36} /> : null}
            <span className="lname">{l.name}</span>
            <span className="go">&rarr;</span>
          </div>
        </Link>
      ))}

      <div className="actionrow">
        <Link className="actioncard" href="/new"><span>➕</span>Create a league</Link>
        <Link className="actioncard" href="/settings"><span>⚙️</span>My settings</Link>
      </div>

      <form action={signOut} style={{ textAlign: 'center', marginTop: 24 }}>
        <button className="note" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
      </form>
    </div>
  );
}
