'use client';

import { useMemo, useState, useTransition } from 'react';
import { saveSurvivorPick, clearSurvivorPick, withdrawSurvivor } from '../../lib/actions';
import { contrastText } from '../../lib/stats';
import { rankedAbbr } from '../../lib/featured';
import { lineText } from '../../lib/line';
import LocalTime, { useNow } from './LocalTime';

function dayOf(iso) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(iso));
}

// Choose one team from this slate. `used` is [team, slateLabel] pairs for
// teams already burned this season; `initial` is the saved pick, if any.
// One tap selects, Save commits: the database refuses a started game or a
// reused team, and the message says which.
export default function SurvivorPicker({ leagueId, season, slateKey, slateLabel, games, used = [], initial = null, entered = false, open = true, serverNow, fixedNow, homeFirst = false, demo = false }) {
  const [sel, setSel] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [msg, setMsg] = useState(null);
  const [pending, start] = useTransition();
  const ticking = useNow(serverNow);
  const now = fixedNow ?? ticking;
  const usedMap = useMemo(() => new Map(used), [used]);
  const savedGame = saved ? games.find((g) => g.id === saved.gameId) : null;
  const savedLocked = savedGame ? new Date(savedGame.kickoff).getTime() <= now : false;
  const openGames = games.filter((g) => new Date(g.kickoff).getTime() > now);
  // Once the game you picked has kicked off, your week is settled: nothing else is offered.
  const dirty = !savedLocked && Boolean(sel) && (sel.gameId !== saved?.gameId || sel.side !== saved?.side);

  const groups = useMemo(() => {
    const m = new Map();
    for (const g of games) { const k = dayOf(g.kickoff); if (!m.has(k)) m.set(k, []); m.get(k).push(g); }
    return [...m.entries()];
  }, [games]);

  const teamOf = (g, side) => (side === 'HOME' ? g.home_abbr : g.away_abbr);
  const label = (p) => { const g = p && games.find((x) => x.id === p.gameId); return g ? teamOf(g, p.side) : ''; };

  function save() {
    if (!sel || demo) return;
    setMsg(null);
    start(async () => {
      try {
        await saveSurvivorPick(leagueId, season, slateKey, sel.gameId, sel.side);
        setSaved(sel);
        setMsg({ kind: 'ok', text: `${label(sel)} is your ${slateLabel} team.` });
      } catch (e) { setMsg({ kind: 'err', text: e?.message ?? 'Save failed, try again.' }); }
    });
  }
  function clear() {
    if (demo) return;
    start(async () => {
      try { await clearSurvivorPick(leagueId, season, slateKey); setSaved(null); setSel(null); setMsg({ kind: 'ok', text: 'Pick cleared. You still need a team this week.' }); }
      catch (e) { setMsg({ kind: 'err', text: e?.message ?? 'Could not clear.' }); }
    });
  }
  function leave() {
    if (demo || !confirm('Leave the survivor pool? Your picks are deleted and your buy-in is off the table.')) return;
    start(async () => {
      try { await withdrawSurvivor(leagueId, season); }
      catch (e) { setMsg({ kind: 'err', text: e?.message ?? 'Could not leave.' }); }
    });
  }

  const side = (g, which, locked) => {
    const abbr = teamOf(g, which);
    const name = which === 'HOME' ? g.home_name : g.away_name;
    const logo = which === 'HOME' ? g.home_logo : g.away_logo;
    const color = which === 'HOME' ? g.home_color : g.away_color;
    const rank = which === 'HOME' ? g.home_rank : g.away_rank;
    const usedIn = usedMap.get(abbr);
    const burned = Boolean(usedIn) && !(saved && saved.gameId === g.id && saved.side === which);
    const on = sel?.gameId === g.id && sel?.side === which;
    const off = locked || burned || savedLocked;
    return (
      <button type="button" key={which} disabled={off} aria-pressed={on}
        onClick={() => setSel(on ? null : { gameId: g.id, side: which })}
        style={on && color ? { background: color, color: contrastText(color), borderColor: color } : undefined}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border-2 px-2 py-2 text-left transition
          ${on ? 'border-accent bg-accent text-white shadow-sm' : 'border-line bg-surface'}
          ${off ? 'cursor-default opacity-50' : 'cursor-pointer hover:border-ink2/40 active:scale-[.985]'}`}
      >
        {logo ? <img src={logo} alt="" width={26} height={26} loading="lazy" className="h-[26px] w-[26px] shrink-0 object-contain" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
          : <span className="h-[26px] w-[26px] shrink-0 rounded-full bg-surface2" />}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-display text-base font-bold tracking-wide">{rankedAbbr(abbr, rank)}</span>
          <span className={`block truncate text-[11px] ${on ? 'opacity-90' : 'text-muted'}`}>{burned ? `Used · ${usedIn}` : name}</span>
        </span>
      </button>
    );
  };

  const status = msg
    ? <span className={msg.kind === 'ok' ? 'text-good' : 'text-bad'}>{msg.text}</span>
    : saved && savedGame
      ? <>Your {slateLabel} team: <strong className="text-ink">{label(saved)}</strong>{savedLocked ? ' · locked in, no changes this week' : <> · locks <LocalTime iso={savedGame.kickoff} /></>}</>
      : sel ? <>Tap Save to lock in <strong className="text-ink">{label(sel)}</strong>.</>
      : openGames.length ? <>{used.length ? `${used.length} team${used.length === 1 ? '' : 's'} burned. ` : ''}Pick one team to win this week.</> : 'Nothing left to pick this week.';

  return (
    <div className="space-y-4">
      {groups.map(([day, gs]) => (
        <section key={day}>
          <h3 className="eyebrow mb-2">{day}</h3>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))]">
            {gs.map((g) => {
              const locked = new Date(g.kickoff).getTime() <= now;
              const first = homeFirst ? 'HOME' : 'AWAY', second = homeFirst ? 'AWAY' : 'HOME';
              const line = !locked && lineText(g);
              return (
                <div key={g.id} className={`min-w-0 rounded-xl border bg-surface2/60 p-2 ${g.state === 'in' ? 'border-accent/50' : 'border-line'}`}>
                  <div className="flex items-stretch gap-1.5">
                    {side(g, first, locked)}
                    <span className="self-center text-xs font-semibold text-muted">{homeFirst ? 'v' : '@'}</span>
                    {side(g, second, locked)}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 px-1 text-[11px] text-muted">
                    <span className="truncate">
                      {g.state === 'post' ? <span className="font-semibold text-ink2">{g.status_detail || 'Final'} · {g.away_abbr} {g.away_score}, {g.home_abbr} {g.home_score}</span>
                        : g.state === 'in' ? <span className="font-semibold text-accent">{g.status_detail || 'Live'} · {g.away_abbr} {g.away_score}, {g.home_abbr} {g.home_score}</span>
                        : <LocalTime iso={g.kickoff} />}
                      {line ? <span className="ml-2">{line}</span> : ''}
                    </span>
                    {locked && g.state === 'pre' && <span className="pill pill-muted">Locked</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface2/60 px-3 py-2">
        <span className="min-w-0 flex-1 text-xs text-muted">{status}</span>
        {saved && !savedLocked && !dirty && <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={pending}>Clear pick</button>}
        {entered && open && <button type="button" className="btn btn-ghost btn-sm" onClick={leave} disabled={pending}>Leave pool</button>}
        <button type="button" className="btn" onClick={save} disabled={pending || !dirty}>
          {pending ? 'Saving…' : saved ? 'Change pick' : entered ? 'Save pick' : 'Enter with this pick'}
        </button>
      </div>
    </div>
  );
}
