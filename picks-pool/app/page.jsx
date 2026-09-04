import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sb, currentUser } from '../lib/supabase';
import { signOut, joinByCode } from '../lib/actions';
import { sport as sportOf } from '../lib/scores/sports';
import { Icon } from './components/icons';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = sb();
  const [{ data: memberships }, { data: profile }] = await Promise.all([
    db.from('memberships').select('league_id, leagues(id, name, sport, logo_url, color1, color2, commissioner)').eq('user_id', user.id).order('created_at'),
    db.from('profiles').select('*').eq('id', user.id).single(),
  ]);
  const leagues = (memberships ?? []).map((m) => m.leagues).filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Picks Pool</p>
          <h1 className="h1 mt-1">{profile?.emoji} Hey, {profile?.display_name || 'there'}</h1>
          <p className="mt-1 text-sm text-muted">
            {leagues.length === 0 ? 'No leagues yet. Start one, or paste the invite link someone sent you.' : 'Pick a league.'}
          </p>
        </div>
        <Link href="/settings" className="btn btn-ghost btn-sm">Settings</Link>
      </header>

      {searchParams?.notmember && <p className="mb-4 rounded-lg bg-warnsoft px-3 py-2 text-sm text-warn">You&rsquo;re not in that league. Ask the commissioner for an invite link.</p>}
      {searchParams?.deleted && <p className="mb-4 rounded-lg bg-goodsoft px-3 py-2 text-sm text-good">League deleted.</p>}

      <div className="space-y-3">
        {leagues.map((l) => {
          const s = sportOf(l.sport);
          return (
            <Link key={l.id} href={`/l/${l.id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-px hover:shadow-lg" style={{ borderLeft: `6px solid ${l.color1}` }}>
              {l.logo_url
                ? <img src={l.logo_url} alt="" className="h-11 w-11 rounded-md object-contain" />
                : <span className="grid h-11 w-11 place-items-center rounded-md font-display text-xl font-bold text-white" style={{ background: l.color2 }}>{l.name.slice(0, 1).toUpperCase()}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xl font-bold">{l.name}</span>
                <span className="text-xs text-muted">{s.name}{l.commissioner === user.id ? ' · you run this one' : ''}</span>
              </span>
              <span className="text-muted">&rarr;</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/new" className="card flex items-center gap-3 border-dashed p-4 font-semibold hover:border-accent hover:text-accent">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 text-lg">+</span> Create a league
        </Link>
        <form action={joinByCode} className="card flex items-center gap-2 p-3">
          <input name="code" className="input" placeholder="Paste an invite link or code" required />
          <button className="btn btn-sm">Join</button>
        </form>
      </div>

      <form action={signOut} className="mt-10 text-center">
        <button className="text-xs text-muted hover:text-ink">Sign out ({user.email})</button>
      </form>
    </div>
  );
}
