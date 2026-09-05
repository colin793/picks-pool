'use client';

import { useMemo, useState, useTransition } from 'react';
import { savePicks, withdrawEntry } from '../../lib/actions';
import GameCard from './GameCard';
import { useNow } from './LocalTime';
import { outcome } from '../../lib/stats';

// Group games by their Eastern calendar day: "Thursday, Sep 10".
function dayOf(iso) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(iso));
}

// allPicks: every pick the viewer may see (own always, others' once a game
// kicks off); entryCount: how many entries the slate has. Together they say
// how the room split on a locked game.
export default function PicksForm({ leagueId, season, slate, games, initialPicks, initialTiebreaker, entry, unit = 'points', draws = false, homeFirst = false, serverNow, fixedNow, allPicks = [], entryCount = 0, scoring = 'straight' }) {
  const [picks, setPicks] = useState(initialPicks);
  const [tb, setTb] = useState(initialTiebreaker ?? '');
  const [msg, setMsg] = useState(null); // { kind: 'ok'|'warn'|'err', text }
  const [pending, start] = useTransition();
  const ticking = useNow(serverNow);
  const now = fixedNow ?? ticking;

  const lastGame = [...games].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff) || String(a.id).localeCompare(String(b.id))).at(-1);
  const tbLocked = lastGame ? new Date(lastGame.kickoff).getTime() <= now : true;
  const openGames = useMemo(() => games.filter((g) => new Date(g.kickoff).getTime() > now), [games, now]);
  const consensus = useMemo(() => {
    const m = new Map();
    for (const p of allPicks) {
      if (!m.has(p.game_id)) m.set(p.game_id, { HOME: 0, AWAY: 0, TIE: 0, total: entryCount });
      m.get(p.game_id)[p.picked] += 1;
    }
    return m;
  }, [allPicks, entryCount]);
  const vegas = lastGame?.over_under != null ? Number(lastGame.over_under) : null;
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

  // What you can act on comes first. Once something is open, a day whose
  // games have all finished drops to the bottom, folded to one line. A day
  // with a game still in progress stays up top: that is the one to sweat.
  const finished = ([, gs]) => gs.every((g) => g.state === 'post');
  const active = openGames.length ? groups.filter((d) => !finished(d)) : groups;
  const done = openGames.length ? groups.filter(finished) : [];
  const [shown, setShown] = useState(() => new Set());
  const toggle = (day) => setShown((prev) => { const next = new Set(prev); next.has(day) ? next.delete(day) : next.add(day); return next; });

  const status = msg
    ? <span className={msg.kind === 'ok' ? 'text-good' : msg.kind === 'warn' ? 'text-warn' : 'text-bad'}>{msg.text}</span>
    : <>{pickedOpen} of {openGames.length} open picked. Games lock at kickoff.{vegas != null && <span className="lg:hidden"> Vegas says {vegas} on the tiebreaker.</span>}</>;

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
      {active.map(([day, gs]) => (
        <section key={day}>
          <h2 className="eyebrow mb-2">{day}</h2>
          <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))]">
            {gs.map((g) => (
              <GameCard key={g.id} game={g} pick={picks[g.id]} now={now} draws={draws} homeFirst={homeFirst} consensus={consensus.get(g.id)} scoring={scoring}
                onPick={(side) => setPicks((p) => ({ ...p, [g.id]: side }))} />
            ))}
          </div>
        </section>
      ))}

      {done.map(([day, gs]) => {
        const open = shown.has(day);
        const right = gs.filter((g) => picks[g.id] && outcome(g, scoring) === picks[g.id]).length;
        const played = gs.filter((g) => picks[g.id]).length;
        return (
          <section key={day}>
            <button type="button" onClick={() => toggle(day)} aria-expanded={open}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface2/60 px-3 py-2 text-left hover:border-ink2/40">
              <span className="eyebrow shrink-0 whitespace-nowrap">{day}</span>
              <span className="min-w-0 truncate text-xs text-muted">{gs.length} final{played ? ` · you went ${right} for ${played}` : ''}</span>
              <span className="ml-auto text-xs font-semibold text-ink2">{open ? 'Hide' : 'Show'}</span>
            </button>
            {open && (
              <div className="mt-2 grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))]">
                {gs.map((g) => (
                  <GameCard key={g.id} game={g} pick={picks[g.id]} now={now} draws={draws} homeFirst={homeFirst} consensus={consensus.get(g.id)} scoring={scoring} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Keeps the last row of games clear of the docked bar below. */}
      <div aria-hidden className="h-24 lg:h-20" />

      {/* Docked action bar: sits on the phone tab bar, spans the content column on
          desktop. Fixed rather than sticky so it never floats over the cards. */}
      <div
        className="fixed inset-x-0 z-20 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgba(0,0,0,.35)] backdrop-blur
          bottom-[calc(var(--tabbar-h)_+_env(safe-area-inset-bottom))] lg:bottom-0 lg:left-[var(--sidebar-w)]"
      >
        {/* Progress across the top edge: how much of the open slate is picked. */}
        <div className="absolute inset-x-0 top-[-1px] h-0.5 bg-line" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-300"
            style={{ width: openGames.length ? `${Math.round((pickedOpen / openGames.length) * 100)}%` : '0%' }} />
        </div>
        <div className="mx-auto max-w-5xl xl:max-w-[1400px] 2xl:max-w-[1800px] min-[2200px]:max-w-[2400px] px-4 py-2.5 lg:px-8 lg:py-3">
          <div className="flex items-center gap-3">
            <label className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-xs font-semibold text-ink2">Tiebreaker</span>
              <span className="truncate font-display text-sm font-semibold text-ink">
                {lastGame ? (homeFirst ? `${lastGame.home_abbr} v ${lastGame.away_abbr}` : `${lastGame.away_abbr} @ ${lastGame.home_abbr}`) : 'last game'}
              </span>
              <span className="hidden text-xs text-ink2 lg:inline">total {unit}</span>
              <input className="input !w-[4.5rem] !py-1.5 text-center" type="number" inputMode="numeric" min="0" max="300" value={tb} disabled={tbLocked}
                onChange={(e) => setTb(e.target.value)} placeholder={vegas != null ? String(Math.round(vegas)) : '44'} aria-label={`Tiebreaker: total ${unit} in the last game`} />
              {vegas != null && <span className="hidden whitespace-nowrap text-xs text-muted lg:inline" title="The over/under on the last game">Vegas says {vegas}</span>}
            </label>
            <span className="hidden min-w-0 flex-1 truncate text-xs text-muted sm:block">{status}</span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {canWithdraw && (
                <button type="button" className="btn btn-ghost btn-sm hidden sm:inline-flex" onClick={withdraw} disabled={pending}>Withdraw</button>
              )}
              <button className="btn" onClick={submit} disabled={pending || (openGames.length === 0 && tbLocked)}>
                {pending ? 'Saving…' : <>{entered ? 'Update' : 'Submit'}<span className="hidden sm:inline">picks</span></>}
              </button>
            </div>
          </div>
          <p className="mt-1.5 flex items-center gap-3 text-[11px] text-muted sm:hidden">
            <span className="min-w-0 flex-1 truncate">{status}</span>
            {canWithdraw && (
              <button type="button" className="shrink-0 font-semibold text-ink2 underline-offset-2 hover:underline" onClick={withdraw} disabled={pending}>Withdraw</button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
