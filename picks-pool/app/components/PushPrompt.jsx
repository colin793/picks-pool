'use client';

import { useEffect, useState, useTransition } from 'react';
import { pushSupport, subscribe } from '../../lib/push/client';
import { savePushSubscription } from '../../lib/actions';

// "Want a nudge?" Shown from the second visit on, only where push can work
// right now (so never on an iPhone that is not installed yet: the install
// card handles that), only while the browser has never been asked, and not
// again for a month after "Not now". Settings has the durable switch.
const KEY = 'pp.push';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

export default function PushPrompt({ publicKey, demo = false }) {
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!publicKey) return;
    const s = read();
    const visits = (s.visits ?? 0) + 1;
    write({ ...s, visits });
    if (visits < 2) return;
    if (s.dismissed && Date.now() - s.dismissed < 30 * 86_400_000) return;
    if (pushSupport() === 'default') setShow(true);
  }, [publicKey]);

  if (!show) return null;
  const dismiss = () => { write({ ...read(), dismissed: Date.now() }); setShow(false); };
  const enable = () => start(async () => {
    try {
      const sub = await subscribe(publicKey);
      if (sub && !demo) await savePushSubscription(sub, navigator.userAgent);
    } catch { /* the toggle in Settings explains failures; this card just goes away */ }
    dismiss();
  });

  return (
    <div className="card mb-4 flex items-center gap-3 !py-3" role="status" data-push-prompt>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-white" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold">Want a nudge?</div>
        <div className="text-xs text-muted">Two alerts only: picks about to lock when you haven&rsquo;t entered, and someone passing you on the board.</div>
      </div>
      <button type="button" className="btn btn-sm" onClick={enable} disabled={pending}>{pending ? 'One sec…' : 'Turn on'}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>Not now</button>
    </div>
  );
}
