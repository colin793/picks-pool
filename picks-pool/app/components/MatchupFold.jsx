'use client';

import { useState, useTransition } from 'react';
import { loadMatchup } from '../../lib/actions';
import { notesEmpty } from '../../lib/scores/matchup';
import { DEMO_NOTES } from '../../lib/fixtures';

// "About this matchup": the room's take (always, it is ours), then what ESPN
// knows, fetched the first time the fold opens. One column per team where
// the card is wide enough, results as chips, a split bar for the projection.
export default function MatchupFold({ game: g, take = { home: [], away: [] }, homeFirst = false, demo = false }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(undefined); // undefined: not asked yet; null: nothing there
  const [pending, start] = useTransition();
  const hasTake = take.home.length + take.away.length > 0;

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
  const rec = (s) => (s === 'home' ? g.home_record : g.away_record);
  const records = (rec('home') || rec('away')) && !(rec('home') === '0-0' && rec('away') === '0-0');
  const has = (key) => notes && sides.some((s) => notes[key]?.[s]?.length);

  return (
    <div className="mt-1.5 px-1">
      <button type="button" onClick={toggle} aria-expanded={open} className="text-[11px] font-semibold text-ink2 hover:underline">
        {open ? 'Hide' : 'About this matchup'}
      </button>
      {open && (
        <div className="mt-2 space-y-4 rounded-lg border border-line bg-surface p-3 text-[13px] leading-relaxed">
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
                <span className="w-16 shrink-0">{abbr(sides[0])} {notes.projection[sides[0]]}%</span>
                <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span style={{ width: `${notes.projection[sides[0]]}%`, background: color(sides[0]) }} />
                  <span style={{ width: `${notes.projection[sides[1]]}%`, background: color(sides[1]) }} />
                </span>
                <span className="w-16 shrink-0 text-right">{notes.projection[sides[1]]}% {abbr(sides[1])}</span>
              </div>
            </section>
          )}

          {(has('lastFive') || has('leaders') || has('injuries')) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {sides.map((s) => (
                <section key={s} className="min-w-0 space-y-3">
                  <h4 className="font-display text-base font-bold tracking-wide">{abbr(s)}</h4>
                  {notes.lastFive[s]?.length > 0 && (
                    <div>
                      <div className="eyebrow mb-1 !text-[10px]">Last {notes.lastFive[s].length}</div>
                      <ul className="flex flex-wrap gap-1">
                        {notes.lastFive[s].map((e, i) => (
                          <li key={i} className={`rounded px-1.5 py-0.5 text-[12px] ${e.result === 'W' ? 'bg-goodsoft text-good' : e.result === 'L' ? 'bg-badsoft text-bad' : 'bg-surface2 text-muted'}`}>
                            <span className="font-bold">{e.result}</span> {e.score} <span className="opacity-80">{e.opp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {notes.leaders[s]?.length > 0 && (
                    <div>
                      <div className="eyebrow mb-1 !text-[10px]">Leaders</div>
                      <ul className="space-y-0.5">
                        {notes.leaders[s].map((l, i) => (
                          <li key={i} className="flex gap-2"><span className="w-12 shrink-0 pt-0.5 text-[11px] uppercase tracking-wide text-muted">{l.stat}</span><span className="min-w-0 flex-1 break-words"><span className="font-semibold">{l.name}</span> <span className="text-ink2">{l.value}</span></span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {notes.injuries[s]?.length > 0 && (
                    <div>
                      <div className="eyebrow mb-1 !text-[10px]">Injuries</div>
                      <ul className="space-y-0.5">
                        {notes.injuries[s].slice(0, 4).map((i, k) => (
                          <li key={k} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{i.name}{i.pos ? <span className="text-muted"> {i.pos}</span> : ''}</span><span className={`pill ${/out|reserve/i.test(i.status) ? 'pill-bad' : /doubt/i.test(i.status) ? 'pill-warn' : 'pill-muted'}`}>{i.status.replace('Injured Reserve', 'IR')}</span></li>
                        ))}
                        {notes.injuries[s].length > 4 && <li className="text-muted">and {notes.injuries[s].length - 4} more</li>}
                      </ul>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {notes === null && !pending && <p className="text-muted">Nothing more from ESPN on this one.</p>}
        </div>
      )}
    </div>
  );
}
