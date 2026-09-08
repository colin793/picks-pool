// Runs a slate's draft once its first game has kicked off. Called by the
// Draft page on load and by the crons as a backstop, so it must be safe to
// call from anywhere, any number of times, at once: the drafts row is the
// lock (a primary key), and whoever inserts it deals the picks.
import { admin } from './supabase';
import { snakeDraft, slateTeams } from './draft';
import { sport as sportOf } from './scores/sports';
import { applyFeatured } from './featured';
import { featuredRows } from './league';

export async function runDraftIfDue(league, season, slateKey, games) {
  if (!league.draft || !games.length) return null;
  const first = Math.min(...games.map((g) => new Date(g.kickoff).getTime()));
  if (first > Date.now()) return null;
  const a = admin();
  const key = { league_id: league.id, season, slate_key: slateKey };
  const { data: existing, error: readErr } = await a.from('drafts').select('*').match(key).maybeSingle();
  if (readErr || existing) return existing ?? null; // no table yet, or already run
  const seed = `${league.id}:${season}:${slateKey}`;
  const { error } = await a.from('drafts').insert({ ...key, seed });
  if (error) return (await a.from('drafts').select('*').match(key).maybeSingle()).data ?? null; // someone else got there first
  const [{ data: rankings }, { data: members }] = await Promise.all([
    a.from('draft_rankings').select('user_id, ranking').match(key),
    a.from('memberships').select('user_id').eq('league_id', league.id),
  ]);
  const memberIds = new Set((members ?? []).map((m) => m.user_id));
  const entrants = (rankings ?? []).map((r) => r.user_id).filter((id) => memberIds.has(id));
  const wishes = new Map((rankings ?? []).map((r) => [r.user_id, Array.isArray(r.ranking) ? r.ranking.map(String) : []]));
  const { picks } = snakeDraft(entrants, wishes, slateTeams(games), seed);
  if (picks.length) {
    const rows = picks.map((p) => { const [game_id, side] = p.team.split(':'); return { ...key, user_id: p.user_id, game_id, side, round: p.round, pick_no: p.pick_no }; });
    const { error: writeErr } = await a.from('draft_picks').insert(rows);
    if (writeErr) console.error('draft picks not written:', writeErr.message);
  }
  return { ...key, seed, ran_at: new Date().toISOString() };
}

// Every league with the draft on: run the current slate's draft if due.
export async function runDueDrafts() {
  const a = admin();
  const { data: leagues, error } = await a.from('leagues').select('*').eq('draft', true);
  if (error) return { skipped: 'no draft column yet' };
  let ran = 0;
  for (const league of leagues ?? []) {
    try {
      const { data: state } = await a.from('sport_state').select('*').eq('sport', league.sport).maybeSingle();
      if (!state?.slate_key) continue;
      const { data: board } = await a.from('games').select('*').eq('sport', league.sport).eq('season', state.season).eq('slate_key', state.slate_key);
      const games = applyFeatured(board ?? [], await featuredRows(a, league, state.season));
      const { data: done } = await a.from('drafts').select('slate_key').match({ league_id: league.id, season: state.season, slate_key: state.slate_key }).maybeSingle();
      if (done) continue;
      if (await runDraftIfDue(league, state.season, state.slate_key, games)) ran += 1;
    } catch (e) {
      console.error(`draft run failed for league ${league.id}:`, e?.message);
    }
  }
  return { ran, sport: sportOf(leagues?.[0]?.sport ?? 'nfl').key };
}
