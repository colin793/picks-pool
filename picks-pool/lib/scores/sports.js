// The sports Picks Pool knows how to score. The database has a matching row in
// public.sports (key, name, slate_mode); ESPN details live here so a feed change
// is a code change, not a migration.
//
// slate_mode 'week': the sport has real weeks (NFL, college football). A slate
//   is one ESPN week of one season type. Key: 2026-2-01 (season, type, week).
// slate_mode 'date': no weeks (NBA, NHL, MLB). A slate is one calendar day in
//   US Eastern time. Key: 2026-11-14.
// slate_mode 'span': no week numbers in the feed, but the schedule comes in
//   clusters (a Premier League matchweek runs Friday to Monday). Consecutive
//   game days form one slate. Key: the first day, 2026-09-12.
//
// draws: true means a draw is a pickable outcome (pick 'TIE'); otherwise a
// tie scores for nobody. homeFirst lists the home side first ("Chelsea v
// Arsenal") instead of the American "away @ home".

export const SPORTS = {
  nfl: {
    key: 'nfl',
    name: 'NFL',
    path: 'football/nfl',
    mode: 'week',
    params: '',
    unit: 'points',
    // ESPN postseason week numbers. null = never a slate (Pro Bowl).
    postLabels: { 1: 'Wild Card', 2: 'Divisional Round', 3: 'Conference Championships', 4: null, 5: 'Super Bowl' },
  },
  cfb: {
    key: 'cfb',
    name: 'College Football',
    path: 'football/college-football',
    mode: 'week',
    params: 'groups=80&limit=400', // FBS only; default is Top 25
    unit: 'points',
    postLabels: { 1: 'Bowl Season' },
  },
  nba: { key: 'nba', name: 'NBA', path: 'basketball/nba', mode: 'date', params: 'limit=200', unit: 'points' },
  nhl: { key: 'nhl', name: 'NHL', path: 'hockey/nhl', mode: 'date', params: 'limit=200', unit: 'goals' },
  mlb: { key: 'mlb', name: 'MLB', path: 'baseball/mlb', mode: 'date', params: 'limit=200', unit: 'runs' },
  epl: { key: 'epl', name: 'Premier League', path: 'soccer/eng.1', mode: 'span', params: 'limit=100', unit: 'goals', draws: true, homeFirst: true },
};

export const SPORT_LIST = Object.values(SPORTS);

export function sport(key) {
  return SPORTS[key] ?? SPORTS.nfl;
}

// What a slate is called in the UI: "Week 1", "Wild Card", "Sat Nov 14".
export function slateNoun(key) {
  const m = sport(key).mode;
  return m === 'week' ? 'week' : m === 'span' ? 'matchweek' : 'day';
}
