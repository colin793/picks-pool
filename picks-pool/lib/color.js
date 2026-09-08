// "#1d4ed8" -> "29 78 216" for the rgb(var(--x-rgb) / alpha) token pattern.
export function rgbTriple(hex, fallback = '29 78 216') {
  const v = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return fallback;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)).join(' ');
}

// Do two team colors read as the same color? Plain RGB distance is enough:
// navy vs navy is the case that matters (NE at SEA), not shades of taste.
// A missing color counts as the league accent, which a blue team can clash with too.
export function clash(a, b, fallback = '#1d4ed8', threshold = 90) {
  const rgb = (hex) => {
    const v = String(hex || fallback).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(v)) return rgb(fallback);
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  };
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < threshold;
}

// A lighter version of a team color, for the second side of a bar when the
// two sides clash: navy stays navy, the other navy becomes steel blue.
export function tint(hex, amount = 0.55, fallback = '#1d4ed8') {
  const v = String(hex || fallback).replace('#', '');
  const src = /^[0-9a-f]{6}$/i.test(v) ? v : fallback.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(src.slice(i, i + 2), 16)).map((c) => Math.round(c + (255 - c) * amount));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
