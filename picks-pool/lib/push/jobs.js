// The two alerts, run for every league (or one sport's leagues) as often as
// anyone likes: push_sent remembers what already went out. Called after a
// real score sync and from /api/cron/push.
import { admin, appUrl } from '../supabase';
import { applyFeatured } from '../featured';
import { featuredRows } from '../league';
import { pushConfigured, pushTo, subscriptionsFor } from './send';
import { lockWindow, lockMessage, leaders, leadMessages } from './rules';

export async function runPushJobs(sportKey = null) {
  if (!pushConfigured()) return { skipped: 'no VAPID keys' };
  const db = admin();
  const { count } = await db.from('push_subscriptions').select('id', { count: 'exact', head: true });
  if (!count) return { skipped: 'nobody subscribed' };

  let q = db.from('leagues').select('*');
  if (sportKey) q = q.eq('sport', sportKey);
  const { data: leagues } = await q;
  const base = appUrl();
  const out = { lock: 0, lead: 0, leagues: 0 };

  for (const league of leagues ?? []) {
    try {
      const { data: state } = await db.from('sport_state').select('*').eq('sport', league.sport).maybeSingle();
      if (!state?.slate_key) continue;
      const [{ data: board }, rows, { data: members }, { data: entries }] = await Promise.all([
        db.from('games').select('*').eq('sport', league.sport).eq('season', state.season).eq('slate_key', state.slate_key),
        featuredRows(db, league, state.season),
        db.from('memberships').select('user_id, profiles(display_name)').eq('league_id', league.id),
        db.from('entries').select('*').eq('league_id', league.id).eq('season', state.season).eq('slate_key', state.slate_key),
      ]);
      const games = applyFeatured(board ?? [], rows);
      if (!games.length) continue;
      const memberIds = (members ?? []).map((m) => m.user_id);
      const names = new Map((members ?? []).map((m) => [m.user_id, m.profiles]));
      const subs = await subscriptionsFor(db, memberIds);
      if (!subs.size) continue;
      const leagueUrl = `${base}/l/${league.id}`;
      out.leagues += 1;

      // 1. Picks lock soon and you have not entered.
      const win = lockWindow(games);
      if (win) {
        const entered = new Set((entries ?? []).map((e) => e.user_id));
        const { data: warned } = await db.from('push_sent').select('key')
          .match({ league_id: league.id, season: state.season, slate_key: state.slate_key, kind: 'lock' });
        const done = new Set((warned ?? []).map((r) => r.key));
        const payload = lockMessage(league, state.slate_label, win, leagueUrl);
        for (const uid of memberIds) {
          if (entered.has(uid) || done.has(uid) || !subs.has(uid)) continue;
          out.lock += await pushTo(subs.get(uid), payload);
          await db.from('push_sent').upsert({ league_id: league.id, season: state.season, slate_key: state.slate_key, kind: 'lock', key: uid });
        }
      }

      // 2. The lead changed hands.
      const entryIds = (entries ?? []).map((e) => e.id);
      const { data: picks } = entryIds.length ? await db.from('picks').select('entry_id, game_id, picked').in('entry_id', entryIds) : { data: [] };
      const lead = leaders(games, entries ?? [], picks ?? [], league.scoring);
      const { data: last } = await db.from('push_sent').select('value')
        .match({ league_id: league.id, season: state.season, slate_key: state.slate_key, kind: 'lead', key: 'leaders' }).maybeSingle();
      if (lead.key && lead.key !== (last?.value ?? '')) {
        // The first leader of a slate is recorded quietly; changes are news.
        if (last) {
          const previous = last.value ? last.value.split(',') : [];
          for (const { user_id, payload } of leadMessages(league, state.slate_label, previous, lead.ids, names, [...subs.keys()], leagueUrl)) {
            out.lead += await pushTo(subs.get(user_id), payload);
          }
        }
        await db.from('push_sent').upsert({ league_id: league.id, season: state.season, slate_key: state.slate_key, kind: 'lead', key: 'leaders', value: lead.key });
      }
    } catch (e) {
      console.error(`push jobs failed for league ${league.id}:`, e?.message);
    }
  }
  return out;
}
