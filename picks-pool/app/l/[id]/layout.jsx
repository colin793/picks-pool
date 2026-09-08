import { leagueContext, currentSlate } from '../../../lib/league';
import { sb } from '../../../lib/supabase';
import LeagueShell from '../../components/LeagueShell';
import Tour from '../../components/Tour';
import { playerSteps } from '../../../lib/tour';
import { money } from '../../../lib/stats';

export const dynamic = 'force-dynamic';

export default async function LeagueLayout({ children, params }) {
  const { user, league, isCommish, sport } = await leagueContext(params.id);
  const db = sb();
  const [slate, { data: profile }, { data: tourRow, error: tourErr }] = await Promise.all([
    currentSlate(league),
    db.from('profiles').select('display_name, emoji').eq('id', user.id).single(),
    // Separately, so a database without the tours column yet still gets a name and an emoji.
    db.from('profiles').select('tours').eq('id', user.id).maybeSingle(),
  ]);
  const showTour = !tourErr && tourRow && !tourRow.tours?.player;
  return (
    <LeagueShell league={league} sport={sport} slate={slate} profile={profile} isCommish={isCommish} base={`/l/${league.id}`}>
      {children}
      {showTour && <Tour kind="player" steps={playerSteps(league, sport, { fee: league.entry_fee_cents > 0 ? money(league.entry_fee_cents) : null })} />}
    </LeagueShell>
  );
}
