// The little pops: countdowns, upsets, rivalry lines, the finale, the sweat
// strip, the week wrap. All pure, all words and flags; the components only
// place them. lib/moments.test.mjs is the self-check.
import { favored } from './line.js';
import { slateResults, money, ahead } from './stats.js';

// The next open kickoff, as a countdown. tone: 'calm' | 'warn' | 'urgent'.
// Null when nothing is still open, or when the next lock is a day or more away.
export function countdown(games, now = Date.now()) {
  const next = games
    .map((g) => new Date(g.kickoff).getTime())
    .filter((t) => t > now)
    .sort((a, b) => a - b)[0];
  if (next == null) return null;
  const ms = next - now;
  if (ms >= 24 * 3600_000) return null;
  const min = Math.max(1, Math.ceil(ms / 60_000));
  const text = min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
  return { ms, text: `Next lock in ${text}`, tone: min <= 10 ? 'urgent' : min < 60 ? 'warn' : 'calm' };
}

// A final where the dog by the frozen line won outright by a real line (3+).
export function isUpset(g) {
  if (g.state !== 'post' || !g.winner || g.winner === 'TIE') return false;
  const fav = favored(g);
  return Boolean(fav) && fav !== g.winner && Math.abs(Number(g.home_spread)) >= 3;
}

// "1 behind Kevin", "Tied with Kevin at 9", "Kevin is 1 behind you", "You lead by 2".
// rows: slateResults() rows (ranked, sorted). '' when you are not in, or alone.
export function rivalryText(rows, me, names) {
  const i = rows.findIndex((r) => r.user_id === me);
  if (i < 0 || rows.length < 2) return '';
  const nameOf = (r) => names.get(r.user_id)?.display_name ?? 'Player';
  const pts = (r) => r.points ?? r.correct; // points carry the lock of the week when the league plays it
  const mine = rows[i];
  const above = [...rows.slice(0, i)].reverse().find((r) => pts(r) > pts(mine));
  const peer = rows.find((r) => r.user_id !== me && pts(r) === pts(mine));
  if (above) return `${pts(above) - pts(mine)} behind ${nameOf(above)}`;
  if (peer) return `Tied with ${nameOf(peer)} at ${pts(mine)}`;
  const below = rows.slice(i + 1).find((r) => pts(r) < pts(mine));
  if (!below) return '';
  return mine.rank === 1 ? `You lead by ${pts(mine) - pts(below)}; ${nameOf(below)} is next` : `${nameOf(below)} is ${pts(mine) - pts(below)} behind you`;
}

// The finale. When every other game is final and the top is shared, the last
// game decides: by the picks if the leaders split on it, by the tiebreaker if
// they did not. Other players' tiebreakers are null until the finale kicks
// off (the board view hides them), and the text says so.
export function finaleText(games, entries, picks, names, { scoring = 'straight', homeFirst = false, me = null, lock = false } = {}) {
  const r = slateResults(games, entries, picks, { scoring, lock });
  if (!r.lastGame || r.complete || !r.rows.length) return null;
  const last = r.lastGame;
  const others = games.filter((g) => g.id !== last.id);
  if (!others.every((g) => g.state === 'post')) return null;
  // You first, then the others in standings order.
  const top = r.rows.filter((x) => x.rank === 1).sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0));
  if (top.length < 2) return null;
  const nameOf = (x) => (x.user_id === me ? 'You' : names.get(x.user_id)?.display_name ?? 'Player');
  const matchup = homeFirst ? `${last.home_abbr} v ${last.away_abbr}` : `${last.away_abbr} @ ${last.home_abbr}`;
  const side = (s) => (s === 'HOME' ? last.home_abbr : s === 'AWAY' ? last.away_abbr : 'the draw');
  const byPick = new Map(top.map((x) => [x.user_id, picks.find((p) => p.entry_id === x.id && p.game_id === last.id)?.picked ?? null]));
  const sides = new Set(byPick.values());
  const live = last.state === 'in';
  const total = last.home_score + last.away_score;
  if (sides.size > 1) {
    const list = top.map((x) => `${nameOf(x)} ${byPick.get(x.user_id) ? `${nameOf(x) === 'You' ? 'have' : 'has'} ${side(byPick.get(x.user_id))}` : 'sat it out'}`).join(', ');
    const leading = live ? ahead(last, scoring) : '';
    return { kind: 'picks', title: `${matchup} decides it`, text: `${list}.${live && leading && leading !== 'TIE' ? ` ${side(leading)} up right now.` : ''}` };
  }
  const tb = top.map((x) => `${nameOf(x)} ${x.tiebreaker == null ? '?' : x.tiebreaker}`).join(' vs ');
  const hidden = top.some((x) => x.tiebreaker == null) && last.state === 'pre';
  const vegas = last.over_under != null ? ` Vegas says ${last.over_under}.` : '';
  return {
    kind: 'tiebreaker',
    title: `Comes down to the tiebreaker in ${matchup}`,
    text: hidden ? `Tiebreakers reveal at kickoff.${vegas}` : `${tb}.${live ? ` Running total ${total}.` : vegas}`,
  };
}

// "Your season: GB up 3, Q2 1:52" while your survivor team plays. tone 'up' | 'down' | 'level'.
export function sweatText(cell) {
  if (!cell?.game || cell.result !== 'live') return null;
  const g = cell.game;
  const diff = (cell.pick.picked === 'HOME' ? 1 : -1) * (g.home_score - g.away_score);
  const clock = g.status_detail ? `, ${g.status_detail}` : '';
  if (diff > 0) return { tone: 'up', text: `Your season: ${cell.team} up ${diff}${clock}` };
  if (diff < 0) return { tone: 'down', text: `Your season: ${cell.team} down ${-diff}${clock}` };
  return { tone: 'level', text: `Your season: ${cell.team} level${clock}` };
}

// "Week 2 is in the books: Kevin won $30, you finished 3rd at 9-5."
export function wrapText(results, me, names, feeCents, label) {
  if (!results.complete || !results.rows.length) return '';
  const nameOf = (id) => names.get(id)?.display_name ?? 'Player';
  const pot = results.rows.length * feeCents;
  const share = results.winners.length ? Math.floor(pot / results.winners.length) : 0;
  const w = results.winners;
  const won = w.some((x) => x.user_id === me);
  const winners = won && w.length === 1 ? 'you won' : `${w.map((x) => (x.user_id === me ? 'you' : nameOf(x.user_id))).join(' and ')} ${w.length > 1 ? 'split' : 'won'}`;
  const mine = results.rows.find((r) => r.user_id === me);
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
  const you = mine && !won ? `, you finished ${ord(mine.rank)} at ${mine.correct}-${mine.incorrect}` : mine ? ` at ${mine.correct}-${mine.incorrect}` : '';
  return `${label} is in the books: ${winners}${pot ? ` ${money(share)}` : ''}${you}.`;
}

// Boot of the Week: whoever finished last in the slate that just ended, ties
// and all. Only from a complete slate with at least three rows, so a two-
// person week does not boot the runner-up. Returns user ids.
export function bootOf(results) {
  if (!results?.complete || (results.rows?.length ?? 0) < 3) return [];
  const worst = Math.max(...results.rows.map((r) => r.rank));
  return results.rows.filter((r) => r.rank === worst).map((r) => r.user_id);
}
