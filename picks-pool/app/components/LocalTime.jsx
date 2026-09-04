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

// Ticks every `ms` so lock state moves while a page sits open.
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
