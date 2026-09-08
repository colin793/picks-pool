// The room's take on a team: how your friends and you have treated it this
// season. Pure: season games, entries and picks in, one record per team out.
// lib/room.test.mjs is the self-check.
import { outcome } from './stats.js';

// picks: every pick the viewer may see (hidden ones are simply absent, and
// only games that have kicked off count here, so nothing leaks).
// Returns Map(team abbr -> take):
//   share:   fraction of the room's picks on this team's games that took it
//   games:   how many of its games the room has picked
//   room:    { won, lost } when backing it (finals only)
//   mine:    { won, lost } your record backing it
//   against: { won, lost } your record picking against it
//   rider:   { user_id, n } who has backed it most (3+ times), else null
export function roomTake(games, entries, picks, me) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const owner = new Map(entries.map((e) => [e.id, e.user_id]));
  const takes = new Map();
  const take = (abbr) => {
    if (!takes.has(abbr)) takes.set(abbr, { on: 0, of: 0, room: { won: 0, lost: 0 }, mine: { won: 0, lost: 0 }, against: { won: 0, lost: 0 }, riders: new Map() });
    return takes.get(abbr);
  };
  for (const p of picks) {
    const g = byId.get(p.game_id);
    if (!g || p.picked === 'TIE') continue;
    const uid = owner.get(p.entry_id);
    const picked = p.picked === 'HOME' ? g.home_abbr : g.away_abbr;
    const other = p.picked === 'HOME' ? g.away_abbr : g.home_abbr;
    const t = take(picked), o = take(other);
    t.on += 1; t.of += 1; o.of += 1;
    t.riders.set(uid, (t.riders.get(uid) ?? 0) + 1);
    const result = outcome(g);
    if (result && result !== 'TIE') {
      const hit = result === p.picked;
      t.room[hit ? 'won' : 'lost'] += 1;
      if (uid === me) { t.mine[hit ? 'won' : 'lost'] += 1; o.against[hit ? 'won' : 'lost'] += 1; }
    }
  }
  const out = new Map();
  for (const [abbr, t] of takes) {
    let rider = null;
    for (const [user_id, n] of t.riders) if (n >= 3 && (!rider || n > rider.n)) rider = { user_id, n };
    out.set(abbr, { share: t.of ? t.on / t.of : 0, games: t.of, room: t.room, mine: t.mine, against: t.against, rider });
  }
  return out;
}

// One or two short lines for the fold. names: user_id -> profile.
export function takeText(abbr, take, { me = null, names = new Map() } = {}) {
  if (!take || !take.games) return [];
  const lines = [];
  const pct = Math.round(take.share * 100);
  lines.push(`The room takes ${abbr} ${pct}% of the time${take.room.won + take.room.lost ? `, and is ${take.room.won}-${take.room.lost} when it does` : ''}.`);
  const mine = take.mine.won + take.mine.lost, against = take.against.won + take.against.lost;
  if (mine || against) {
    const parts = [];
    if (mine) parts.push(`${take.mine.won}-${take.mine.lost} backing ${abbr}`);
    if (against) parts.push(`${take.against.won}-${take.against.lost} against them`);
    lines.push(`You are ${parts.join(' and ')}.`);
  }
  if (take.rider && take.rider.user_id !== me) {
    lines.push(`${names.get(take.rider.user_id)?.display_name ?? 'Someone'} has ridden ${abbr} ${take.rider.n} times.`);
  }
  return lines;
}
