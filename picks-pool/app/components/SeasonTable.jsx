'use client';

import { useMemo, useState } from 'react';
import { money } from '../../lib/stats';

const COLS = [
  { key: 'name', label: 'Player', str: true },
  { key: 'wins', label: 'Wins' },
  { key: 'money', label: 'Won' },
  { key: 'avgFinish', label: 'Avg finish', asc: true },
  { key: 'correct', label: 'Right' },
  { key: 'incorrect', label: 'Wrong' },
  { key: 'pct', label: 'Pct' },
  { key: 'slates', label: 'Played' },
];

export default function SeasonTable({ rows, me }) {
  const [sort, setSort] = useState({ key: 'wins', dir: -1 });

  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key);
    return [...rows].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (col?.str) return String(av).localeCompare(String(bv)) * sort.dir;
      return (av - bv) * sort.dir || b.wins - a.wins || b.correct - a.correct;
    });
  }, [rows, sort]);

  function click(col) {
    setSort((s) => (s.key === col.key ? { key: col.key, dir: -s.dir } : { key: col.key, dir: col.asc ? 1 : -1 }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            {COLS.map((c, i) => (
              <th key={c.key} onClick={() => click(c)} className={`cursor-pointer select-none hover:text-ink ${i ? 'text-right' : ''} ${i === 0 ? 'sticky left-0 bg-surface' : ''}`}>
                {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.user_id} className={r.user_id === me ? 'bg-accent/5 font-semibold' : ''}>
              <td className="sticky left-0 whitespace-nowrap bg-surface"><span className="mr-1.5">{r.emoji}</span>{r.name}</td>
              <td className="num text-right text-base">{r.wins}</td>
              <td className="text-right">{money(r.money)}</td>
              <td className="text-right">{r.avgFinish == null ? '–' : r.avgFinish.toFixed(1)}</td>
              <td className="num text-right text-good">{r.correct}</td>
              <td className="num text-right text-muted">{r.incorrect}</td>
              <td className="text-right">{(r.pct * 100).toFixed(0)}%</td>
              <td className="text-right">{r.slates}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={COLS.length} className="py-6 text-center text-muted">No entries yet this season.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
