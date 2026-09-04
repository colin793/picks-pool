'use client';

import LocalTime from './LocalTime';
import { contrastText } from '../../lib/stats';
import { useFlash } from './Flash';
import { rankedAbbr } from '../../lib/featured';

// One matchup. `pick` is 'HOME' | 'AWAY' | undefined; `onPick(side)` when open.
export default function GameCard({ game: g, pick, onPick, now, draws = false, homeFirst = false }) {
  const locked = new Date(g.kickoff).getTime() <= now;
  const final = g.state === 'post';
  const live = g.state === 'in';
  const showScore = g.state !== 'pre';
  const pickedAbbr = pick === 'HOME' ? g.home_abbr : pick === 'AWAY' ? g.away_abbr : pick === 'TIE' ? 'a draw' : null;
  const won = final && pick && g.winner === pick;
  const tied = final && g.winner === 'TIE' && !draws; // a tie scores for nobody unless draws are pickable
  const level = g.home_score === g.away_score;
  // A refresh that changes a side's score makes that side glow: in team
  // color if it is your pick, quietly if it is the other one.
  const homeFlash = useFlash(g.home_score);
  const awayFlash = useFlash(g.away_score);
  const ahead = live && pick && (
    (pick === 'HOME' && g.home_score > g.away_score) || (pick === 'AWAY' && g.away_score > g.home_score) || (pick === 'TIE' && level));

  const side = (which) => {
    const isHome = which === 'HOME';
    const abbr = isHome ? g.home_abbr : g.away_abbr;
    const name = isHome ? g.home_name : g.away_name;
    const logo = isHome ? g.home_logo : g.away_logo;
    const color = isHome ? g.home_color : g.away_color;
    const score = isHome ? g.home_score : g.away_score;
    const rank = isHome ? g.home_rank : g.away_rank;
    const on = pick === which;
    const winner = final && g.winner === which;
    const flash = showScore && (isHome ? homeFlash : awayFlash);
    const style = {
      ...(on && color ? { background: color, color: contrastText(color), borderColor: color } : {}),
      '--glow': color || 'rgb(var(--c1-rgb))',
    };
    return (
      <button
        type="button"
        disabled={locked || !onPick}
        onClick={() => onPick?.(which)}
        aria-pressed={on}
        style={style}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border-2 px-2 py-2 text-left transition sm:gap-2.5 sm:px-2.5
          ${on ? 'border-accent bg-accent text-white shadow-sm' : 'border-line bg-surface hover:border-ink2/40'}
          ${locked ? 'cursor-default' : 'cursor-pointer active:scale-[.985]'}
          ${final && on && !winner && !tied ? 'opacity-60' : ''} disabled:hover:border-line
          ${flash ? (on ? 'flash' : 'flash-soft') : ''}`}
      >
        {logo ? (
          <img src={logo} alt="" width={30} height={30} loading="lazy"
            className="h-[26px] w-[26px] shrink-0 object-contain drop-shadow-sm sm:h-[30px] sm:w-[30px]"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        ) : (
          <span className="h-[26px] w-[26px] shrink-0 rounded-full bg-surface2 sm:h-[30px] sm:w-[30px]" />
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-display text-base font-bold tracking-wide sm:text-lg">
            {rank && <span className={`mr-1 text-xs font-semibold ${on ? 'opacity-80' : 'text-muted'}`}>#{rank}</span>}{abbr}
          </span>
          <span className={`block truncate text-[11px] ${on ? 'opacity-90' : 'text-muted'}`}>{name}</span>
        </span>
        {showScore && (
          <span className={`num text-lg sm:text-xl ${winner || live ? '' : 'opacity-60'}`}>{score}</span>
        )}
      </button>
    );
  };

  return (
    <div className={`rounded-xl border bg-surface2/60 p-2 ${live ? 'border-accent/50' : 'border-line'}`}>
      <div className="flex items-stretch gap-1.5 sm:gap-2">
        {side(homeFirst ? 'HOME' : 'AWAY')}
        {draws ? (
          <button
            type="button"
            disabled={locked || !onPick}
            onClick={() => onPick?.('TIE')}
            aria-pressed={pick === 'TIE'}
            title="Draw"
            className={`self-stretch rounded-lg border-2 px-1.5 font-display text-xs font-bold uppercase tracking-wide transition
              ${pick === 'TIE' ? 'border-ink2 bg-ink2 text-surface' : 'border-line bg-surface text-muted hover:border-ink2/40'}
              ${locked ? 'cursor-default' : 'cursor-pointer'} ${final && pick === 'TIE' && g.winner !== 'TIE' ? 'opacity-60' : ''}`}
          >
            <span className="block leading-none">Draw</span>
          </button>
        ) : (
          <span className="self-center text-xs font-semibold text-muted">{homeFirst ? 'v' : '@'}</span>
        )}
        {side(homeFirst ? 'AWAY' : 'HOME')}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-muted">
        <span className="truncate">
          {final ? <span className="font-semibold text-ink2">{g.status_detail || 'Final'}</span>
            : live ? <span className="font-semibold text-accent">{g.status_detail || 'Live'}</span>
            : <LocalTime iso={g.kickoff} />}
          {locked && pickedAbbr && (
            <span className={`ml-2 ${won ? 'text-good' : final && !tied ? 'text-bad' : ahead ? 'text-accent' : ''}`}>
              {final ? (won ? '✓' : tied ? '–' : '✗') : ahead ? '▲' : ''} you had {pickedAbbr}
            </span>
          )}
          {locked && !pickedAbbr && <span className="ml-2">no pick</span>}
        </span>
        {!final && !live && locked && <span className="pill pill-muted">Locked</span>}
        {!locked && !pick && onPick && <span className="shrink-0">Pick one</span>}
      </div>
    </div>
  );
}
