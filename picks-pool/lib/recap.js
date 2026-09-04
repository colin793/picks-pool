import { admin } from './supabase';
import { slateResults, potFor, money } from './stats';
import { sport as sportOf } from './scores/sports';
import { sendEach } from './email/send';

// Results recap: congratulate the winner, show the pot, lightly roast the
// worst picker. Same text to everyone in the league: the shared roast is the
// point. Sent once per slate, the morning after it completes.
export async function sendRecaps() {
  const db = admin();
  const { data: leagues } = await db.from('leagues').select('*').eq('recap_enabled', true);
  let sent = 0;
  const done = [];
  for (const league of leagues ?? []) {
    try {
      const { data: state } = await db.from('sport_state').select('*').eq('sport', league.sport).maybeSingle();
      if (!state?.season) continue;
      const { data: games } = await db.from('games').select('*').eq('sport', league.sport).eq('season', state.season);
      const key = justEndedSlate(games ?? []);
      if (!key) continue;
      const n = await recapLeague(db, league, state.season, key, games.filter((g) => g.slate_key === key));
      if (n) { sent += n; done.push(`${league.name}: ${key}`); }
    } catch (e) {
      console.error(`recap failed for league ${league.id}:`, e?.message);
    }
  }
  return { sent, leagues: done };
}

// The slate whose final kickoff happened in the last 40 hours and is fully final.
export function justEndedSlate(games) {
  const now = Date.now();
  const keys = [...new Set(games.map((g) => g.slate_key))];
  for (const key of keys) {
    const sg = games.filter((g) => g.slate_key === key);
    const last = Math.max(...sg.map((g) => new Date(g.kickoff).getTime()));
    if (last <= now && now - last < 40 * 3600_000 && sg.every((g) => g.state === 'post')) return key;
  }
  return null;
}

async function recapLeague(db, league, season, key, games) {
  const { data: entries } = await db
    .from('entries').select('*')
    .eq('league_id', league.id).eq('season', season).eq('slate_key', key);
  if (!entries?.length) return 0;

  const entryIds = entries.map((e) => e.id);
  const { data: picks } = await db.from('picks').select('*').in('entry_id', entryIds);
  const { data: members } = await db
    .from('memberships').select('user_id, profiles(display_name, email)')
    .eq('league_id', league.id);
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? 'Player']));
  const emails = (members ?? []).map((m) => m.profiles?.email).filter(Boolean);
  if (!emails.length) return 0;

  const label = games[0]?.slate_label ?? key;
  const unit = sportOf(league.sport).unit;
  const { rows, winners, actualTotal, lastGame } = slateResults(games, entries, picks ?? []);
  const { pot, share } = potFor(entries, league.entry_fee_cents, winners);
  const winnerNames = winners.map((w) => names.get(w.user_id)).join(' and ');

  const bottomRank = Math.max(...rows.map((r) => r.rank));
  const worst = rows.find((r) => r.rank === bottomRank);
  const worstName = names.get(worst.user_id);
  const worstMisses = (picks ?? [])
    .filter((p) => p.entry_id === worst.id)
    .map((p) => {
      const g = games.find((x) => x.id === p.game_id);
      if (!g || g.state !== 'post' || g.winner === p.picked || g.winner === 'TIE') return null;
      const margin = Math.abs(g.home_score - g.away_score);
      const picked = p.picked === 'HOME' ? g.home_abbr : g.away_abbr;
      const over = p.picked === 'HOME' ? g.away_abbr : g.home_abbr;
      return { margin, text: `picked ${picked} over ${over} (${picked} lost by ${margin})` };
    })
    .filter(Boolean)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 2)
    .map((m) => m.text);

  const facts = [
    `League: ${league.name}. ${label} results.`,
    `Winner${winners.length > 1 ? 's (split pot)' : ''}: ${winnerNames}, ${winners[0].correct} correct, wins ${money(share)}${winners.length > 1 ? ' each' : ''}.`,
    `Pot: ${money(pot)} (${entries.length} entries at ${money(league.entry_fee_cents)}).`,
    lastGame ? `Tiebreaker game ${lastGame.away_abbr} @ ${lastGame.home_abbr} totaled ${actualTotal} ${unit}.` : '',
    `Full standings: ${rows.map((r) => `${names.get(r.user_id)} ${r.correct}-${r.incorrect}`).join(', ')}.`,
    `Worst picker: ${worstName} at ${worst.correct}-${worst.incorrect}.`,
    worstMisses.length ? `${worstName}'s ugliest calls: ${worstMisses.join('; ')}.` : '',
  ].filter(Boolean).join('\n');

  const fallback = `${label} is in the books.\n\n${facts}\n\nSee the full board in the app.`;
  const body = (await aiRecap(facts)) ?? fallback;

  return await sendEach(emails, `${league.name}: ${label} results`, body);
}

async function aiRecap(facts) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
        max_tokens: 600,
        system:
          'You write a short results recap email for a friendly sports pick-em pool. ' +
          'Plain text only, no markdown, no subject line, no emoji. 120-180 words. ' +
          'Congratulate the winner by name and state what they won. ' +
          'One light jab at the worst picker: roast the picks, never the person, ' +
          'and only use the facts provided. Everything must come from the facts; invent nothing. ' +
          'No em dashes. Sign off as "The Commissioner\'s Robot."',
        messages: [{ role: 'user', content: facts }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.find((c) => c.type === 'text')?.text?.trim();
    return text || null;
  } catch {
    return null; // fallback template goes out instead
  }
}
