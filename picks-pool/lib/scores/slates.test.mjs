// Self-check for slate identity: the keys and labels that decide which games
// belong to which slate, and the ESPN event -> games row shape. Nothing here
// touches the network. Run: npm run check
import assert from 'node:assert';
import { SPORTS, sport, slateNoun } from './sports.js';
import { weekSlate, dateSlate, spanSlate, easternDate, dateLabel, normalizeEvent } from './espn.js';

// ---- week-mode slates: regular season ----
assert.deepEqual(weekSlate('nfl', 2026, 2, 1), {
  key: '2026-2-01', label: 'Week 1', season: 2026, seasonType: 2, week: 1,
});
// Weeks pad to two digits so slate keys sort as text the way they run.
assert.equal(weekSlate('nfl', 2026, 2, 10).key, '2026-2-10');
assert.deepEqual(
  ['2026-2-10', '2026-2-02', '2026-2-18'].sort(),
  ['2026-2-02', '2026-2-10', '2026-2-18']
);

// ---- week-mode slates: the postseason, which v1 could not name ----
assert.equal(weekSlate('nfl', 2026, 3, 1).label, 'Wild Card');
assert.equal(weekSlate('nfl', 2026, 3, 2).label, 'Divisional Round');
assert.equal(weekSlate('nfl', 2026, 3, 3).label, 'Conference Championships');
assert.equal(weekSlate('nfl', 2026, 3, 5).label, 'Super Bowl');
assert.equal(weekSlate('cfb', 2026, 3, 1).label, 'Bowl Season');
// Season type sits in the middle of the key, so January sorts after December.
assert.equal(weekSlate('nfl', 2026, 3, 1).key, '2026-3-01');
assert.ok(weekSlate('nfl', 2026, 3, 1).key > weekSlate('nfl', 2026, 2, 18).key);
// The Pro Bowl is marked "never a slate"; pullWeek reads this null and skips
// past it. weekSlate itself still has to return something printable.
assert.equal(SPORTS.nfl.postLabels[4], null);
assert.equal(weekSlate('nfl', 2026, 3, 4).label, 'Playoffs 4');
// A playoff round the table does not know about is numbered, not blank.
assert.equal(weekSlate('nfl', 2026, 3, 9).label, 'Playoffs 9');

// ---- preseason ----
assert.equal(weekSlate('nfl', 2026, 1, 3).label, 'Preseason 3');
assert.equal(weekSlate('nfl', 2026, 1, 3).key, '2026-1-03');

// ---- date-mode slates ----
assert.deepEqual(dateSlate(2026, 2, '2026-11-14'), {
  key: '2026-11-14', label: 'Sat Nov 14', season: 2026, seasonType: 2,
});
assert.equal(dateLabel('2026-11-14'), 'Sat Nov 14');
// Date keys are already sortable, and never collide with week keys.
assert.deepEqual(
  ['2026-11-14', '2026-11-09', '2026-12-01'].sort(),
  ['2026-11-09', '2026-11-14', '2026-12-01']
);

// A late tip-off belongs to the day it started in ET, not the UTC day it
// spilled into. This is the whole reason easternDate exists.
assert.equal(easternDate('2026-11-15T01:30:00Z'), '2026-11-14'); // 8:30 PM ET
assert.equal(easternDate('2026-11-15T05:30:00Z'), '2026-11-15'); // 12:30 AM ET
// Both sides of a daylight saving switch resolve on Eastern's terms.
assert.equal(easternDate('2026-03-08T06:30:00Z'), '2026-03-08'); // 1:30 AM EST
assert.equal(easternDate('2026-11-01T05:30:00Z'), '2026-11-01'); // 1:30 AM EDT

// ---- span-mode slates (a Premier League matchweek) ----
assert.deepEqual(spanSlate(2026, 2, '2026-09-12', '2026-09-14'), {
  key: '2026-09-12', label: 'Sep 12 to 14', season: 2026, seasonType: 2,
});
// The key is the first day, so a matchweek keeps its name once it is underway.
assert.equal(spanSlate(2026, 2, '2026-09-30', '2026-10-02').label, 'Sep 30 to Oct 2');
assert.equal(spanSlate(2026, 2, '2026-09-12', '2026-09-12').label, 'Sep 12');

// ---- what each sport calls a slate ----
assert.equal(slateNoun('nfl'), 'week');
assert.equal(slateNoun('cfb'), 'week');
assert.equal(slateNoun('nba'), 'day');
assert.equal(slateNoun('epl'), 'matchweek');
// An unknown sport falls back to the NFL rather than throwing mid-render.
assert.equal(sport('quidditch').key, 'nfl');
assert.equal(slateNoun('quidditch'), 'week');

// Only sports that actually draw offer a draw as a pick.
assert.equal(SPORTS.epl.draws, true);
assert.ok(!SPORTS.nfl.draws);
assert.equal(SPORTS.epl.homeFirst, true);

// ---- ESPN event -> games row ----
const W1 = weekSlate('nfl', 2026, 2, 1);
const event = (overrides = {}) => ({
  id: 401,
  date: '2026-09-11T00:15Z',
  status: { type: { state: 'post', shortDetail: 'Final' } },
  competitions: [{
    competitors: [
      { homeAway: 'home', score: '27', team: { abbreviation: 'SEA', shortDisplayName: 'Seahawks', logo: 'sea.png', color: '002A5C' } },
      { homeAway: 'away', score: '24', team: { abbreviation: 'NE', shortDisplayName: 'Patriots', logo: 'ne.png', color: '#002244' } },
    ],
  }],
  ...overrides,
});

const row = normalizeEvent('nfl', event(), W1);
assert.equal(row.id, '401'); // ESPN sends numbers; the games table keys on text
assert.equal(row.sport, 'nfl');
assert.equal(row.season, 2026);
assert.equal(row.season_type, 2);
assert.equal(row.slate_key, '2026-2-01');
assert.equal(row.slate_label, 'Week 1');
assert.equal(row.home_abbr, 'SEA');
assert.equal(row.away_abbr, 'NE');
assert.equal(row.home_score, 27);
assert.equal(row.away_score, 24);
assert.equal(row.winner, 'HOME');
assert.equal(row.home_color, '#002a5c'); // normalized to a lowercase 6-digit hex
assert.equal(row.away_color, '#002244'); // a leading # from ESPN is tolerated
assert.equal(row.home_rank, null);        // no curatedRank on the event: unranked
assert.equal(row.home_conf, '');

// College football: the AP rank rides along, 99 means unranked, conference id is kept as text.
const ranked = normalizeEvent('cfb', event({
  competitions: [{ competitors: [
    { homeAway: 'home', score: '0', curatedRank: { current: 3 }, team: { abbreviation: 'UGA', conferenceId: 8 } },
    { homeAway: 'away', score: '0', curatedRank: { current: 99 }, team: { abbreviation: 'KENT', conferenceId: '15' } },
  ] }],
}), weekSlate('cfb', 2026, 2, 3));
assert.equal(ranked.home_rank, 3);
assert.equal(ranked.away_rank, null);
assert.equal(ranked.home_conf, '8');
assert.equal(ranked.away_conf, '15');

// Winner is read from the score, and only once the game is actually final.
const flipped = normalizeEvent('nfl', event({
  competitions: [{ competitors: [
    { homeAway: 'home', score: '10', team: { abbreviation: 'SEA' } },
    { homeAway: 'away', score: '20', team: { abbreviation: 'NE' } },
  ] }],
}), W1);
assert.equal(flipped.winner, 'AWAY');
assert.equal(flipped.home_name, ''); // missing team names degrade to empty, not undefined

const level = normalizeEvent('nfl', event({
  competitions: [{ competitors: [
    { homeAway: 'home', score: '17', team: { abbreviation: 'SEA' } },
    { homeAway: 'away', score: '17', team: { abbreviation: 'NE' } },
  ] }],
}), W1);
assert.equal(level.winner, 'TIE');

const scheduled = normalizeEvent('nfl', event({
  status: { type: { state: 'pre', shortDetail: 'Thu 8:20 PM ET' } },
}), W1);
assert.equal(scheduled.state, 'pre');
assert.equal(scheduled.winner, null); // never call a game before it is final
assert.equal(scheduled.status_detail, 'Thu 8:20 PM ET');

const running = normalizeEvent('nfl', event({
  status: { type: { state: 'in', shortDetail: 'Q3 4:12' } },
}), W1);
assert.equal(running.state, 'in');
assert.equal(running.winner, null);

// A malformed event is dropped rather than written as a half row.
assert.equal(normalizeEvent('nfl', event({ competitions: [{ competitors: [] }] }), W1), null);
assert.equal(normalizeEvent('nfl', {}, W1), null);

// A color ESPN cannot supply, or supplies badly, becomes empty so the UI can
// fall back instead of rendering "#undefined".
const noColor = normalizeEvent('nfl', event({
  competitions: [{ competitors: [
    { homeAway: 'home', score: '1', team: { abbreviation: 'SEA', color: 'fff' } },
    { homeAway: 'away', score: '0', team: { abbreviation: 'NE' } },
  ] }],
}), W1);
assert.equal(noColor.home_color, '');
assert.equal(noColor.away_color, '');

// A missing score is 0, not NaN: the row still has to satisfy the not-null column.
const noScore = normalizeEvent('nfl', event({
  status: { type: { state: 'pre' } },
  competitions: [{ competitors: [
    { homeAway: 'home', team: { abbreviation: 'SEA' } },
    { homeAway: 'away', team: { abbreviation: 'NE' } },
  ] }],
}), W1);
assert.equal(noScore.home_score, 0);
assert.equal(noScore.away_score, 0);

// A date-mode row carries the day as its slate key.
const nba = normalizeEvent('nba', event({ date: '2026-11-15T01:30Z' }), dateSlate(2026, 2, '2026-11-14'));
assert.equal(nba.sport, 'nba');
assert.equal(nba.slate_key, '2026-11-14');
assert.equal(nba.slate_label, 'Sat Nov 14');

console.log('slate self-check: all good');
