'use client';

import { useEffect, useRef, useState } from 'react';

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
function seen(key) { try { return localStorage.getItem(key) === '1'; } catch { return true; } }
function mark(key) { try { localStorage.setItem(key, '1'); } catch { /* private mode: the pop simply repeats */ } }

// One burst of confetti the first time this `id` is seen in this browser.
// Skipped with reduced motion on. Canvas, ~1.6 seconds, then gone.
export function Confetti({ id, colors = ['#1d4ed8', '#e31837', '#ffb612', '#197a3f', '#ffffff'] }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  // Two steps: decide, then draw once the canvas exists in the DOM.
  useEffect(() => {
    if (!id || seen(id) || reducedMotion()) return;
    mark(id);
    setOn(true);
  }, [id]);
  useEffect(() => {
    const c = ref.current;
    if (!on || !c) return undefined;
    const ctx = c.getContext('2d');
    const W = (c.width = window.innerWidth), H = (c.height = window.innerHeight);
    const bits = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.4, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const age = (t - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.vx *= 0.99; b.r += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.globalAlpha = Math.min(1, Math.max(0, 1.4 - age * 0.8));
        ctx.fillStyle = b.color; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
      }
      if (age < 1.8) raf = requestAnimationFrame(tick); else setOn(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!on) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-screen w-screen" />;
}

// A line that stays dismissed in this browser once closed.
export function Dismissable({ id, className = '', children }) {
  const [gone, setGone] = useState(true);
  useEffect(() => { setGone(seen(id)); }, [id]);
  if (gone) return null;
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <span className="min-w-0 flex-1">{children}</span>
      <button type="button" className="shrink-0 text-xs font-semibold opacity-70 hover:opacity-100" onClick={() => { mark(id); setGone(true); }} aria-label="Dismiss">✕</button>
    </div>
  );
}

// A grid cell that flips into view when it mounts within a few minutes of
// kickoff: the first refresh after a game starts is when a hidden pick turns
// into a real one, and that deserves a turn of the card.
export function RevealCell({ kickoff, now, children }) {
  const fresh = now - new Date(kickoff).getTime() < 3 * 60_000;
  return <span className={fresh ? 'flip-in inline-block' : 'inline-block'}>{children}</span>;
}

// A check-mark that draws itself, for the moment a first pick lands.
export function CheckPop({ className = '' }) {
  return (
    <svg className={`check-pop ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12.5l5 5L20 6" />
    </svg>
  );
}
