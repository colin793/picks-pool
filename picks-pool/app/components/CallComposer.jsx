'use client';

import { useState } from 'react';

// "Call it": pick a game, a side, a margin if you dare, and it goes on the
// record in the room. The database refuses a game that has kicked off.
export default function CallComposer({ leagueId, games, homeFirst = false, action }) {
  const [open, setOpen] = useState(false);
  const [gameId, setGameId] = useState(games[0]?.id ?? '');
  const [side, setSide] = useState('');
  const g = games.find((x) => x.id === gameId);
  if (!games.length) return null;
  const label = (x) => (homeFirst ? `${x.home_abbr} v ${x.away_abbr}` : `${x.away_abbr} @ ${x.home_abbr}`);
  const first = homeFirst ? 'HOME' : 'AWAY', second = homeFirst ? 'AWAY' : 'HOME';
  const abbr = (s) => (s === 'HOME' ? g?.home_abbr : g?.away_abbr);

  if (!open) {
    return (
      <div className="border-t border-line px-3 py-2 text-xs text-muted">
        Feeling sure? <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setOpen(true)}>Call a game</button> and it goes on the record.
      </div>
    );
  }
  return (
    <form action={action ?? undefined} onSubmit={action ? undefined : (e) => e.preventDefault()} className="space-y-2 border-t border-line bg-surface2/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Call it</span>
        <select name="game_id" className="input !w-auto py-1.5 text-sm" value={gameId} onChange={(e) => { setGameId(e.target.value); setSide(''); }} aria-label="Game">
          {games.map((x) => <option key={x.id} value={x.id}>{label(x)}</option>)}
        </select>
        {[first, second].map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)} aria-pressed={side === s}
            className={`btn btn-sm ${side === s ? '' : 'btn-ghost'}`}>{abbr(s)}</button>
        ))}
        <input type="hidden" name="side" value={side} />
        <label className="flex items-center gap-1 text-xs text-ink2">by <input className="input !w-16 !py-1.5 text-center" type="number" name="margin" min="1" max="99" inputMode="numeric" placeholder="any" /></label>
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" name="body" maxLength={140} placeholder="Say why (optional)" autoComplete="off" />
        <button className="btn" disabled={!side}>Put it on the record</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <p className="text-[11px] text-muted">A margin call needs the full number. Graded when the game goes final; you can take it back until kickoff.</p>
    </form>
  );
}
