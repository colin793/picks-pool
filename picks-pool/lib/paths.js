// "What needs to happen": the board's projections. Pure, so lib/paths.test.mjs
// can check it.
//
// Everything here runs over games that have kicked off but are not final,
// because those are the games where everyone's picks are visible. Games that
// have not started are left out and reported as `pending`: other players'
// picks on them are hidden until kickoff, and guessing would leak them.
import { slateResults } from './stats.js';

const MAX_LIVE = 10; // 2^10 outcomes is plenty; beyond that the panel says so

function leadersOf(games, entries, picks, scoring) {
  const { rows } = slateResults(games, entries, picks, { scoring });
  // Nobody "leads" on zero correct; that is just everyone tied at the start.
  const top = rows[0]?.correct > 0 ? rows.filter((r) => r.rank === 1) : [];
  const second = rows.find((r) => r.rank !== 1);
  return {
    ids: top.map((r) => r.user_id),
    margin: top.length && second ? top[0].correct - second.correct : 0,
    correct: top[0]?.correct ?? 0,
  };
}

// Decide a live game one way; leave the other live games out of the count.
function decided(games, liveIds, choice) {
  return games.map((g) => {
    if (!liveIds.has(g.id)) return g;
    const w = choice.get(g.id);
    // A projected result is "this side gets it", on whatever terms the league
    // scores by, so the line is cleared: outcome() then reads the winner.
    return w ? { ...g, state: 'post', winner: w, home_spread: null } : { ...g, state: 'pre', winner: null };
  });
}

export function projections(games, entries, picks, { me = null, draws = false, scoring = 'straight' } = {}) {
  const live = games.filter((g) => g.state === 'in');
  const pending = games.filter((g) => g.state === 'pre').length;
  const liveIds = new Set(live.map((g) => g.id));
  const sides = draws ? ['HOME', 'AWAY', 'TIE'] : ['HOME', 'AWAY'];

  // 1. One game at a time: who leads if it goes each way, other live games undecided.
  const perGame = live.map((g) => ({
    game: g,
    branches: sides.map((side) => ({ side, ...leadersOf(decided(games, liveIds, new Map([[g.id, side]])), entries, picks, scoring) })),
  }));

  // 2. Every combination of the live games: who is still alive, and what each
  //    player needs. Capped, and skipped when there is nothing live.
  const tooMany = live.length > MAX_LIVE || (draws && live.length > 6);
  const alive = [];
  let total = 0;
  if (live.length && !tooMany) {
    const outcomes = [];
    const walk = (i, choice) => {
      if (i === live.length) { outcomes.push(new Map(choice)); return; }
      for (const s of sides) { choice.set(live[i].id, s); walk(i + 1, choice); }
    };
    walk(0, new Map());
    total = outcomes.length;
    const wins = new Map(); // user_id -> { outcomes, sole, needs: Map(gameId -> side|null) }
    for (const e of entries) wins.set(e.user_id, { outcomes: 0, sole: 0, needs: new Map() });
    for (const o of outcomes) {
      const { ids } = leadersOf(decided(games, liveIds, o), entries, picks, scoring);
      for (const id of ids) {
        const w = wins.get(id);
        if (!w) continue;
        w.outcomes += 1;
        if (ids.length === 1) w.sole += 1;
        for (const g of live) {
          const side = o.get(g.id);
          if (!w.needs.has(g.id)) w.needs.set(g.id, side);
          else if (w.needs.get(g.id) !== side) w.needs.set(g.id, null); // either way works
        }
      }
    }
    for (const [user_id, w] of wins) {
      const needs = w.outcomes
        ? live.filter((g) => w.needs.get(g.id)).map((g) => ({ game: g, side: w.needs.get(g.id) }))
        : [];
      alive.push({ user_id, outcomes: w.outcomes, sole: w.sole, total, needs, sides: sides.length });
    }
    alive.sort((a, b) => b.outcomes - a.outcomes || b.sole - a.sole);
  }

  return { live: perGame, alive, total, pending, tooMany, mine: me ? alive.find((a) => a.user_id === me) ?? null : null };
}

// "You need GB and DEN", "You lead whatever happens", "Out of it today".
export function needsText(entry, { names = new Map(), me = null, homeFirst = false } = {}) {
  if (!entry) return '';
  const you = entry.user_id === me;
  const who = you ? 'You' : (names.get(entry.user_id)?.display_name ?? 'Player');
  const side = (n) => (n.side === 'HOME' ? n.game.home_abbr : n.side === 'AWAY' ? n.game.away_abbr : `a draw in ${homeFirst ? `${n.game.home_abbr} v ${n.game.away_abbr}` : `${n.game.away_abbr} @ ${n.game.home_abbr}`}`);
  if (entry.outcomes === 0) return `${who} ${you ? 'are' : 'is'} out of it today`;
  if (entry.outcomes === entry.total) return `${who} lead${you ? '' : 's'} whatever happens`;
  const list = entry.needs.map(side);
  const joined = list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
  if (!list.length) return `${who} ${you ? 'are' : 'is'} alive in ${entry.outcomes} of ${entry.total} outcomes`;
  // Are the must-haves enough on their own, or do they also need the other games to break right?
  const withNeeds = entry.total / Math.pow(entry.sides ?? 2, list.length);
  const enough = entry.outcomes >= withNeeds;
  return `${who} need${you ? '' : 's'} ${joined}${enough ? '' : ', plus some help'}`;
}
