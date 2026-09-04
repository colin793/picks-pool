// Small pure helpers for what a card says about the line and the weather.

// "SEA -3.5", "NE -7", "Pick'em", or '' when there is no line.
export function lineText(g) {
  const s = g.home_spread;
  if (s == null || !Number.isFinite(Number(s))) return '';
  const n = Number(s);
  if (n === 0) return "Pick'em";
  return n < 0 ? `${g.home_abbr} ${n}` : `${g.away_abbr} -${n}`;
}

// The side the line favors: 'HOME' | 'AWAY' | '' (pick'em or no line).
export function favored(g) {
  const n = Number(g.home_spread);
  if (g.home_spread == null || !Number.isFinite(n) || n === 0) return '';
  return n < 0 ? 'HOME' : 'AWAY';
}

// "🌧 41°" from ESPN's weather words. Indoor games have no weather and get ''.
export function weatherText(g) {
  if (!g.weather && g.temperature == null) return '';
  const w = String(g.weather || '').toLowerCase();
  const glyph =
    /thunder|storm/.test(w) ? '⛈' : /snow|flurr|sleet/.test(w) ? '❄️' : /rain|shower|drizzle/.test(w) ? '🌧'
    : /fog|mist|haze/.test(w) ? '🌫' : /wind|breez/.test(w) ? '💨' : /cloud|overcast/.test(w) ? '☁️'
    : /sun|clear|fair/.test(w) ? '☀️' : '🌤';
  return `${glyph} ${g.temperature != null ? `${g.temperature}°` : g.weather}`.trim();
}

// How the room split on a game once it is locked: "4 of 6 took KC", or the
// lone-wolf line when you are the only one on your side.
export function consensusText(g, counts, myPick, homeFirst = false) {
  if (!counts || !counts.total) return null;
  const n = { HOME: counts.HOME ?? 0, AWAY: counts.AWAY ?? 0, TIE: counts.TIE ?? 0 };
  const name = (side) => (side === 'HOME' ? g.home_abbr : side === 'AWAY' ? g.away_abbr : 'a draw');
  if (myPick && n[myPick] === 1 && counts.total >= 3) {
    return { text: `You alone took ${name(myPick)}`, lone: true };
  }
  const order = ['HOME', 'AWAY', 'TIE'].filter((s) => n[s] > 0).sort((a, b) => n[b] - n[a]);
  if (!order.length) return null;
  const top = order[0];
  if (order.length > 1 && n[order[0]] === n[order[1]]) {
    const [a, b] = homeFirst ? [order[0], order[1]].sort((x) => (x === 'HOME' ? -1 : 1)) : order;
    return { text: `Split ${n[a]}–${n[b]}, ${name(a)} and ${name(b)}`, lone: false };
  }
  return { text: `${n[top]} of ${counts.total} took ${name(top)}`, lone: false };
}
