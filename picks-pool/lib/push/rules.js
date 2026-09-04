// What to say and to whom. Pure, so lib/push/rules.test.mjs can check it.
import { slateResults } from '../stats.js';

// Lock warning: the next featured kickoff is within `windowMs`, and these
// members have no entry yet. Returns { minutes, first } or null.
export function lockWindow(games, now = Date.now(), windowMs = 60 * 60_000) {
  const upcoming = games.filter((g) => new Date(g.kickoff).getTime() > now)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const first = upcoming[0];
  if (!first) return null;
  const until = new Date(first.kickoff).getTime() - now;
  if (until > windowMs) return null;
  return { minutes: Math.max(1, Math.round(until / 60_000)), first, open: upcoming.length };
}

export function lockMessage(league, slateLabel, { minutes, first, open }, leagueUrl) {
  return {
    title: `${league.name}: picks lock in ${minutes} min`,
    body: `${first.away_abbr} @ ${first.home_abbr} kicks off first. You haven't entered ${slateLabel} yet; ${open} game${open === 1 ? '' : 's'} still open.`,
    url: leagueUrl,
    tag: `lock-${league.id}-${slateLabel}`,
  };
}

// Who is on top right now, by correct picks (rank 1, ties included). A
// leader set only changes when a game goes final, so this never chatters
// with the live "leading" arrows.
export function leaders(games, entries, picks, scoring = 'straight') {
  const { rows, finals } = slateResults(games, entries, picks, { scoring });
  if (!finals || !rows.length || rows[0].correct === 0) return { key: '', ids: [], rows };
  const ids = rows.filter((r) => r.rank === 1).map((r) => r.user_id).sort();
  return { key: ids.join(','), ids, rows };
}

// One message per recipient: the new leader hears they lead, the displaced
// leaders hear who passed them, everyone else hears who took the lead.
export function leadMessages(league, slateLabel, previousIds, nextIds, names, recipients, leagueUrl) {
  const prev = new Set(previousIds);
  const nameOf = (id) => names.get(id)?.display_name ?? 'Someone';
  const newcomers = nextIds.filter((id) => !prev.has(id));
  const who = (newcomers.length ? newcomers : nextIds).map(nameOf);
  const list = who.length <= 2 ? who.join(' and ') : `${who.slice(0, -1).join(', ')} and ${who.at(-1)}`;
  const tied = nextIds.length > 1;
  const out = [];
  for (const uid of recipients) {
    let title, body;
    if (nextIds.includes(uid)) {
      title = tied ? `You're tied for the lead in ${league.name}` : `You're in the lead in ${league.name}`;
      body = tied ? `${list} ${who.length > 1 ? 'are' : 'is'} up there with you in ${slateLabel}.` : `${slateLabel}: nobody has more right than you.`;
    } else if (prev.has(uid)) {
      title = `${list} just passed you in ${league.name}`;
      body = `${slateLabel} standings moved. Open the board to see how much it hurts.`;
    } else {
      title = `${list} ${tied ? (who.length > 1 ? 'share' : 'shares') : 'took'} the lead in ${league.name}`;
      body = `${slateLabel} standings just changed.`;
    }
    out.push({ user_id: uid, payload: { title, body, url: `${leagueUrl}/board`, tag: `lead-${league.id}-${slateLabel}` } });
  }
  return out;
}
