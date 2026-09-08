'use client';

import { useEffect, useState } from 'react';

const OPTIONS = [['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']];

// System, light or dark. Stored per device; app/layout.jsx applies it before
// first paint so nothing flashes.
export default function ThemeToggle() {
  const [mode, setMode] = useState('system');
  useEffect(() => { try { const t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') setMode(t); } catch { /* fine */ } }, []);
  function choose(next) {
    setMode(next);
    try { if (next === 'system') localStorage.removeItem('theme'); else localStorage.setItem('theme', next); } catch { /* fine */ }
    if (next === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = next;
  }
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface2 p-0.5" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(([key, label]) => (
        <button key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => choose(key)}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${mode === key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
