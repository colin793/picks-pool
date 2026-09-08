'use client';

import { useState } from 'react';
import { markTour } from '../../lib/actions';

// The first-time walkthrough: a sheet at the bottom of the screen, one step
// at a time, out of the way of the page it explains. Finishing (or skipping)
// is remembered on the profile, so a second phone does not start over.
export default function Tour({ steps, kind = 'player', demo = false, onDone = null }) {
  const [i, setI] = useState(0);
  const [gone, setGone] = useState(false);
  if (gone || !steps?.length) return null;
  const step = steps[i];
  const last = i === steps.length - 1;
  const finish = () => { setGone(true); onDone?.(); if (!demo) markTour(kind).catch(() => {}); };
  return (
    <div className="fixed inset-x-0 z-40 px-3 bottom-[calc(var(--tabbar-h)_+_env(safe-area-inset-bottom)_+_8px)] lg:bottom-6 lg:left-[calc(var(--sidebar-w)_+_24px)] lg:right-auto lg:w-[420px]" role="dialog" aria-label="Walkthrough" data-tour>
      <div className="card shadow-lg border-accent/40">
        <div className="mb-1 flex items-center gap-2">
          <span className="eyebrow">{i + 1} of {steps.length}</span>
          <span className="ml-auto flex gap-1" aria-hidden>
            {steps.map((_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${k <= i ? 'bg-accent' : 'bg-line'}`} />)}
          </span>
        </div>
        <h2 className="h2 mb-1">{step.title}</h2>
        <p className="text-sm text-ink2">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          {!last && <button type="button" className="text-xs font-semibold text-muted hover:text-ink" onClick={finish}>Skip the tour</button>}
          <span className="ml-auto flex gap-2">
            {i > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setI(i - 1)}>Back</button>}
            <button type="button" className="btn btn-sm" onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Got it' : 'Next'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
