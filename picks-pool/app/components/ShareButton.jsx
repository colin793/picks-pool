'use client';

import { useState } from 'react';
import { Icon } from './icons';

// Grabs the standings image and hands it to the phone's share sheet (the
// group text is one tap away). Where files cannot be shared, opens the image
// so it can be saved or long-pressed.
export default function ShareButton({ url, title = 'Standings', text = '' }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('no image');
      const blob = await res.blob();
      const file = new File([blob], 'standings.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
      } else {
        window.open(URL.createObjectURL(blob), '_blank', 'noopener');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') window.open(url, '_blank', 'noopener');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={share} disabled={busy} data-share>
      <Icon.share /> {busy ? 'One sec…' : 'Share'}
    </button>
  );
}
