// Fake but realistic data for the design preview (/dev) and the seed script.
// A 14-game NFL slate frozen mid-Sunday: Thursday is final, the early window
// is final, the late window is live, Sunday night and Monday are still open.

const T = (n) => ({ abbr: n[0], name: n[1], logo: `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${n[0].toLowerCase()}.png`, color: n[2] });
const teams = {
  NE: T(['NE', 'Patriots', '#002a5c']), SEA: T(['SEA', 'Seahawks', '#002a5c']),
  DAL: T(['DAL', 'Cowboys', '#002a5c']), PHI: T(['PHI', 'Eagles', '#06424d']),
  KC: T(['KC', 'Chiefs', '#e31837']), BUF: T(['BUF', 'Bills', '#00338d']),
  GB: T(['GB', 'Packers', '#204e32']), CHI: T(['CHI', 'Bears', '#0b162a']),
  SF: T(['SF', '49ers', '#aa0000']), LAR: T(['LAR', 'Rams', '#003594']),
  BAL: T(['BAL', 'Ravens', '#241773']), CIN: T(['CIN', 'Bengals', '#fb4f14']),
  NYJ: T(['NYJ', 'Jets', '#115740']), MIA: T(['MIA', 'Dolphins', '#008e97']),
  PIT: T(['PIT', 'Steelers', '#ffb612']), CLE: T(['CLE', 'Browns', '#311d00']),
  DET: T(['DET', 'Lions', '#0076b6']), MIN: T(['MIN', 'Vikings', '#4f2683']),
  DEN: T(['DEN', 'Broncos', '#fb4f14']), LV: T(['LV', 'Raiders', '#000000']),
  ATL: T(['ATL', 'Falcons', '#a71930']), NO: T(['NO', 'Saints', '#d3bc8d']),
  TB: T(['TB', 'Buccaneers', '#d50a0a']), CAR: T(['CAR', 'Panthers', '#0085ca']),
  HOU: T(['HOU', 'Texans', '#03202f']), IND: T(['IND', 'Colts', '#002c5f']),
  LAC: T(['LAC', 'Chargers', '#0080c6']), ARI: T(['ARI', 'Cardinals', '#97233f']),
};

// `now` is Sunday 4:40 PM ET on the fixture's calendar.
export const NOW = Date.parse('2026-09-13T20:40:00Z');
const H = 3600_000;
const SLOT = {
  thu: '2026-09-11T00:15:00Z',   // Thursday 8:15 PM ET
  early: '2026-09-13T17:00:00Z', // Sunday 1:00 PM ET
  late: '2026-09-13T20:25:00Z',  // Sunday 4:25 PM ET
  snf: '2026-09-14T00:20:00Z',   // Sunday 8:20 PM ET
  mnf: '2026-09-15T00:15:00Z',   // Monday 8:15 PM ET
};
const at = (h) => new Date(NOW + h * H).toISOString();

function game(id, away, home, slot, opts = {}) {
  const a = teams[away], h = teams[home];
  const kickoff = SLOT[slot];
  const hoursFromNow = (Date.parse(kickoff) - NOW) / H;
  const state = opts.state ?? (hoursFromNow <= -3.5 ? 'post' : hoursFromNow <= 0 ? 'in' : 'pre');
  const hs = opts.hs ?? 0, as = opts.as ?? 0;
  return {
    id, sport: 'nfl', season: 2026, season_type: 2, slate_key: '2026-2-01', slate_label: 'Week 1',
    kickoff,
    home_abbr: h.abbr, home_name: h.name, home_logo: h.logo, home_color: h.color,
    away_abbr: a.abbr, away_name: a.name, away_logo: a.logo, away_color: a.color,
    home_score: hs, away_score: as, state,
    status_detail: state === 'post' ? (opts.ot ? 'Final/OT' : 'Final') : state === 'in' ? (opts.clock ?? 'Q3 8:14') : '',
    winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null,
  };
}

export const GAMES = [
  game('f1', 'NE', 'SEA', 'thu', { hs: 24, as: 17 }),                 // Thursday night
  game('f2', 'DAL', 'PHI', 'early', { hs: 20, as: 27 }),                 // early window, finals
  game('f3', 'KC', 'BUF', 'early', { hs: 31, as: 28, ot: true }),
  game('f4', 'CLE', 'PIT', 'early', { hs: 13, as: 13 }),                 // a tie: scores for nobody
  game('f5', 'MIN', 'DET', 'early', { hs: 34, as: 10 }),
  game('f6', 'CAR', 'ATL', 'early', { hs: 21, as: 24 }),
  game('f7', 'IND', 'HOU', 'early', { hs: 17, as: 20 }),
  game('l1', 'GB', 'CHI', 'late', { hs: 14, as: 17, clock: 'Q2 1:52' }), // late window, live
  game('l2', 'SF', 'LAR', 'late', { hs: 7, as: 7, clock: 'Q2 6:30' }),
  game('l3', 'DEN', 'LV', 'late', { hs: 3, as: 10, clock: 'Q2 0:41' }),
  game('l4', 'ARI', 'LAC', 'late', { hs: 21, as: 6, clock: 'Q2 3:15' }),
  game('o1', 'BAL', 'CIN', 'snf'),                                       // Sunday night
  game('o2', 'TB', 'NO', 'snf'),
  game('o3', 'NYJ', 'MIA', 'mnf'),                                      // Monday night
];

export const PLAYERS = [
  { id: 'u-colin', display_name: 'Colin', emoji: '🏈', venmo_handle: '@colin-b', email: 'colin@example.com' },
  { id: 'u-kevin', display_name: 'Kevin', emoji: '🦅', venmo_handle: '@kev', email: 'kevin@example.com' },
  { id: 'u-brian', display_name: 'Brian', emoji: '🍺', venmo_handle: '', email: 'brian@example.com' },
  { id: 'u-sam', display_name: 'Sam', emoji: '🐬', venmo_handle: '@sam-p', email: 'sam@example.com' },
  { id: 'u-jess', display_name: 'Jess', emoji: '🔥', venmo_handle: '@jess', email: 'jess@example.com' },
  { id: 'u-marco', display_name: 'Marco', emoji: '🍕', venmo_handle: '@marco', email: 'marco@example.com' },
];

export const LEAGUE = {
  id: 'league-demo', name: 'Draft With Purpose', sport: 'nfl', invite_code: 'a1b2c3d4',
  logo_url: '', color1: '#1d4ed8', color2: '#111827', entry_fee_cents: 500,
  venmo_handle: '@colin-b', recap_enabled: true, reminders_enabled: true, commissioner: 'u-colin',
};

// Each player's picks as HOME/AWAY per game id. Brian forgot the late window.
const P = {
  'u-colin': { f1: 'HOME', f2: 'AWAY', f3: 'AWAY', f4: 'HOME', f5: 'HOME', f6: 'HOME', f7: 'HOME', l1: 'AWAY', l2: 'HOME', l3: 'AWAY', l4: 'HOME', o1: 'HOME', o2: 'AWAY', o3: 'HOME' },
  'u-kevin': { f1: 'HOME', f2: 'HOME', f3: 'HOME', f4: 'AWAY', f5: 'HOME', f6: 'HOME', f7: 'AWAY', l1: 'HOME', l2: 'AWAY', l3: 'HOME', l4: 'HOME', o1: 'AWAY', o2: 'HOME' },
  'u-brian': { f1: 'AWAY', f2: 'AWAY', f3: 'AWAY', f4: 'HOME', f5: 'AWAY', f6: 'AWAY', f7: 'HOME' },
  'u-sam':   { f1: 'HOME', f2: 'AWAY', f3: 'HOME', f4: 'HOME', f5: 'HOME', f6: 'AWAY', f7: 'HOME', l1: 'AWAY', l2: 'AWAY', l3: 'AWAY', l4: 'AWAY', o1: 'HOME', o2: 'HOME', o3: 'AWAY' },
  'u-jess':  { f1: 'HOME', f2: 'HOME', f3: 'AWAY', f4: 'AWAY', f5: 'HOME', f6: 'HOME', f7: 'HOME', l1: 'HOME', l2: 'HOME', l3: 'AWAY', l4: 'HOME', o1: 'HOME', o2: 'AWAY', o3: 'HOME' },
  'u-marco': { f1: 'AWAY', f2: 'AWAY', f3: 'AWAY', f4: 'HOME', f5: 'AWAY', f6: 'HOME', f7: 'AWAY', l1: 'AWAY', l2: 'HOME', l3: 'HOME', l4: 'AWAY', o1: 'AWAY', o2: 'AWAY', o3: 'AWAY' },
};
const TB = { 'u-colin': 44, 'u-kevin': 51, 'u-brian': null, 'u-sam': 38, 'u-jess': 47, 'u-marco': 55 };
const PAID = new Set(['u-colin', 'u-kevin', 'u-sam', 'u-jess']);

export const ENTRIES = PLAYERS.map((p) => ({
  id: `e-${p.id}`, league_id: LEAGUE.id, user_id: p.id, season: 2026, slate_key: '2026-2-01',
  tiebreaker: p.id === 'u-colin' ? TB[p.id] : null, // others hidden until the last kickoff
  paid: PAID.has(p.id), created_at: at(-80),
}));

// What the viewer (Colin) is allowed to see: own picks always, others' after kickoff.
export function visiblePicks(me = 'u-colin', now = NOW) {
  const out = [];
  for (const p of PLAYERS) {
    for (const [gid, side] of Object.entries(P[p.id])) {
      const g = GAMES.find((x) => x.id === gid);
      if (p.id === me || new Date(g.kickoff).getTime() <= now) out.push({ entry_id: `e-${p.id}`, game_id: gid, picked: side });
    }
  }
  return out;
}

export const ALL_PICKS = Object.entries(P).flatMap(([uid, m]) => Object.entries(m).map(([gid, side]) => ({ entry_id: `e-${uid}`, game_id: gid, picked: side })));
export const NAMES = new Map(PLAYERS.map((p) => [p.id, p]));
