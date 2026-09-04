'use client';

import { useEffect, useRef, useState } from 'react';

// True for `ms` after `value` changes between renders. A live refresh that
// brings a new score changes the value; the first render never flashes, and
// re-renders that keep the value (a tick of the clock, a pick) never do.
export function useFlash(value, ms = 1600) {
  const prev = useRef(value);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Object.is(prev.current, value)) return undefined;
    prev.current = value;
    setOn(true);
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return on;
}

// A span that flashes in `color` when `value` changes. For server components
// (PickGrid, Standings) that can't hold the previous value themselves.
export function FlashPill({ value, color, soft = false, className = '', style, children, ...rest }) {
  const on = useFlash(value);
  return (
    <span
      {...rest}
      className={`${className} ${on ? (soft ? 'flash-soft' : 'flash') : ''}`}
      style={{ ...style, '--glow': color || 'rgb(var(--c1-rgb))' }}
    >
      {children}
    </span>
  );
}
