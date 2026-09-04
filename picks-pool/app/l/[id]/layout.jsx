import { leagueContext, currentSlate } from '../../../lib/league';
import { sb } from '../../../lib/supabase';
import LeagueShell from '../../components/LeagueShell';

export const dynamic = 'force-dynamic';

export default async function LeagueLayout({ children, params }) {
  const { user, league, isCommish, sport } = await leagueContext(params.id);
  const [slate, { data: profile }] = await Promise.all([
    currentSlate(league),
    sb().from('profiles').select('display_name, emoji').eq('id', user.id).single(),
  ]);
  return (
    <LeagueShell league={league} sport={sport} slate={slate} profile={profile} isCommish={isCommish} base={`/l/${league.id}`}>
      {children}
    </LeagueShell>
  );
}
