import Link from 'next/link';
import { Icon } from './icons';

// The left rail on desktop: yours, not the league's. Every league you are
// in with a line on where you stand, a way in to a new one, and you at the
// bottom. leagues: [{ id, name, sport, logo_url, color1, color2, line, live }].
export default function Rail({ leagues, currentId, profile, signOutAction, helpHref }) {
  return (
    <aside className="hidden border-r border-white/5 bg-brand text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col" style={{ '--c2-rgb': '17 24 39' }}>
      <div className="flex items-center gap-2 px-4 pb-3 pt-5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-white/10 text-base">🏈</span>
        <span className="font-display text-lg font-bold tracking-tight">Picks Pool</span>
      </div>
      <div className="eyebrow px-4 pb-1 !text-white/40">Leagues</div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {leagues.map((l) => {
          const on = l.id === currentId;
          return (
            <Link key={l.id} href={`/l/${l.id}`} aria-current={on ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 transition ${on ? 'bg-white/10' : 'hover:bg-white/5'}`}>
              <span className="relative shrink-0">
                {l.logo_url
                  ? <img src={l.logo_url} alt="" className="h-9 w-9 rounded-md bg-white/10 object-contain p-0.5" />
                  : <span className="grid h-9 w-9 place-items-center rounded-md font-display text-lg font-bold text-white" style={{ background: l.color1 }}>{l.name.slice(0, 1).toUpperCase()}</span>}
                {l.live && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-good ring-2 ring-brand" title="Games on now" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${on ? 'text-white' : 'text-white/80'}`}>{l.name}</span>
                <span className="block truncate text-[11px] text-white/50">{l.line}</span>
              </span>
            </Link>
          );
        })}
        <div className="flex gap-1 px-1 pt-1">
          <Link href="/new" className="flex-1 rounded-lg border border-dashed border-white/15 px-2 py-1.5 text-center text-xs font-semibold text-white/60 hover:border-white/40 hover:text-white">+ New league</Link>
          <Link href="/?all=1" className="flex-1 rounded-lg border border-dashed border-white/15 px-2 py-1.5 text-center text-xs font-semibold text-white/60 hover:border-white/40 hover:text-white">Join</Link>
        </div>
      </nav>
      <div className="space-y-1 border-t border-white/10 px-2 py-3">
        <Link href={helpHref} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white">
          <Icon.help /> How to play
        </Link>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/70">
          <Link href="/settings" className="flex min-w-0 flex-1 items-center gap-3 rounded-md hover:text-white" title="Your settings: name, emoji, Venmo, notifications, look">
            <span className="text-lg">{profile?.emoji}</span>
            <span className="min-w-0 flex-1 truncate">{profile?.display_name}</span>
            <Icon.admin className="shrink-0 opacity-70" />
          </Link>
          <form action={signOutAction}><button className="text-xs text-white/50 hover:text-white">Sign out</button></form>
        </div>
      </div>
    </aside>
  );
}
