import { redirect } from 'next/navigation';
import { admin, currentUser } from '../../../lib/supabase';
import { joinLeague } from '../../../lib/actions';

export const dynamic = 'force-dynamic';

export default async function Join({ params, searchParams }) {
  const code = params.code.toLowerCase();
  const user = await currentUser();
  if (!user) redirect(`/login?next=/join/${code}`);

  const { data: league } = await admin()
    .from('leagues')
    .select('id, name, logo_url, entry_fee_cents')
    .eq('invite_code', code)
    .single();

  if (!league) {
    return (
      <div className="wrap">
        <h1>Invite link</h1>
        <div className="card"><p className="err">That invite code doesn't match any league. Double-check the link.</p></div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <h1>Join {league.name}</h1>
      <div className="card">
        {league.logo_url ? <p><img src={league.logo_url} alt="" height={48} /></p> : null}
        <p>${(league.entry_fee_cents / 100).toFixed(2)} per week, opt in whenever you want. Most correct picks takes the pot.</p>
        <form action={joinLeague}>
          <input type="hidden" name="code" value={code} />
          <button className="btn">Join this league</button>
        </form>
        {searchParams?.bad && <p className="err">Something went wrong, try again.</p>}
      </div>
    </div>
  );
}
