'use client';

import { useEffect, useState, useTransition } from 'react';
import { pushSupport, currentSubscription, subscribe, unsubscribe } from '../../lib/push/client';
import { savePushSubscription, removePushSubscription } from '../../lib/actions';

// Turn push on or off for this device. `demo` skips the server (the /dev page).
export default function PushToggle({ publicKey, demo = false }) {
  const [support, setSupport] = useState(null);   // see pushSupport()
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s === 'granted') currentSubscription().then((sub) => setOn(Boolean(sub)));
  }, []);

  const enable = () => start(async () => {
    setMsg(null);
    try {
      const sub = await subscribe(publicKey);
      if (!sub) { setSupport(pushSupport()); setMsg('No permission, so nothing will arrive.'); return; }
      if (!demo) await savePushSubscription(sub, navigator.userAgent);
      setOn(true); setSupport('granted');
    } catch (e) { setMsg(e?.message ?? 'Could not turn notifications on.'); }
  });
  const disable = () => start(async () => {
    setMsg(null);
    try {
      const endpoint = await unsubscribe();
      if (endpoint && !demo) await removePushSubscription(endpoint);
      setOn(false);
    } catch (e) { setMsg(e?.message ?? 'Could not turn notifications off.'); }
  });

  if (!publicKey) return <p className="text-sm text-muted">Not set up on this deploy yet (no VAPID keys).</p>;
  if (support === null) return <p className="text-sm text-muted">Checking this device…</p>;
  if (support === 'unsupported') return <p className="text-sm text-muted">This browser can&rsquo;t receive push notifications.</p>;
  if (support === 'needs-install') {
    return <p className="text-sm text-muted">On an iPhone, notifications only work once the app is on your home screen: tap Share, then <b className="text-ink2">Add to Home Screen</b>, then come back here.</p>;
  }
  if (support === 'denied') {
    return <p className="text-sm text-muted">Notifications are blocked for this site in your browser settings. Allow them there, then reload.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3" data-push-toggle>
      <span className={`pill ${on ? 'pill-good' : 'pill-muted'}`}>{on ? 'On for this device' : 'Off'}</span>
      <button type="button" className={`btn btn-sm ${on ? 'btn-ghost' : ''}`} onClick={on ? disable : enable} disabled={pending}>
        {pending ? 'One sec…' : on ? 'Turn off' : 'Turn on'}
      </button>
      {msg && <span className="text-xs text-bad">{msg}</span>}
    </div>
  );
}
