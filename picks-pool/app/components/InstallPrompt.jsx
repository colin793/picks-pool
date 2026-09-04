'use client';

import { useEffect, useState } from 'react';

// "Put it on your home screen." Shown from the second visit on (the first is
// usually the invite link, no nagging there), never inside the installed app,
// and not again for a month after "Not now". iPhones get the Share-sheet
// instructions; browsers that fire beforeinstallprompt get a real button.
const KEY = 'pp.install';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

export default function InstallPrompt({ appName = 'Picks Pool' }) {
  const [mode, setMode] = useState(null); // 'ios' | 'native'
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) return undefined;
    const s = read();
    const visits = (s.visits ?? 0) + 1;
    write({ ...s, visits });
    if (s.dismissed && Date.now() - s.dismissed < 30 * 86_400_000) return undefined;
    if (visits < 2) return undefined;

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) { setMode('ios'); return undefined; }
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); setMode('native'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!mode) return null;
  const dismiss = () => { write({ ...read(), dismissed: Date.now() }); setMode(null); };
  const install = async () => { try { await installEvent?.prompt(); } catch { /* user closed it */ } dismiss(); };

  return (
    <div className="card mb-4 flex items-center gap-3 !py-3" role="status" data-install-prompt>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent font-display text-lg font-bold text-white">P</span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold">Put {appName} on your home screen</div>
        <div className="text-xs text-muted">
          {mode === 'ios'
            ? <>Tap <ShareGlyph /> Share, then <b className="text-ink2">Add to Home Screen</b>. It opens like an app, one tap on Sunday.</>
            : 'It opens like an app, one tap on Sunday.'}
        </div>
      </div>
      {mode === 'native' && <button type="button" className="btn btn-sm" onClick={install}>Install</button>}
      <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>Not now</button>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" className="inline -mt-0.5 align-middle" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}
