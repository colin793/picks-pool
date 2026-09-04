'use client';

import { useEffect, useState } from 'react';
import { fmtET, fmtLocal } from '../../lib/time';

// Server and client both render Eastern time first (no hydration mismatch),
// then the browser swaps in the viewer's own zone after mount.
export default function LocalTime({ iso, extra = {} }) {
  const [text, setText] = useState(() => fmtET(iso, extra));
  useEffect(() => { setText(fmtLocal(iso, extra)); }, [iso]); // eslint-disable-line react-hooks/exhaustive-deps
  return <time dateTime={iso}>{text}</time>;
}

// Ticks every `ms` so lock state moves while a page sits open. Seeded with
// the server's clock so the first client render matches the server render.
export function useNow(initial, ms = 30_000) {
  const [now, setNow] = useState(initial ?? Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
