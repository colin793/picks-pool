// The league rail: one line under each league that says where you stand
// this slate. Pure; lib/rail.test.mjs checks the wording.

// results: slateResults() for the current slate (or null when nothing is
// synced). me: user id. label: "Week 2". live: any game in progress.
export function railLine(results, me, label, { live = false } = {}) {
  const short = String(label ?? '').replace(/^Week /, 'Wk ');
  if (!results || !short) return { text: 'No games yet', live: false };
  const mine = results.rows.find((r) => r.user_id === me);
  if (!mine) return { text: `${short} · not in yet`, live };
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
  const record = mine.decided ? `${mine.correct}-${mine.incorrect}` : `${mine.picked} picked`;
  const place = mine.decided ? ` · ${ord(mine.rank)}${results.rows.length > 1 && results.rows.filter((r) => r.rank === mine.rank).length > 1 ? ' (tied)' : ''}` : '';
  return { text: `${short} · ${record}${place}`, live };
}
