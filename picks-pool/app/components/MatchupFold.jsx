'use client';

import { useState, useTransition } from 'react';
import { loadMatchup } from '../../lib/actions';
import { notesEmpty } from '../../lib/scores/matchup';

// "About this matchup": the room's take (always, it is ours), then what ESPN
// knows, fetched the first time the fold opens. `take` is [line, ...] per
// side from lib/room.js; `records` are the "2-0" strings coming in.
export default function MatchupFold({ game: g, take = { home: [], away: [] }, homeFirst = false, demo = false }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(undefined); // undefined: not asked yet; null: nothing there
  const [pending, start] = useTransition();
  const hasTake = take.home.length + take.away.length > 0;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && notes === undefined && !demo) start(async () => { try { setNotes(await loadMatchup(g.id)); } catch { setNotes(null); } });
    if (next && demo) setNotes(null);
  }

  const sides = homeFirst ? ['home', 'away'] : ['away', 'home'];
  const abbr = (s) => (s === 'home' ? g.home_abbr : g.away_abbr);
  const rec = (s) => (s === 'home' ? g.home_record : g.away_record);

  return (
    <div className="mt-1 px-1">
      <button type="button" onClick={toggle} aria-expanded={open} className="text-[11px] font-semibold text-ink2 hover:underline">
        {open ? 'Less' : 'About this matchup'}
      </button>
      {open && (
        <div className="mt-1.5 space-y-2 rounded-lg border border-line bg-surface p-2 text-[12px] leading-snug">
          {(rec('home') || rec('away')) && (
            <p className="text-ink2">{sides.map((s) => `${abbr(s)} ${rec(s) || '–'}`).join(' · ')}{notes?.venue ? ` · ${notes.venue}` : ''}</p>
          )}
          {hasTake ? (
            <div>
              <div className="eyebrow mb-0.5 !text-[10px]">The room</div>
              {sides.map((s) => take[s].map((line, i) => <p key={`${s}-${i}`}>{line}</p>))}
            </div>
          ) : (
            <p className="text-muted">The room has no history with these two yet.</p>
          )}
          {pending && <p className="text-muted">Asking ESPN…</p>}
          {notes && !notesEmpty(notes) && (
            <>
              {notes.projection && (
                <p><span className="eyebrow !text-[10px]">ESPN gives it</span> {sides.map((s) => `${abbr(s)} ${notes.projection[s]}%`).join(' · ')}</p>
              )}
              {sides.map((s) => (notes.lastFive[s]?.length ? (
                <p key={`l5-${s}`}><span className="font-semibold text-ink2">{abbr(s)} last {notes.lastFive[s].length}:</span>{' '}
                  {notes.lastFive[s].map((e, i) => <span key={i} className={`mr-1.5 ${e.result === 'W' ? 'text-good' : e.result === 'L' ? 'text-bad' : 'text-muted'}`}>{e.result} {e.score} {e.opp}</span>)}
                </p>
              ) : null))}
              {sides.map((s) => (notes.leaders[s]?.length ? (
                <p key={`ld-${s}`}><span className="font-semibold text-ink2">{abbr(s)}:</span> {notes.leaders[s].map((l) => `${l.name} ${l.value}`).join(' · ')}</p>
              ) : null))}
              {sides.map((s) => (notes.injuries[s]?.length ? (
                <p key={`inj-${s}`} className="text-muted"><span className="font-semibold">{abbr(s)} injuries:</span> {notes.injuries[s].map((i) => `${i.name}${i.pos ? ` (${i.pos})` : ''} ${i.status}`).join(', ')}</p>
              ) : null))}
            </>
          )}
          {notes === null && !pending && <p className="text-muted">{demo ? 'ESPN details are skipped in the preview.' : 'Nothing more from ESPN on this one.'}</p>}
        </div>
      )}
    </div>
  );
}
