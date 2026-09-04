'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { refreshDelay } from '../../lib/live';

// Re-fetches the page's server data on a schedule from lib/live.js. Next's
// router.refresh() keeps client state, so a half-made pick survives it.
// Background tabs pause; a tab coming back refreshes at once.
export default function LiveRefresh({ live, nextKickoff, everyMs = 60_000 }) {
  const router = useRouter();
  useEffect(() => {
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      const delay = refreshDelay({ live, nextKickoff }, Date.now(), everyMs);
      if (delay == null) return;
      timer = setTimeout(() => { router.refresh(); schedule(); }, delay);
    };
    const onVisibility = () => {
      if (!document.hidden) router.refresh();
      schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [live, nextKickoff, everyMs, router]);
  return null;
}
