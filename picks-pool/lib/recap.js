import { admin } from './supabase';
import { weekResults, money } from './stats';

// Tuesday-morning recap: congratulate the winner, show the pot, lightly roast
// the worst picker. One email per league, same text to everyone: the shared
// roast is the point.
export async function sendRecaps() {
  const db = admin();
  const { data: meta } = await db.from('meta').select('*').eq('id', 1).single();
  if (!meta?.season) return { sent: 0, reason: 'no meta' };

  const { data: games } = await db.from('games').select('*').eq('season', meta.season);
  const week = justEndedWeek(games ?? []);
  if (!week) return { sent: 0, reason: 'no week just ended' };

  const { data: leagues } = await db.from('leagues').select('*').eq('recap_enabled', true);
  let sent = 0;
  for (const league of leagues ?? []) {
    try {
      if (await recapLeague(db, league, meta.season, week, games)) sent += 1;
    } catch (e) {
      console.error(`recap failed for league ${league.id}:`, e?.message);
    }
  }
  return { sent, week };
}

// The week whose final kickoff happened in the last 40 hours and is fully final.
function justEndedWeek(games) {
  const now = Date.now();
  const weeks = [...new Set(games.map((g) => g.week))];
  for (const week of weeks) {
    const wg = games.filter((g) => g.week === week);
    const last = Math.max(...wg.map((g) => new Date(g.kickoff).getTime()));
    if (last <= now && now - last < 40 * 3600_000 && wg.every((g) => g.state === 'post')) return week;
  }
  return null;
}

async function recapLeague(db, league, season, week, allGames) {
  const games = allGames.filter((g) => g.week === week);
  const { data: entries } = await db
    .from('entries').select('*')
    .eq('league_id', league.id).eq('season', season).eq('week', week);
  if (!entries?.length) return false;

  const entryIds = entries.map((e) => e.id);
  const { data: picks } = await db.from('picks').select('*').in('entry_id', entryIds);
  const { data: members } = await db
    .from('memberships').select('user_id, profiles(display_name, email)')
    .eq('league_id', league.id);
  const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? 'Player']));
  const emails = (members ?? []).map((m) => m.profiles?.email).filter(Boolean);
  if (!emails.length) return false;

  const { rows, winners, actualTotal, lastGame } = weekResults(games, entries, picks ?? []);
  const pot = entries.length * league.entry_fee_cents;
  const share = Math.floor(pot / Math.max(winners.length, 1));
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
    `League: ${league.name}. Week ${week} results.`,
    `Winner${winners.length > 1 ? 's (split pot)' : ''}: ${winnerNames}, ${winners[0].correct} correct, wins ${money(share)}${winners.length > 1 ? ' each' : ''}.`,
    `Pot: ${money(pot)} (${entries.length} entries at ${money(league.entry_fee_cents)}).`,
    lastGame ? `Tiebreaker game ${lastGame.away_abbr} @ ${lastGame.home_abbr} totaled ${actualTotal} points.` : '',
    `Full standings: ${rows.map((r) => `${names.get(r.user_id)} ${r.correct}-${r.incorrect}`).join(', ')}.`,
    `Worst picker: ${worstName} at ${worst.correct}-${worst.incorrect}.`,
    worstMisses.length ? `${worstName}'s ugliest calls: ${worstMisses.join('; ')}.` : '',
  ].filter(Boolean).join('\n');

  const fallback = `Week ${week} is in the books.\n\n${facts}\n\nSee the full board in the app.`;
  const body = (await aiRecap(facts)) ?? fallback;

  return await sendEmail(emails, `${league.name}: week ${week} results`, body);
}

async function aiRecap(facts) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
        max_tokens: 600,
        system:
          'You write a short weekly recap email for a friendly NFL pick-em pool. ' +
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

async function sendEmail(to, subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Picks Pool <onboarding@resend.dev>',
      to,
      subject,
      text,
    }),
  });
  return res.ok;
}
