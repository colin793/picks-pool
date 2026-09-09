import { notFound } from 'next/navigation';
import Link from 'next/link';
import LeagueShell from '../components/LeagueShell';
import PicksForm from '../components/PicksForm';
import BoardView from '../components/BoardView';
import AdminView from '../components/AdminView';
import DevBump from '../components/DevBump';
import PushToggle from '../components/PushToggle';
import ChatView from '../components/ChatView';
import SurvivorView from '../components/SurvivorView';
import Tour from '../components/Tour';
import DraftView from '../components/DraftView';
import { snakeDraft, slateTeams } from '../../lib/draft';
import { playerSteps, commishChecklist } from '../../lib/tour';
import { sport as sportOf } from '../../lib/scores/sports';
import { LEAGUE, GAMES, ENTRIES, NAMES, PLAYERS, NOW, at, visiblePicks, EPL_GAMES, EPL_PICKS, EPL_NOW, CFB_BOARD, CFB_NOW, SURVIVOR_PREV, SURVIVOR_ENTRIES, visibleSurvivorPicks } from '../../lib/fixtures';
import { featuredGames } from '../../lib/featured';
import { survivorStandings } from '../../lib/survivor';
import { roomTake, takeText } from '../../lib/room';
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
    <LeagueShell league={{ ...LEAGUE, survivor: true, survivor_fee_cents: 2000 }} sport={sport} slate={slate} profile={NAMES.get(me)} isCommish base="/dev" signOutAction={noop} demo live
      rail={[
        { id: LEAGUE.id, name: LEAGUE.name, sport: 'nfl', logo_url: '', color1: LEAGUE.color1, line: 'Demo Week · 5-4 · 3rd', live: true },
        { id: 'league-cfb', name: 'NCAA Football Picks', sport: 'cfb', logo_url: '', color1: '#b91c1c', line: 'Wk 3 · 9 picked', live: false },
        { id: 'league-epl', name: 'Footy Friends', sport: 'epl', logo_url: '', color1: '#7c3aed', line: 'Sep 12 to 14 · not in yet', live: false },
      ]}
      chat={{ initial: { me, isCommish: true, names: Object.fromEntries(PLAYERS.map((p) => [p.id, p])), messages: [
        { id: 'm1', user_id: 'u-kevin', body: 'who took the Jets lol', created_at: new Date(NOW - 3600_000).toISOString() },
        { id: 'm2', user_id: 'u-colin', body: 'me. and I would do it again', created_at: new Date(NOW - 3500_000).toISOString() },
        { id: 'm3', user_id: 'u-sam', body: 'GB in the red zone, Colin is sweating', created_at: new Date(NOW - 120_000).toISOString() },
      ], calls: [{ id: 'c1', user_id: 'u-kevin', created_at: new Date(NOW - 7 * 3600_000).toISOString(), body: 'Bills by a touchdown, book it', text: 'BUF by 7', grade: 'miss', matchup: 'KC @ BUF' }] } }}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="pill pill-warn">Preview · fixture data · clock frozen at Sun 4:40 PM ET</span>
        <Link href="/dev" className="underline">picks</Link>
        <Link href="/dev?view=board" className="underline">board</Link>
        <Link href="/dev?view=admin" className="underline">admin</Link>
        <Link href="/dev?view=epl" className="underline">premier league</Link>
        <Link href="/dev?view=featured" className="underline">featured</Link>
        <Link href="/dev?view=cfb" className="underline">college picks</Link>
        <Link href="/dev?view=notify" className="underline">notifications</Link>
        <Link href="/dev?view=spread" className="underline">spread</Link>
        <Link href="/dev?view=chat" className="underline">chat</Link>
        <Link href="/dev?view=survivor" className="underline">survivor</Link>
        <Link href="/dev?view=moments" className="underline">moments</Link>
        <Link href="/dev?view=moments&won=1" className="underline">won</Link>
        <Link href="/dev?view=modes" className="underline">modes</Link>
        <Link href="/dev?view=tour" className="underline">tour</Link>
        <Link href="/dev?view=draft" className="underline">draft</Link>
        <Link href="/dev?view=draft&ran=1" className="underline">drafted</Link>
        {['picks', 'board'].includes(view) && <DevBump />}
      </div>
      {view === 'draft' ? (
        // The Draft tab: ranking the teams before the first kickoff, or what the draft dealt (?ran=1).
        (() => {
          const ran = Boolean(searchParams?.ran);
          const dl = { ...LEAGUE, draft: true };
          if (!ran) {
            const pre = games.filter((g) => g.state === 'pre');
            return <DraftView league={dl} sport={sport} slate={slate} games={pre} names={NAMES} ran={null} picks={[]} mine={{ ranking: ['o1:HOME', 'o3:HOME'] }} entered={4} me={me} now={NOW} demo />;
          }
          const d = snakeDraft(PLAYERS.map((p) => p.id), new Map([[me, ['f3:AWAY', 'l1:AWAY']]]), slateTeams(games), 'demo');
          const picks = d.picks.map((p) => { const [game_id, side] = p.team.split(':'); return { user_id: p.user_id, game_id, side, round: p.round, pick_no: p.pick_no }; });
          return <DraftView league={dl} sport={sport} slate={slate} games={games} names={NAMES} ran={{ ran_at: at(-60) }} picks={picks} mine={null} entered={6} me={me} now={NOW} demo />;
        })()
      ) : view === 'tour' ? (
        // The first-time walkthrough over the picks page, and the commissioner's checklist.
        <>
          <AdminView user={{ id: me }} league={{ ...LEAGUE, survivor: false, lock_of_week: false, duels: false, duty: '', calls: true, venmo_handle: '' }} sport={sport} names={NAMES}
            inviteUrl="https://picks.example.com/join/a1b2c3d4" members={[{ user_id: me, profiles: PLAYERS[0] }]} now={slate} feeRows={[]} owed={[]} paidOut={[]} demo
            checklist={commishChecklist({ ...LEAGUE, venmo_handle: '' }, { members: 1, pushConfigured: false })} />
          <Tour demo steps={playerSteps({ ...LEAGUE, survivor: true, lock_of_week: true, duels: true, duty: 'Last place at the end of the month buys the wings' }, sport, { fee: '$5.00' })} />
        </>
      ) : view === 'modes' ? (
        // The board with the room modes on: a points column with locks, the duels card, the loser's duty.
        <BoardView league={{ ...LEAGUE, lock_of_week: true, duels: true, duty: 'Last place at the end of the month buys the wings' }} sport={sport} label={slate.label} isCurrent
          slates={[{ key: slate.key, label: 'Demo Week' }, { key: '2026-1-99', label: 'Last week' }]} slateKey={slate.key} games={games}
          entries={ENTRIES.map((e) => ({ ...e, lock_game_id: { 'u-colin': 'f2', 'u-kevin': 'f3', 'u-sam': 'l1', 'u-jess': 'f1' }[e.user_id] ?? null }))}
          picks={picks} names={NAMES} me={me} now={NOW} shareUrl="/dev/share" demo />
      ) : view === 'moments' ? (
        // The board with everything but Monday night final and the top tied: the finale line,
        // the rivalry line, an upset chip. ?won=1 finishes Monday night with Colin winning: confetti.
        (() => {
          const won = Boolean(searchParams?.won);
          const mg = GAMES.map((g) => {
            if (g.id === 'l1') return { ...g, state: 'post', status_detail: 'Final', home_score: 14, away_score: 27, winner: 'AWAY', home_spread: -3.5 }; // CHI favored by 3.5, GB won: an upset
            if (g.id === 'l2') return { ...g, state: 'post', status_detail: 'Final', home_score: 24, away_score: 21, winner: 'HOME' };
            if (g.id === 'l3') return { ...g, state: 'post', status_detail: 'Final', home_score: 20, away_score: 23, winner: 'AWAY' };
            if (g.id === 'l4') return { ...g, state: 'post', status_detail: 'Final', home_score: 31, away_score: 13, winner: 'HOME' };
            if (g.id === 'o1') return { ...g, state: 'post', status_detail: 'Final', home_score: 27, away_score: 20, winner: 'HOME' };
            if (g.id === 'o2') return { ...g, state: 'post', status_detail: 'Final', home_score: 17, away_score: 24, winner: 'AWAY' };
            if (g.id === 'o3') return won ? { ...g, state: 'post', status_detail: 'Final', home_score: 24, away_score: 20, winner: 'HOME' } : { ...g, state: 'in', status_detail: 'Q3 8:14', home_score: 17, away_score: 13 };
            return g;
          });
          const mnow = Date.parse('2026-09-15T02:00:00Z');
          // Sam flips to TB on Sunday night, so Colin and Sam sit tied at 9 with the finale to play: the finale line.
          const mpicks = visiblePicks(me, mnow).map((p) => (p.entry_id === 'e-u-sam' && p.game_id === 'o2' ? { ...p, picked: 'AWAY' } : p));
          const mentries = ENTRIES.map((e) => (e.user_id === 'u-jess' ? { ...e, tiebreaker: 51 } : e)); // Colin 44 vs Jess 51, revealed at kickoff
          return (
            <BoardView league={LEAGUE} sport={sport} label={slate.label} isCurrent slates={[{ key: slate.key, label: 'Demo Week' }]}
              slateKey={slate.key} games={mg} entries={mentries} picks={mpicks} names={NAMES} me={me} now={mnow} shareUrl="/dev/share" />
          );
        })()
      ) : view === 'survivor' ? (
        // ?as=u-jess views the pool as another player (her pick is Monday night, still open).
        <SurvivorView league={{ ...LEAGUE, survivor: true, survivor_fee_cents: 2000 }} sport={sport} slate={slate} me={NAMES.has(searchParams?.as) ? searchParams.as : me} now={NOW} fixedNow={NOW} demo base="/dev"
          games={[...SURVIVOR_PREV, ...games]} entries={SURVIVOR_ENTRIES} picks={visibleSurvivorPicks(NAMES.has(searchParams?.as) ? searchParams.as : me, NOW)} names={NAMES} />
      ) : view === 'chat' ? (
        <ChatView leagueId={LEAGUE.id} me={me} isCommish names={NAMES} demo callsOn games={games} now={NOW} calls={[
          { id: 'c1', user_id: 'u-kevin', game_id: 'f3', side: 'HOME', margin: 7, body: 'Bills by a touchdown, book it', created_at: new Date(NOW - 7 * 3600_000).toISOString() },
          { id: 'c2', user_id: 'u-jess', game_id: 'f1', side: 'HOME', margin: null, body: '', created_at: new Date(NOW - 80 * 3600_000).toISOString() },
          { id: 'c3', user_id: 'u-colin', game_id: 'o3', side: 'AWAY', margin: 3, body: 'Jets on the road, yes really', created_at: new Date(NOW - 600_000).toISOString() },
        ]} messages={[
          { id: 'm1', user_id: 'u-kevin', body: 'who took the Jets lol', created_at: new Date(NOW - 3600_000).toISOString() },
          { id: 'm2', user_id: 'u-colin', body: 'me. and I would do it again', created_at: new Date(NOW - 3500_000).toISOString() },
          { id: 'm3', user_id: 'u-sam', body: 'GB in the red zone, Colin is sweating', created_at: new Date(NOW - 120_000).toISOString() },
        ]} />
      ) : view === 'spread' ? (
        <>
          <div className="mb-5">
            <p className="eyebrow">NFL · against the spread</p>
            <h1 className="h1 mt-1">Demo Week picks</h1>
          </div>
          <PicksForm leagueId={LEAGUE.id} season={2026} slate={slate.key} games={games} initialPicks={myPicks}
            initialTiebreaker={myEntry.tiebreaker} entry={myEntry} unit={sport.unit} fixedNow={NOW}
            allPicks={picks} entryCount={ENTRIES.length} scoring="spread" />
        </>
      ) : view === 'notify' ? (
        <section className="card max-w-lg">
          <h2 className="h2 mb-1">Notifications</h2>
          <p className="mb-3 text-xs text-muted">The Settings switch, wired to this browser only (no server in the preview).</p>
          <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BDemoKeyOnlyForThePreview_________________________________________________________'} demo />
        </section>
      ) : view === 'cfb' ? (
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
          user={{ id: me }} league={{ ...LEAGUE, survivor: true, survivor_fee_cents: 2000 }} sport={sport} names={NAMES} inviteUrl="https://picks.example.com/join/a1b2c3d4"
          members={PLAYERS.map((p) => ({ user_id: p.id, profiles: p }))}
          now={slate} feeRows={ENTRIES}
          owed={[{ key: '2026-2-00', label: 'Preseason 4', pot: 2500, share: 1250, winners: [{ user_id: 'u-sam', name: 'Sam', venmo: '@sam-p' }, { user_id: 'u-brian', name: 'Brian', venmo: '' }] }]}
          paidOut={[{ id: 'p1', user_id: 'u-kevin', amount_cents: 2000, slate_key: '2026-2-00' }]}
          survivor={{ season: 2026, pot: 12000, share: 12000, complete: false, paid: false, winners: [],
            rows: survivorStandings([...SURVIVOR_PREV, ...games], SURVIVOR_ENTRIES, visibleSurvivorPicks(me, NOW), { now: NOW }).rows }}
        />
      ) : view === 'board' ? (
        <BoardView
          league={LEAGUE} sport={sport} label={slate.label} isCurrent slates={[{ key: '2026-2-01', label: 'Week 1' }, { key: slate.key, label: 'Demo Week' }]}
          slateKey={slate.key} games={games} entries={ENTRIES} picks={picks} names={NAMES} me={me} now={NOW}
          shareUrl="/dev/share" demo
          reactions={[
            { entry_id: 'e-u-kevin', game_id: 'f3', user_id: 'u-colin', emoji: '💀' }, { entry_id: 'e-u-kevin', game_id: 'f3', user_id: 'u-sam', emoji: '🤡' },
            { entry_id: 'e-u-colin', game_id: 'f2', user_id: 'u-kevin', emoji: '🔥' }, { entry_id: 'e-u-brian', game_id: 'f1', user_id: 'u-jess', emoji: '👏' },
          ]}
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
            initialTiebreaker={myEntry.tiebreaker} entry={{ ...myEntry, lock_game_id: 'o1' }} unit={sport.unit} fixedNow={NOW}
            allPicks={picks} entryCount={ENTRIES.length} demo lockMode
            takes={(() => { const t = roomTake([...SURVIVOR_PREV, ...games], ENTRIES, picks, me); const o = {};
              for (const g of games) for (const a of [g.home_abbr, g.away_abbr]) o[a] = takeText(a, t.get(a), { me, names: NAMES }); return o; })()} />
        </>
      )}
    </LeagueShell>
  );
}
