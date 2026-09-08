// The two alerts, run for every league (or one sport's leagues) as often as
// anyone likes: push_sent remembers what already went out. Called after a
// real score sync and from /api/cron/push.
import { admin, appUrl } from '../supabase';
import { applyFeatured } from '../featured';
import { featuredRows } from '../league';
import { pushConfigured, pushTo, subscriptionsFor } from './send';
import { lockWindow, lockMessage, survivorLockMessage, leaders, leadMessages } from './rules';
import { loadSurvivor } from '../league';
import { survivorNeeds } from '../survivor';

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

      // 1. Picks lock soon and you have not entered. When the league runs a
      //    survivor pool, the same window also covers an alive player with no
      //    team yet: folded into this alert when both apply, its own alert
      //    (kind 'slock') when only the survivor team is missing.
      const win = lockWindow(games);
      if (win) {
        const entered = new Set((entries ?? []).map((e) => e.user_id));
        let needsTeam = new Set();
        if (league.survivor) {
          const sv = await loadSurvivor(db, league, state.season);
          if (!sv.missing) needsTeam = new Set(survivorNeeds(sv.games, sv.entries, sv.picks, state.slate_key));
        }
        const { data: warned } = await db.from('push_sent').select('kind, key')
          .match({ league_id: league.id, season: state.season, slate_key: state.slate_key }).in('kind', ['lock', 'slock']);
        const done = new Set((warned ?? []).map((r) => `${r.kind}:${r.key}`));
        const mark = (kind, uid) => db.from('push_sent').upsert({ league_id: league.id, season: state.season, slate_key: state.slate_key, kind, key: uid });
        for (const uid of memberIds) {
          if (!subs.has(uid)) continue;
          const survivor = needsTeam.has(uid) && !done.has(`slock:${uid}`);
          if (!entered.has(uid) && !done.has(`lock:${uid}`)) {
            out.lock += await pushTo(subs.get(uid), lockMessage(league, state.slate_label, win, leagueUrl, { survivor }));
            await mark('lock', uid);
            if (survivor) await mark('slock', uid);
          } else if (survivor) {
            out.lock += await pushTo(subs.get(uid), survivorLockMessage(league, state.slate_label, win, leagueUrl));
            await mark('slock', uid);
          }
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
