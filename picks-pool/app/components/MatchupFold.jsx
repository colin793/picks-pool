'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { loadMatchup } from '../../lib/actions';
import { notesEmpty } from '../../lib/scores/matchup';
import { DEMO_NOTES } from '../../lib/fixtures';
import { clash, tint } from '../../lib/color';

// "About this matchup": the room's take (always, it is ours), then what ESPN
// knows, fetched the first time the fold opens. One column per team where
// the card is wide enough, results as chips, a split bar for the projection.
export default function MatchupFold({ game: g, take = { home: [], away: [] }, homeFirst = false, demo = false }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(undefined); // undefined: not asked yet; null: nothing there
  const [pending, start] = useTransition();
  const hasTake = take.home.length + take.away.length > 0;
  const panel = useRef(null);

  // On a laptop the fold floats over the cards below instead of pushing the
  // row down; a click anywhere else, or Escape, closes it.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (panel.current && !panel.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && notes === undefined) {
      if (demo) setNotes(DEMO_NOTES);
      else start(async () => { try { setNotes(await loadMatchup(g.id)); } catch { setNotes(null); } });
    }
  }

  const sides = homeFirst ? ['home', 'away'] : ['away', 'home'];
  const abbr = (s) => (s === 'home' ? g.home_abbr : g.away_abbr);
  const color = (s) => (s === 'home' ? g.home_color : g.away_color) || 'rgb(var(--c1-rgb))';
  // Two navies make one bar. Then the second side wears its second color
  // when ESPN sent one that stands apart (Seahawks green), else a clear tint
  // of its primary (navy becomes steel blue), and both labels get a swatch.
  const twins = clash(g.home_color, g.away_color);
  const other = (s) => {
    const alt = s === 'home' ? g.home_alt_color : g.away_alt_color;
    const first = s === 'home' ? g.away_color : g.home_color;
    return alt && !clash(alt, first) ? alt : tint(s === 'home' ? g.home_color : g.away_color);
  };
  const fill = (s, second) => ({ background: second && twins ? other(s) : color(s) });
  const rec = (s) => (s === 'home' ? g.home_record : g.away_record);
  const records = (rec('home') || rec('away')) && !(rec('home') === '0-0' && rec('away') === '0-0');
  const has = (key) => notes && sides.some((s) => notes[key]?.[s]?.length);

  return (
    <div ref={panel} className="mt-1.5 px-1">
      <button type="button" onClick={toggle} aria-expanded={open} className="text-[11px] font-semibold text-ink2 hover:underline">
        {open ? 'Hide' : 'About this matchup'}
      </button>
      {open && (
        <div className="mt-2 space-y-4 rounded-lg border border-line bg-surface p-3 text-[13px] leading-relaxed lg:absolute lg:inset-x-2 lg:top-full lg:z-30 lg:-mt-1 lg:max-h-[70vh] lg:overflow-y-auto lg:shadow-xl">
          {(records || notes?.venue) && (
            <p className="text-ink2">
              {records && sides.map((s) => <span key={s} className="mr-3"><span className="font-display font-bold text-ink">{abbr(s)}</span> {rec(s) || '–'}</span>)}
              {notes?.venue && <span className="text-muted">{notes.venue}</span>}
            </p>
          )}

          <section>
            <h4 className="eyebrow mb-1">The room</h4>
            {hasTake
              ? sides.map((s) => take[s].map((line, i) => <p key={`${s}-${i}`}>{line}</p>))
              : <p className="text-muted">No history with these two yet. It builds as the season goes.</p>}
          </section>

          {pending && <p className="text-muted">Asking ESPN…</p>}

          {notes?.projection && (
            <section>
              <h4 className="eyebrow mb-1">ESPN gives it</h4>
              <div className="flex items-center gap-2 font-display text-sm font-bold">
                <span className="flex w-20 shrink-0 items-center gap-1.5">
                  {twins && <span className="h-3 w-3 shrink-0 rounded-sm" style={fill(sides[0], false)} aria-hidden />}
                  {abbr(sides[0])} {notes.projection[sides[0]]}%
                </span>
                <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span style={{ width: `${notes.projection[sides[0]]}%`, ...fill(sides[0], false) }} />
                  <span className="w-0.5 shrink-0 bg-surface" />
                  <span style={{ width: `${notes.projection[sides[1]]}%`, ...fill(sides[1], true) }} />
                </span>
                <span className="flex w-20 shrink-0 items-center justify-end gap-1.5">
                  {notes.projection[sides[1]]}% {abbr(sides[1])}
                  {twins && <span className="h-3 w-3 shrink-0 rounded-sm" style={fill(sides[1], true)} aria-hidden />}
                </span>
              </div>
            </section>
          )}

          {has('lastFive') && (
            <section>
              <h4 className="eyebrow mb-1">Last five</h4>
              {sides.map((s) => (notes.lastFive[s]?.length ? (
                <div key={s} className="mb-1.5 flex items-start gap-2">
                  <span className="w-10 shrink-0 pt-0.5 font-display text-sm font-bold tracking-wide">{abbr(s)}</span>
                  <ul className="flex min-w-0 flex-wrap gap-1">
                    {notes.lastFive[s].map((e, i) => (
                      <li key={i} className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] ${e.result === 'W' ? 'bg-goodsoft text-good' : e.result === 'L' ? 'bg-badsoft text-bad' : 'bg-surface2 text-muted'}`}>
                        <span className="font-bold">{e.result}</span> {e.score} <span className="opacity-80">{e.opp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null))}
            </section>
          )}

          {has('leaders') && (
            <section>
              <h4 className="eyebrow mb-1">Leaders</h4>
              <table className="w-full text-[12px]">
                <thead>
                  <tr>
                    <th className="w-10 text-left text-[10px] uppercase tracking-wide text-muted" aria-label="Stat" />
                    {sides.map((s) => <th key={s} className="text-left font-display text-sm font-bold tracking-wide">{abbr(s)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(sides.flatMap((s) => (notes.leaders[s] ?? []).map((l) => l.stat)))].map((stat) => (
                    <tr key={stat} className="align-top">
                      <td className="py-0.5 pr-2 text-[10px] uppercase tracking-wide text-muted">{stat}</td>
                      {sides.map((s) => {
                        const l = (notes.leaders[s] ?? []).find((x) => x.stat === stat);
                        return <td key={s} className="py-0.5 pr-2">{l ? <><span className="font-semibold">{l.name}</span> <span className="text-ink2">{l.value}</span></> : <span className="text-muted">–</span>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {has('injuries') && (
            <section>
              <h4 className="eyebrow mb-1">Injuries</h4>
              {sides.map((s) => (notes.injuries[s]?.length ? (
                <div key={s} className="mb-1.5 flex items-start gap-2">
                  <span className="w-10 shrink-0 pt-0.5 font-display text-sm font-bold tracking-wide">{abbr(s)}</span>
                  <ul className="flex min-w-0 flex-wrap gap-1">
                    {notes.injuries[s].map((i, k) => {
                      const st = /reserve|^ir$/i.test(i.status) ? 'IR' : /out/i.test(i.status) ? 'Out' : /doubt/i.test(i.status) ? 'D' : /question/i.test(i.status) ? 'Q' : /prob/i.test(i.status) ? 'P' : i.status.slice(0, 3);
                      const tone = st === 'IR' || st === 'Out' ? 'bg-badsoft text-bad' : st === 'D' ? 'bg-warnsoft text-warn' : 'bg-surface2 text-ink2';
                      return (
                        <li key={k} className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] ${tone}`} title={`${i.name}${i.pos ? ` (${i.pos})` : ''}: ${i.status}`}>
                          {i.name}{i.pos ? <span className="opacity-70"> {i.pos}</span> : ''} <span className="font-bold">· {st}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null))}
              <p className="text-[11px] text-muted">Q questionable · D doubtful · IR injured reserve</p>
            </section>
          )}

          {notes === null && !pending && <p className="text-muted">Nothing more from ESPN on this one.</p>}
        </div>
      )}
    </div>
  );
}
