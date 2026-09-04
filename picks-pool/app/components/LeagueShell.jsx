import Link from 'next/link';
import { SidebarNav, TabBar } from './LeagueNav';
import { Icon } from './icons';
import { rgbTriple } from '../../lib/color';
import { signOut } from '../../lib/actions';
import InstallPrompt from './InstallPrompt';
import PushPrompt from './PushPrompt';

// The league frame: sidebar on desktop, header + tab bar on phones. Pure
// presentation; app/l/[id]/layout.jsx feeds it real data, /dev feeds fixtures.
export default function LeagueShell({ league, sport, slate, profile, isCommish, base, children, signOutAction = signOut, demo = false }) {
  const brand = (
    <div className="flex min-w-0 items-center gap-3">
      {league.logo_url ? (
        <img src={league.logo_url} alt="" className="h-9 w-9 rounded-md bg-white/10 object-contain p-0.5" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent font-display text-lg font-bold text-white">
          {league.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate font-display text-lg font-bold leading-tight text-white">{league.name}</div>
        <div className="text-[11px] uppercase tracking-wider text-white/60">{sport.name}{slate ? ` · ${slate.label}` : ''}</div>
      </div>
    </div>
  );

  return (
    <div
      style={{ '--c1-rgb': rgbTriple(league.color1), '--c2-rgb': rgbTriple(league.color2, '17 24 39') }}
      className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]"
    >
      <aside className="hidden border-r border-white/5 bg-brand px-4 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        {brand}
        <div className="mt-6 flex-1">
          <SidebarNav base={base} isCommish={isCommish} slateLabel={slate?.label} />
        </div>
        <div className="space-y-1 border-t border-white/10 pt-4">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white">
            <Icon.home /> My leagues
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/70">
            <span className="text-lg">{profile?.emoji}</span>
            <span className="flex-1 truncate">{profile?.display_name}</span>
            <form action={signOutAction}><button className="text-xs text-white/50 hover:text-white">Sign out</button></form>
          </div>
        </div>
      </aside>

      <header className="bg-brand px-4 py-3 text-white lg:hidden" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1">{brand}</div>
          <Link href="/" className="rounded-md p-1.5 text-white/70 hover:bg-white/10" aria-label="My leagues"><Icon.home /></Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
        <InstallPrompt />
        <PushPrompt publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} demo={demo} />
        {children}
      </main>
      <TabBar base={base} isCommish={isCommish} />
    </div>
  );
}
