// "#1d4ed8" -> "29 78 216" for the rgb(var(--x-rgb) / alpha) token pattern.
export function rgbTriple(hex, fallback = '29 78 216') {
  const v = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return fallback;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)).join(' ');
}
