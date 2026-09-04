import { admin, appUrl } from './supabase';
import { sport as sportOf } from './scores/sports';
import { easternDate } from './scores/espn';
import { fmtET } from './time';
import { sendEmail } from './email/send';
import { applyFeatured } from './featured';
import { featuredRows } from './league';

// Morning-of reminder to anyone in a week-mode league who has no entry on the
// current slate, when that slate has games kicking off today (ET) and at
// least two games still to play. NFL: Thursday and Sunday mornings.
export async function sendReminders() {
  const db = admin();
  const { data: leagues } = await db.from('leagues').select('*').eq('reminders_enabled', true);
  const today = easternDate(new Date().toISOString());
  const base = appUrl();
  let sent = 0;
  const done = [];

  for (const league of leagues ?? []) {
    try {
      const s = sportOf(league.sport);
      if (s.mode !== 'week') continue;
      const { data: state } = await db.from('sport_state').select('*').eq('sport', league.sport).maybeSingle();
      if (!state?.slate_key) continue;
      const { data: board } = await db
        .from('games').select('id, slate_key, kickoff, away_abbr, home_abbr')
        .eq('sport', league.sport).eq('season', state.season).eq('slate_key', state.slate_key).order('kickoff');
      const games = applyFeatured(board ?? [], await featuredRows(db, league, state.season));
      const upcoming = games.filter((g) => new Date(g.kickoff).getTime() > Date.now());
      if (upcoming.length < 2) continue;
      if (easternDate(upcoming[0].kickoff) !== today) continue;

      const [{ data: members }, { data: entries }] = await Promise.all([
        db.from('memberships').select('user_id, profiles(display_name, email)').eq('league_id', league.id),
        db.from('entries').select('user_id').eq('league_id', league.id).eq('season', state.season).eq('slate_key', state.slate_key),
      ]);
      const entered = new Set((entries ?? []).map((e) => e.user_id));
      const first = upcoming[0];
      const text =
        `${state.slate_label} picks for ${league.name} lock game by game, starting with ` +
        `${first.away_abbr} @ ${first.home_abbr} at ${fmtET(first.kickoff)}.\n\n` +
        `You haven't entered yet. ${upcoming.length} games are still open:\n${base}/l/${league.id}\n\n` +
        `Turn these reminders off in the league's Admin tab (commissioner) if they get old.`;
      for (const m of members ?? []) {
        if (entered.has(m.user_id) || !m.profiles?.email) continue;
        if (await sendEmail(m.profiles.email, `${league.name}: ${state.slate_label} picks lock today`, text)) sent += 1;
      }
      done.push(league.name);
    } catch (e) {
      console.error(`reminder failed for league ${league.id}:`, e?.message);
    }
  }
  return { sent, leagues: done };
}
