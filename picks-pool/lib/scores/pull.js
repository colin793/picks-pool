// Fetch + normalize one sport's current slate from ESPN. No database here,
// so this file is testable with plain Node (scripts/espn-check.mjs).

import { sport as sportOf } from './sports.js';
import { fetchScoreboard, normalizeEvent, weekSlate, dateSlate, easternDate } from './espn.js';

// Week mode: ESPN's default board is the current week. Outside the regular
// season it shows preseason or postseason; pin preseason to regular week 1,
// keep postseason (those are real slates), skip the Pro Bowl.
export async function pullWeek(sportKey) {
  const s = sportOf(sportKey);
  let data = await fetchScoreboard(sportKey);
  if (!data) return null;

  let season = data.season?.year;
  let type = data.season?.type;
  let week = data.week?.number;
  const needsRefetch =
    type === 1 || // preseason
    type === 4 || // offseason
    (type === 3 && s.postLabels?.[week] === null); // Pro Bowl week
  if (needsRefetch) {
    const target = type === 3 ? { seasontype: 3, week: week + 1 } : { seasontype: 2, week: 1 };
    const again = await fetchScoreboard(sportKey, { ...target, dates: season ?? new Date().getFullYear() });
    if (again) {
      data = again;
      season = again.season?.year ?? season;
      type = target.seasontype;
      week = again.week?.number ?? target.week;
    }
  }
  if (!season || !week) return null;

  const current = weekSlate(sportKey, season, type, week);
  const rows = (data.events ?? []).map((ev) => normalizeEvent(sportKey, ev, current)).filter(Boolean);
  return { rows, current };
}

// Date mode: one request for yesterday through four days out (ET), bucketed by
// calendar day. The current slate is the first day with a game not yet final.
export async function pullDates(sportKey) {
  // Yesterday is included so a late game that ended after midnight ET still
  // gets its final; it can never become the current slate, though.
  const today = easternDate(new Date().toISOString());
  const start = easternDate(new Date(Date.now() - 86_400_000).toISOString());
  const end = easternDate(new Date(Date.now() + 4 * 86_400_000).toISOString());
  const data = await fetchScoreboard(sportKey, { dates: `${start.replaceAll('-', '')}-${end.replaceAll('-', '')}` });
  if (!data) return null;
  // Range queries omit the top-level season; each event carries its own.
  const first = data.events?.[0];
  const season = data.season?.year ?? first?.season?.year ?? Number(today.slice(0, 4));
  const type = data.season?.type ?? first?.season?.type ?? 2;

  const byDay = new Map();
  for (const ev of data.events ?? []) {
    const key = easternDate(ev.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(ev);
  }
  const days = [...byDay.keys()].sort();
  if (!days.length) return null;

  const rows = [];
  let currentKey = null;
  for (const key of days) {
    const slate = dateSlate(season, type, key);
    const dayRows = byDay.get(key).map((ev) => normalizeEvent(sportKey, ev, slate)).filter(Boolean);
    rows.push(...dayRows);
    if (!currentKey && key >= today && dayRows.some((g) => g.state !== 'post')) currentKey = key;
  }
  currentKey ??= days.find((d) => d >= today) ?? days.at(-1);
  return { rows, current: dateSlate(season, type, currentKey) };
}

// One specific week of a week-mode sport, e.g. to finish scoring the slate
// that ESPN's default board just rolled past.
export async function pullSpecificWeek(sportKey, season, seasonType, week) {
  const data = await fetchScoreboard(sportKey, { seasontype: seasonType, week, dates: season });
  if (!data) return null;
  const slate = weekSlate(sportKey, season, seasonType, week);
  return (data.events ?? []).map((ev) => normalizeEvent(sportKey, ev, slate)).filter(Boolean);
}
