import { redirect } from 'next/navigation';
import { admin, currentUser } from '../../../lib/supabase';
import { joinLeague } from '../../../lib/actions';
import { sport as sportOf } from '../../../lib/scores/sports';
import { money } from '../../../lib/stats';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Join' };

export default async function Join({ params, searchParams }) {
  const code = params.code.toLowerCase();
  const user = await currentUser();
  if (!user) redirect(`/login?next=/join/${code}`);

  // Service role: invite codes are not readable through RLS on purpose.
  const { data: league } = await admin()
    .from('leagues')
    .select('id, name, sport, logo_url, color2, entry_fee_cents')
    .eq('invite_code', code)
    .maybeSingle();

  if (!league) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="card">
          <h1 className="h2 mb-2">That invite doesn&rsquo;t match any league</h1>
          <p className="text-sm text-muted">Double-check the link, or ask the commissioner for a fresh one. Links can be regenerated.</p>
        </div>
      </div>
    );
  }
  const s = sportOf(league.sport);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="card text-center">
        {league.logo_url
          ? <img src={league.logo_url} alt="" className="mx-auto mb-3 h-16 w-16 rounded-lg object-contain" />
          : <span className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-lg font-display text-3xl font-bold text-white" style={{ background: league.color2 }}>{league.name.slice(0, 1).toUpperCase()}</span>}
        <p className="eyebrow">You&rsquo;re invited</p>
        <h1 className="h1 mt-1 mb-2">{league.name}</h1>
        <p className="text-sm text-ink2">
          {s.name} pick&rsquo;em. {money(league.entry_fee_cents)} per {s.mode === 'week' ? 'week' : 'slate'}, opt in whenever you want. Most correct picks takes the pot.
        </p>
        <form action={joinLeague} className="mt-4">
          <input type="hidden" name="code" value={code} />
          <button className="btn w-full">Join this league</button>
        </form>
        {searchParams?.bad && <p className="mt-3 text-sm text-bad">Something went wrong, try again.</p>}
      </div>
    </div>
  );
}
