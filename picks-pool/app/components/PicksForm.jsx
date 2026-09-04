'use client';

import { useMemo, useState, useTransition } from 'react';
import { savePicks, withdrawEntry } from '../../lib/actions';
import GameCard from './GameCard';
import { useNow } from './LocalTime';

// Group games by their Eastern calendar day: "Thursday, Sep 10".
function dayOf(iso) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(iso));
}

export default function PicksForm({ leagueId, season, slate, games, initialPicks, initialTiebreaker, entry, unit = 'points', fixedNow }) {
  const [picks, setPicks] = useState(initialPicks);
  const [tb, setTb] = useState(initialTiebreaker ?? '');
  const [msg, setMsg] = useState(null); // { kind: 'ok'|'warn'|'err', text }
  const [pending, start] = useTransition();
  const ticking = useNow();
  const now = fixedNow ?? ticking;

  const lastGame = games[games.length - 1];
  const tbLocked = lastGame ? new Date(lastGame.kickoff).getTime() <= now : true;
  const openGames = useMemo(() => games.filter((g) => new Date(g.kickoff).getTime() > now), [games, now]);
  const pickedOpen = openGames.filter((g) => picks[g.id]).length;
  const entered = Boolean(entry);
  const canWithdraw = entered && !games.some((g) => picks[g.id] && new Date(g.kickoff).getTime() <= now);

  const groups = useMemo(() => {
    const m = new Map();
    for (const g of games) {
      const k = dayOf(g.kickoff);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(g);
    }
    return [...m.entries()];
  }, [games]);

  function submit() {
    if (!entered && Object.keys(picks).length === 0) {
      setMsg({ kind: 'err', text: 'Pick at least one game before you enter.' });
      return;
    }
    setMsg(null);
    start(async () => {
      try {
        const r = await savePicks(leagueId, season, slate, picks, tb);
        if (r.refused.length) {
          const names = r.refused.map((id) => { const g = games.find((x) => x.id === id); return g ? `${g.away_abbr} @ ${g.home_abbr}` : id; });
          setMsg({ kind: 'warn', text: `${r.saved} pick${r.saved === 1 ? '' : 's'} saved. Already kicked off, not saved: ${names.join(', ')}.` });
        } else {
          setMsg({ kind: 'ok', text: `${r.saved} pick${r.saved === 1 ? '' : 's'} saved${r.tiebreaker ? ', tiebreaker too' : ''}.` });
        }
      } catch (e) {
        setMsg({ kind: 'err', text: e?.message ?? 'Save failed, try again.' });
      }
    });
  }

  function withdraw() {
    if (!confirm('Withdraw from this slate? Your picks are deleted and you leave the pot.')) return;
    start(async () => {
      try { await withdrawEntry(leagueId, entry.id); }
      catch (e) { setMsg({ kind: 'err', text: e?.message ?? 'Could not withdraw.' }); }
    });
  }

  return (
    <div className="space-y-5">
      {groups.map(([day, gs]) => (
        <section key={day}>
          <h2 className="eyebrow mb-2">{day}</h2>
          <div className="grid gap-2.5 md:grid-cols-2">
            {gs.map((g) => (
              <GameCard key={g.id} game={g} pick={picks[g.id]} now={now}
                onPick={(side) => setPicks((p) => ({ ...p, [g.id]: side }))} />
            ))}
          </div>
        </section>
      ))}

      <div className="card sticky bottom-[68px] z-20 !p-3 shadow-lg lg:bottom-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink2">
            <span className="hidden sm:inline">Tiebreaker</span>
            <span className="font-display text-sm text-ink">{lastGame ? `${lastGame.away_abbr} @ ${lastGame.home_abbr}` : 'last game'}</span>
            <span className="hidden sm:inline">total {unit}</span>
            <input className="input !w-20 !py-1.5 text-center" type="number" inputMode="numeric" min="0" max="300" value={tb} disabled={tbLocked}
              onChange={(e) => setTb(e.target.value)} placeholder="44" aria-label={`Tiebreaker: total ${unit} in the last game`} />
          </label>
          <span className="flex-1 text-xs text-muted">
            {msg
              ? <span className={msg.kind === 'ok' ? 'text-good' : msg.kind === 'warn' ? 'text-warn' : 'text-bad'}>{msg.text}</span>
              : `${pickedOpen} of ${openGames.length} open picked. Games lock at kickoff.`}
          </span>
          <div className="flex items-center gap-2">
            {canWithdraw && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={withdraw} disabled={pending}>Withdraw</button>
            )}
            <button className="btn" onClick={submit} disabled={pending || (openGames.length === 0 && tbLocked)}>
              {pending ? 'Saving…' : entered ? 'Update picks' : 'Submit picks'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
