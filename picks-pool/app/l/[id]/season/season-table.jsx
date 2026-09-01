'use client';

import { useMemo, useState } from 'react';
import { money } from '../../../../lib/stats';

const COLS = [
  { key: 'name', label: 'Player', str: true },
  { key: 'wins', label: 'Wins' },
  { key: 'money', label: 'Won' },
  { key: 'avgFinish', label: 'Avg finish', asc: true },
  { key: 'correct', label: 'Correct' },
  { key: 'incorrect', label: 'Wrong' },
  { key: 'pct', label: 'Pct' },
  { key: 'weeks', label: 'Weeks' },
];

export default function SeasonTable({ rows }) {
  const [sort, setSort] = useState({ key: 'wins', dir: -1 });

  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key);
    return [...rows].sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (col?.str) return String(av).localeCompare(String(bv)) * sort.dir;
      return (av - bv) * sort.dir;
    });
  }, [rows, sort]);

  function click(col) {
    setSort((s) =>
      s.key === col.key ? { key: col.key, dir: -s.dir } : { key: col.key, dir: col.asc ? 1 : -1 }
    );
  }

  return (
    <table>
      <thead>
        <tr>
          {COLS.map((c) => (
            <th key={c.key} onClick={() => click(c)}>
              {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.user_id}>
            <td>{r.emoji} {r.name}</td>
            <td>{r.wins}</td>
            <td>{money(r.money)}</td>
            <td>{r.avgFinish == null ? '–' : r.avgFinish.toFixed(1)}</td>
            <td>{r.correct}</td>
            <td>{r.incorrect}</td>
            <td>{(r.pct * 100).toFixed(0)}%</td>
            <td>{r.weeks}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={COLS.length}>No entries yet this season.</td></tr>}
      </tbody>
    </table>
  );
}
