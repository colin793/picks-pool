import { leagueContext, currentSlate } from '../../../lib/league';
import { sb } from '../../../lib/supabase';
import LeagueShell from '../../components/LeagueShell';
import Tour from '../../components/Tour';
import { playerSteps } from '../../../lib/tour';
import { money, slateResults } from '../../../lib/stats';
import { railLine } from '../../../lib/rail';
import { applyFeatured } from '../../../lib/featured';
import { featuredRows } from '../../../lib/league';
import { loadChat } from '../../../lib/actions';

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

  // The rail: every league you are in, with where you stand this slate and
  // whether games are on. A few small reads per league, in parallel.
  const { data: mine } = await db.from('memberships').select('leagues(id, name, sport, logo_url, color1, color2, lock_of_week, scoring)').eq('user_id', user.id).order('created_at');
  const rail = await Promise.all((mine ?? []).map((m) => m.leagues).filter(Boolean).map(async (l) => {
    try {
      const { data: state } = await db.from('sport_state').select('season, slate_key, slate_label').eq('sport', l.sport).maybeSingle();
      if (!state?.slate_key) return { ...l, ...railLine(null, user.id, null) };
      const [{ data: board }, rows, { data: entries }] = await Promise.all([
        db.from('games').select('id, kickoff, state, winner, home_score, away_score, home_spread, slate_key').eq('sport', l.sport).eq('season', state.season).eq('slate_key', state.slate_key),
        featuredRows(db, l, state.season),
        db.from('entries_board').select('*').eq('league_id', l.id).eq('season', state.season).eq('slate_key', state.slate_key),
      ]);
      const games = applyFeatured(board ?? [], rows);
      const ids = (entries ?? []).map((e) => e.id);
      const { data: picks } = ids.length ? await db.from('picks').select('entry_id, game_id, picked').in('entry_id', ids) : { data: [] };
      const results = slateResults(games, entries ?? [], picks ?? [], { scoring: l.scoring, lock: Boolean(l.lock_of_week) });
      return { ...l, ...railLine(results, user.id, state.slate_label, { live: games.some((g) => g.state === 'in') }) };
    } catch { return { ...l, text: '', live: false }; }
  }));
  const here = rail.find((l) => l.id === league.id);
  const chat = { initial: await loadChat(league.id).catch(() => null) };

  return (
    <LeagueShell league={league} sport={sport} slate={slate} profile={profile} isCommish={isCommish} base={`/l/${league.id}`}
      rail={rail.map((l) => ({ ...l, line: l.text }))} live={Boolean(here?.live)} chat={chat}>
      {children}
      {showTour && <Tour kind="player" steps={playerSteps(league, sport, { fee: league.entry_fee_cents > 0 ? money(league.entry_fee_cents) : null })} />}
    </LeagueShell>
  );
}
