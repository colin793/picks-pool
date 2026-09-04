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
    id, sport: 'nfl', season: 2026, season_type: 2, slate_key: '2026-2-00', slate_label: 'Demo Week',
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
  id: `e-${p.id}`, league_id: LEAGUE.id, user_id: p.id, season: 2026, slate_key: '2026-2-00',
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

// A Premier League matchweek for the /dev?view=epl preview: draws pickable, home side first.
const S = (abbr, name, id, color) => ({ abbr, name, logo: `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`, color });
const clubs = {
  CHE: S('CHE', 'Chelsea', 363, '#0a4595'), ARS: S('ARS', 'Arsenal', 359, '#ef0107'),
  LIV: S('LIV', 'Liverpool', 364, '#e31b23'), MCI: S('MCI', 'Man City', 382, '#97c1e7'),
  TOT: S('TOT', 'Tottenham', 367, '#132257'), NEW: S('NEW', 'Newcastle', 361, '#241f20'),
  BHA: S('BHA', 'Brighton', 331, '#0057b8'), EVE: S('EVE', 'Everton', 368, '#003399'),
};
function match(id, home, away, kickoff, opts = {}) {
  const h = clubs[home], a = clubs[away];
  const state = opts.state ?? 'pre';
  const hs = opts.hs ?? 0, as = opts.as ?? 0;
  return {
    id, sport: 'epl', season: 2026, season_type: 2, slate_key: '2026-09-12', slate_label: 'Sep 12 to 14', kickoff,
    home_abbr: h.abbr, home_name: h.name, home_logo: h.logo, home_color: h.color,
    away_abbr: a.abbr, away_name: a.name, away_logo: a.logo, away_color: a.color,
    home_score: hs, away_score: as, state, status_detail: state === 'post' ? 'FT' : state === 'in' ? (opts.clock ?? "62'") : '',
    winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null,
  };
}
export const EPL_NOW = Date.parse('2026-09-13T15:00:00Z'); // Sunday 11 AM ET
export const EPL_GAMES = [
  match('m1', 'CHE', 'ARS', '2026-09-12T11:30:00Z', { state: 'post', hs: 1, as: 1 }),
  match('m2', 'LIV', 'EVE', '2026-09-12T14:00:00Z', { state: 'post', hs: 3, as: 0 }),
  match('m3', 'BHA', 'NEW', '2026-09-13T13:00:00Z', { state: 'in', hs: 0, as: 0, clock: "58'" }),
  match('m4', 'MCI', 'TOT', '2026-09-13T15:30:00Z'),
];
export const EPL_PICKS = { m1: 'TIE', m2: 'HOME', m3: 'TIE', m4: 'AWAY' };

// A college football Saturday for the /dev?view=featured preview: a board of
// twenty with ranks and conferences, so the auto-pick has something to chew on.
const C = (abbr, name, rank, conf) => ({ abbr, name, rank, conf });
const SEC = '8', B1G = '5', ACC = '1', B12 = '4', MAC = '15', MWC = '17', FCS = '20', IND = '18';
const cfbTeams = {
  UGA: C('UGA', 'Georgia', 1, SEC), TEX: C('TEX', 'Texas', 2, SEC), OSU: C('OSU', 'Ohio St', 3, B1G), ORE: C('ORE', 'Oregon', 4, B1G),
  PSU: C('PSU', 'Penn St', 5, B1G), ND: C('ND', 'Notre Dame', 6, IND), ALA: C('ALA', 'Alabama', 7, SEC), MIA: C('MIA', 'Miami', 8, ACC),
  TENN: C('TENN', 'Tennessee', 12, SEC), MISS: C('MISS', 'Ole Miss', 14, SEC), CLEM: C('CLEM', 'Clemson', 9, ACC), LSU: C('LSU', 'LSU', 11, SEC),
  MICH: C('MICH', 'Michigan', 17, B1G), USC: C('USC', 'USC', 20, B1G), ISU: C('ISU', 'Iowa St', 22, B12), BSU: C('BSU', 'Boise St', 24, MWC),
  VAN: C('VAN', 'Vanderbilt', null, SEC), IOWA: C('IOWA', 'Iowa', null, B1G), UNC: C('UNC', 'N Carolina', null, ACC), BAY: C('BAY', 'Baylor', null, B12),
  KENT: C('KENT', 'Kent St', null, MAC), TOL: C('TOL', 'Toledo', null, MAC), BGSU: C('BGSU', 'Bowling Green', null, MAC), UNLV: C('UNLV', 'UNLV', null, MWC),
  NICH: C('NICH', 'Nicholls', null, FCS), SDAK: C('SDAK', 'S Dakota St', null, FCS), UTEP: C('UTEP', 'UTEP', null, '12'), RICE: C('RICE', 'Rice', null, '151'),
  KSU: C('KSU', 'Kansas St', null, B12), FSU: C('FSU', 'Florida St', null, ACC), WIS: C('WIS', 'Wisconsin', null, B1G), ARK: C('ARK', 'Arkansas', null, SEC),
  NEB: C('NEB', 'Nebraska', null, B1G), PITT: C('PITT', 'Pitt', null, ACC), SMU: C('SMU', 'SMU', 16, ACC), TCU: C('TCU', 'TCU', null, B12),
  AKR: C('AKR', 'Akron', null, MAC), BUFF: C('BUFF', 'Buffalo', null, MAC), UMASS: C('UMASS', 'UMass', null, IND), UCONN: C('UCONN', 'UConn', null, IND),
};
const CFB_NOW = Date.parse('2026-09-12T20:00:00Z'); // Saturday 4 PM ET, the noon games just finished
const cfbSlot = { fri: '2026-09-12T00:00:00Z', noon: '2026-09-12T16:00:00Z', mid: '2026-09-12T19:30:00Z', late: '2026-09-12T23:30:00Z', night: '2026-09-13T02:30:00Z' };
function cfbGame(id, away, home, slot, opts = {}) {
  const a = cfbTeams[away], h = cfbTeams[home];
  const kickoff = cfbSlot[slot];
  const hours = (Date.parse(kickoff) - CFB_NOW) / H;
  const state = opts.state ?? (hours <= -3.5 ? 'post' : hours <= 0 ? 'in' : 'pre');
  const hs = opts.hs ?? 0, as = opts.as ?? 0;
  return {
    id, sport: 'cfb', season: 2026, season_type: 2, slate_key: '2026-2-03', slate_label: 'Week 3', kickoff,
    home_abbr: h.abbr, home_name: h.name, home_logo: '', home_color: '', home_rank: h.rank, home_conf: h.conf,
    away_abbr: a.abbr, away_name: a.name, away_logo: '', away_color: '', away_rank: a.rank, away_conf: a.conf,
    home_score: hs, away_score: as, state,
    status_detail: state === 'post' ? 'Final' : state === 'in' ? 'Q3 4:12' : '',
    winner: state === 'post' ? (hs > as ? 'HOME' : as > hs ? 'AWAY' : 'TIE') : null,
  };
}
export const CFB_BOARD = [
  cfbGame('c01', 'TEX', 'UGA', 'late'), cfbGame('c02', 'ORE', 'OSU', 'late'), cfbGame('c03', 'ALA', 'TENN', 'mid'),
  cfbGame('c04', 'MISS', 'LSU', 'night'), cfbGame('c05', 'CLEM', 'MIA', 'night'), cfbGame('c06', 'MICH', 'PSU', 'mid'),
  cfbGame('c07', 'ND', 'VAN', 'noon', { hs: 10, as: 31 }), cfbGame('c08', 'USC', 'IOWA', 'late'), cfbGame('c09', 'ISU', 'BAY', 'mid'),
  cfbGame('c10', 'BSU', 'UNLV', 'night'), cfbGame('c11', 'SMU', 'UNC', 'noon', { hs: 24, as: 27 }), cfbGame('c12', 'NICH', 'ARK', 'noon', { hs: 45, as: 3 }),
  cfbGame('c13', 'SDAK', 'WIS', 'mid'), cfbGame('c14', 'KSU', 'TCU', 'late'), cfbGame('c15', 'FSU', 'PITT', 'mid'),
  cfbGame('c16', 'NEB', 'KENT', 'noon', { hs: 7, as: 38 }), cfbGame('c17', 'TOL', 'BGSU', 'fri', { hs: 21, as: 28 }), cfbGame('c18', 'AKR', 'BUFF', 'mid'),
  cfbGame('c19', 'UTEP', 'RICE', 'late'), cfbGame('c20', 'UMASS', 'UCONN', 'fri', { hs: 17, as: 14 }),
];
export { CFB_NOW };
