'use client';

import { useState, useTransition } from 'react';
import { react } from '../../lib/actions';

export const EMOJI = ['🔥', '💀', '🤡', '👏'];

// The little row under a revealed pick: counts of each reaction, and a tap
// to add yours. `counts` is { emoji: n }, `mine` your current emoji or null.
export default function ReactCell({ leagueId, entryId, gameId, counts = {}, mine = null, demo = false }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(null); // optimistic: { counts, mine }
  const [pending, start] = useTransition();
  const shown = local ?? { counts, mine };
  const total = EMOJI.reduce((n, e) => n + (shown.counts[e] ?? 0), 0);

  const tap = (emoji) => {
    const next = { counts: { ...shown.counts }, mine: shown.mine };
    if (next.mine) next.counts[next.mine] = Math.max(0, (next.counts[next.mine] ?? 0) - 1);
    if (next.mine === emoji) next.mine = null;
    else { next.mine = emoji; next.counts[emoji] = (next.counts[emoji] ?? 0) + 1; }
    setLocal(next); setOpen(false);
    if (!demo) start(async () => { try { await react(leagueId, entryId, gameId, emoji); } catch { setLocal(null); } });
  };

  return (
    <div className="relative mt-0.5 flex min-h-[16px] items-center justify-center gap-1 text-[11px] leading-none">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={pending} aria-label="React"
        className={`rounded px-1 py-0.5 hover:bg-surface2 ${total ? '' : 'text-muted opacity-40 hover:opacity-100'}`} data-react>
        {total
          ? EMOJI.filter((e) => shown.counts[e]).map((e) => <span key={e} className={shown.mine === e ? 'font-bold' : ''}>{e}{shown.counts[e] > 1 ? shown.counts[e] : ''} </span>)
          : '＋'}
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-20 mt-1 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-surface p-1 shadow-lg" role="menu">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => tap(e)} role="menuitem"
              className={`rounded-full px-1.5 py-0.5 text-base hover:bg-surface2 ${shown.mine === e ? 'bg-accent/15 ring-1 ring-accent' : ''}`}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
