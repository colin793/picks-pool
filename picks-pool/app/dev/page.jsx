import { notFound } from 'next/navigation';
import Link from 'next/link';
import LeagueShell from '../components/LeagueShell';
import PicksForm from '../components/PicksForm';
import BoardView from '../components/BoardView';
import AdminView from '../components/AdminView';
import DevBump from '../components/DevBump';
import { sport as sportOf } from '../../lib/scores/sports';
import { LEAGUE, GAMES, ENTRIES, NAMES, PLAYERS, NOW, visiblePicks, EPL_GAMES, EPL_PICKS, EPL_NOW, CFB_BOARD, CFB_NOW } from '../../lib/fixtures';
import { featuredGames } from '../../lib/featured';
import { SPORTS } from '../../lib/scores/sports';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Design preview' };

// Design preview with fixture data, no database. Local dev only unless
// ALLOW_PREVIEW=1 (handy on a Vercel preview deploy).
//   /dev            picks page, mid-Sunday
//   /dev?view=board this week's board
export default function Preview({ searchParams }) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PREVIEW) notFound();
  const view = searchParams?.view ?? 'picks';
  // ?bump=N nudges the live games' scores so the flash can be seen.
  const bump = Math.max(0, Number(searchParams?.bump ?? 0) || 0);
  const games = bump
    ? GAMES.map((g, i) => (g.state !== 'in' ? g : {
        ...g,
        // Alternate which side scores on each click, so both the side you
        // picked and the one you did not get a turn.
        home_score: g.home_score + 3 * Math.ceil((bump + (i % 2)) / 2),
        away_score: g.away_score + 7 * Math.floor((bump + (i % 2)) / 2),
      }))
    : GAMES;
  const sport = sportOf(LEAGUE.sport);
  const slate = { season: 2026, key: '2026-2-00', label: 'Demo Week' };
  const me = 'u-colin';
  const myEntry = ENTRIES.find((e) => e.user_id === me);
  const picks = visiblePicks(me, NOW);
  const myPicks = Object.fromEntries(picks.filter((p) => p.entry_id === myEntry.id).map((p) => [p.game_id, p.picked]));

  async function noop() { 'use server'; }

  return (
    <LeagueShell league={LEAGUE} sport={sport} slate={slate} profile={NAMES.get(me)} isCommish base="/dev" signOutAction={noop}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="pill pill-warn">Preview · fixture data · clock frozen at Sun 4:40 PM ET</span>
        <Link href="/dev" className="underline">picks</Link>
        <Link href="/dev?view=board" className="underline">board</Link>
        <Link href="/dev?view=admin" className="underline">admin</Link>
        <Link href="/dev?view=epl" className="underline">premier league</Link>
        <Link href="/dev?view=featured" className="underline">featured</Link>
        <Link href="/dev?view=cfb" className="underline">college picks</Link>
        {['picks', 'board'].includes(view) && <DevBump />}
      </div>
      {view === 'cfb' ? (
        <>
          <div className="mb-5">
            <p className="eyebrow">College Football · 6 in this week · 15 of {CFB_BOARD.length} games featured</p>
            <h1 className="h1 mt-1">Week 3 picks</h1>
          </div>
          <PicksForm leagueId={LEAGUE.id} season={2026} slate="2026-2-03"
            games={featuredGames(CFB_BOARD, { n: SPORTS.cfb.featured, ...SPORTS.cfb.conferences })}
            initialPicks={{ c01: 'HOME', c02: 'AWAY', c03: 'HOME', c07: 'AWAY', c11: 'HOME' }} initialTiebreaker={52} entry={myEntry}
            unit="points" fixedNow={CFB_NOW} />
        </>
      ) : view === 'featured' ? (
        <AdminView
          user={{ id: me }} league={{ ...LEAGUE, name: 'NCAA Football Picks', sport: 'cfb' }} sport={SPORTS.cfb} names={NAMES}
          inviteUrl="https://picks.example.com/join/cfbcfb11"
          members={PLAYERS.map((p) => ({ user_id: p.id, profiles: p }))}
          now={{ season: 2026, key: '2026-2-03', label: 'Week 3' }} feeRows={[]} owed={[]} paidOut={[]} clock={CFB_NOW}
          slate={{ season: 2026, key: '2026-2-03', curated: true, board: CFB_BOARD,
            games: featuredGames(CFB_BOARD, { n: SPORTS.cfb.featured, ...SPORTS.cfb.conferences }) }}
        />
      ) : view === 'epl' ? (
        <>
          <div className="mb-5">
            <p className="eyebrow">Premier League · draws are pickable</p>
            <h1 className="h1 mt-1">Sep 12 to 14 picks</h1>
          </div>
          <PicksForm leagueId={LEAGUE.id} season={2026} slate="2026-09-12" games={EPL_GAMES} initialPicks={EPL_PICKS}
            initialTiebreaker={3} entry={myEntry} unit="goals" draws homeFirst fixedNow={EPL_NOW} />
        </>
      ) : view === 'admin' ? (
        <AdminView
          user={{ id: me }} league={LEAGUE} sport={sport} names={NAMES} inviteUrl="https://picks.example.com/join/a1b2c3d4"
          members={PLAYERS.map((p) => ({ user_id: p.id, profiles: p }))}
          now={slate} feeRows={ENTRIES}
          owed={[{ key: '2026-2-00', label: 'Preseason 4', pot: 2500, share: 1250, winners: [{ user_id: 'u-sam', name: 'Sam', venmo: '@sam-p' }, { user_id: 'u-brian', name: 'Brian', venmo: '' }] }]}
          paidOut={[{ id: 'p1', user_id: 'u-kevin', amount_cents: 2000, slate_key: '2026-2-00' }]}
        />
      ) : view === 'board' ? (
        <BoardView
          league={LEAGUE} sport={sport} label={slate.label} isCurrent slates={[{ key: '2026-2-01', label: 'Week 1' }, { key: slate.key, label: 'Demo Week' }]}
          slateKey={slate.key} games={games} entries={ENTRIES} picks={picks} names={NAMES} me={me} now={NOW}
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">{sport.name} · {ENTRIES.length} in this week</p>
              <h1 className="h1 mt-1">{slate.label} picks</h1>
            </div>
            <span className="pill pill-good">Entry paid</span>
          </div>
          <PicksForm leagueId={LEAGUE.id} season={2026} slate={slate.key} games={games} initialPicks={myPicks}
            initialTiebreaker={myEntry.tiebreaker} entry={myEntry} unit={sport.unit} fixedNow={NOW} />
        </>
      )}
    </LeagueShell>
  );
}
