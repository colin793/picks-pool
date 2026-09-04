// When should an open page re-fetch its slate? Pure, so it is testable.
//   live:         some game is in progress (or has kicked off and ESPN has not
//                 flipped it to 'in' yet), so scores are moving.
//   nextKickoff:  the next kickoff still ahead, so lock state and the pick
//                 grid's reveal can happen without a manual reload.
export function refreshPlan(games, now = Date.now()) {
  let live = false;
  let nextKickoff = null;
  for (const g of games) {
    const t = new Date(g.kickoff).getTime();
    if (g.state === 'in' || (g.state !== 'post' && t <= now)) live = true;
    else if (t > now && (nextKickoff == null || t < nextKickoff)) nextKickoff = t;
  }
  return { live, nextKickoff: nextKickoff == null ? null : new Date(nextKickoff).toISOString() };
}

// Milliseconds until the next refresh, or null for none.
export function refreshDelay({ live, nextKickoff }, now = Date.now(), everyMs = 60_000) {
  if (live) return everyMs;
  if (!nextKickoff) return null;
  // Refresh just after kickoff; while waiting, look in every half hour in
  // case the schedule moved.
  const until = new Date(nextKickoff).getTime() - now + 5_000;
  return Math.max(5_000, Math.min(until, 30 * 60_000));
}
