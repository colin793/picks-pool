import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sb, currentUser } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export default async function LeagueLayout({ children, params }) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/l/${params.id}`);
  const db = sb();
  const { data: league } = await db.from('leagues').select('*').eq('id', params.id).single();
  if (!league) redirect('/');
  const { data: member } = await db
    .from('memberships').select('user_id')
    .eq('league_id', params.id).eq('user_id', user.id).maybeSingle();
  if (!member) redirect(`/join/${league.invite_code}`);

  const base = `/l/${league.id}`;
  const isCommish = league.commissioner === user.id;

  return (
    <div style={{ '--c1': league.color1, '--c2': league.color2 }}>
      <div className="brandbar">
        <div className="inner">
          {league.logo_url ? <img src={league.logo_url} alt="" /> : null}
          <span className="name">{league.name}</span>
          <Link href="/">My leagues</Link>
        </div>
      </div>
      <nav className="tabs">
        <Link href={base}>Picks</Link>
        <Link href={`${base}/board`}>This week</Link>
        <Link href={`${base}/season`}>Season</Link>
        {isCommish && <Link href={`${base}/admin`}>Admin</Link>}
      </nav>
      <div className="wrap">{children}</div>
    </div>
  );
}
