// The first-time walkthroughs, as plain steps. Pure, so lib/tour.test.mjs can
// check that a league's settings produce the right script.

const noun = (sport) => (sport.mode === 'week' ? 'week' : sport.mode === 'span' ? 'matchweek' : 'day');

// What a new player needs to know about this league, in order. Each step
// is { title, body }. Optional modes only appear when the league plays them.
export function playerSteps(league, sport, { fee = null } = {}) {
  const n = noun(sport);
  const steps = [
    { title: `Welcome to ${league.name}`, body: `${sport.name}, one ${n} at a time. Pick a winner in every game on the Picks tab${league.scoring === 'spread' ? ', against the line frozen at kickoff' : ''}. Most right picks takes the ${n}'s pot.` },
    { title: 'Each game locks at its own kickoff', body: `Pick the Thursday game Thursday, the rest by Sunday. Once a game kicks off, your pick on it is set${sport.mode === 'week' ? ' and everyone can see it' : ''}. You can change anything else until it starts.` },
    { title: 'The tiebreaker', body: `Guess the total ${sport.unit} in the ${n}'s last game. Closest wins a tie at the top. Other people's numbers stay hidden until that game kicks off.` },
  ];
  if (fee) steps.push({ title: `Entry is ${fee} a ${n}`, body: `Tap Pay on the Picks tab and Venmo opens with the amount filled in. Play the ${n}s you want; skip the rest. The commissioner marks you paid.` });
  steps.push({ title: 'This week and Season', body: `This week shows everyone's picks as they reveal, the live standings and who needs what. Season keeps the long game: wins, money won, average finish.` });
  if (league.survivor) steps.push({ title: 'Survivor', body: `A second pool: one team a ${n} to win outright, never the same team twice, lose and you are out. Its own buy-in, once a season. Entries close when the pool's first ${n} locks.` });
  if (league.lock_of_week) steps.push({ title: 'Lock of the week', body: `Tap Lock on one of your picked games. If it hits it counts double. Choose before that game kicks off.` });
  if (league.duels) steps.push({ title: 'Duels', body: `Every ${n} you get one rival, everyone in turn. More points than them and the duel is yours. Records are on the Season tab.` });
  steps.push({ title: 'Chat', body: `The room. Talk, react to picks on the grid once they reveal${league.calls !== false ? ', and call a game ("KC by 10") to put it on the record; it gets graded' : ''}.` });
  if (league.duty) steps.push({ title: "Loser's duty", body: league.duty });
  steps.push({ title: 'Two alerts, that is all', body: `Turn on notifications in Settings and you get told when picks are about to lock without you, and when someone passes you. Nothing else, ever.` });
  return steps;
}

// The commissioner's setup list, with what is already done. Each item is
// { key, title, body, done }.
export function commishChecklist(league, { members = 1, pushConfigured = false, hasEntries = false } = {}) {
  return [
    { key: 'fee', title: 'Set the entry fee', body: 'League settings, below. Whatever the room agreed; free is fine.', done: Number.isFinite(league.entry_fee_cents) && league.entry_fee_cents !== 100 || hasEntries },
    { key: 'venmo', title: 'Add your Venmo handle', body: 'So Pay on the Picks tab sends money to you and not into the void.', done: Boolean(league.venmo_handle) || league.entry_fee_cents === 0 },
    { key: 'invite', title: 'Text the invite link', body: 'Top of this page. Anyone with the link can join.', done: members > 1 },
    { key: 'modes', title: 'Decide the modes', body: 'Survivor, lock of the week, duels, the loser’s duty: all off until you say. Settle them before the first entry; scoring locks then.', done: Boolean(league.survivor || league.lock_of_week || league.duels || league.duty) || hasEntries },
    { key: 'push', title: 'Notifications (optional)', body: 'Needs the three VAPID keys in Vercel. Until then the app runs exactly the same without them.', done: pushConfigured },
    { key: 'sunday', title: 'On Sunday', body: 'Scores pull themselves whenever anyone opens the app. If the board looks stale, Sync now is at the top of Admin.', done: false },
  ];
}
