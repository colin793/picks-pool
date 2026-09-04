// Self-check for the card's line, weather and consensus wording. Run: npm run check
import assert from 'node:assert';
import { lineText, favored, weatherText, consensusText } from './line.js';

const g = (home_spread, extra = {}) => ({ home_abbr: 'SEA', away_abbr: 'NE', home_spread, ...extra });
assert.equal(lineText(g(-3.5)), 'SEA -3.5');
assert.equal(lineText(g(7)), 'NE -7');
assert.equal(lineText(g(0)), "Pick'em");
assert.equal(lineText(g(null)), '');
assert.equal(lineText(g('-2.5')), 'SEA -2.5'); // numeric columns come back as strings from PostgREST
assert.equal(favored(g(-3.5)), 'HOME');
assert.equal(favored(g(7)), 'AWAY');
assert.equal(favored(g(0)), '');
assert.equal(favored(g(null)), '');

assert.equal(weatherText({ weather: 'Rain', temperature: 41 }), '🌧 41°');
assert.equal(weatherText({ weather: 'Light Snow', temperature: 28 }), '❄️ 28°');
assert.equal(weatherText({ weather: 'Sunny', temperature: 72 }), '☀️ 72°');
assert.equal(weatherText({ weather: 'Partly Cloudy', temperature: 60 }), '☁️ 60°');
assert.equal(weatherText({ weather: 'Thunderstorms', temperature: 80 }), '⛈ 80°');
assert.equal(weatherText({ weather: 'Foggy', temperature: null }), '🌫 Foggy');
assert.equal(weatherText({ weather: '', temperature: null }), ''); // a dome
assert.equal(weatherText({ weather: 'Mostly Clear', temperature: 55 }), '☀️ 55°');

const game = { home_abbr: 'KC', away_abbr: 'BUF' };
assert.deepEqual(consensusText(game, { HOME: 4, AWAY: 2, total: 6 }, 'HOME'), { text: '4 of 6 took KC', lone: false });
assert.deepEqual(consensusText(game, { HOME: 5, AWAY: 1, total: 6 }, 'AWAY'), { text: 'You alone took BUF', lone: true });
assert.deepEqual(consensusText(game, { HOME: 5, AWAY: 1, total: 6 }, 'HOME'), { text: '5 of 6 took KC', lone: false }); // the wolf is somebody else
assert.deepEqual(consensusText(game, { HOME: 3, AWAY: 3, total: 6 }, 'HOME'), { text: 'Split 3–3, KC and BUF', lone: false });
assert.equal(consensusText(game, { HOME: 1, AWAY: 1, total: 2 }, 'HOME').lone, false); // two players: nobody is a wolf
assert.equal(consensusText(game, { total: 0 }, 'HOME'), null);
assert.equal(consensusText(game, null, 'HOME'), null);
assert.deepEqual(consensusText(game, { HOME: 2, AWAY: 1, TIE: 3, total: 6 }, null), { text: '3 of 6 took a draw', lone: false });

console.log('line self-check: all good');
