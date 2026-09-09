import Link from 'next/link';
import { TabBar } from './LeagueNav';
import { Icon } from './icons';
import { rgbTriple } from '../../lib/color';
import { signOut } from '../../lib/actions';
import InstallPrompt from './InstallPrompt';
import PushPrompt from './PushPrompt';
import Desk from './Desk';
import Rail from './Rail';
import TopTabs from './TopTabs';
import ChatDock from './ChatDock';

// The league frame. Desktop: the rail of your leagues on the left, this
// league in the middle with its tabs across the top, chat docked on the right
// on wide screens. Phone: header + tab bar, as before. Pure presentation;
// app/l/[id]/layout.jsx feeds it real data, /dev feeds fixtures.
export default function LeagueShell({ league, sport, slate, profile, isCommish, base, children, signOutAction = signOut, demo = false, rail = [], live = false, chat = null }) {
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
  const dock = chat ? <ChatDock leagueId={league.id} chatHref={`${base}/chat`} initial={chat.initial ?? null} demo={demo} /> : null;

  return (
    <div style={{ '--c1-rgb': rgbTriple(league.color1), '--c2-rgb': rgbTriple(league.color2, '17 24 39') }}>
      <Desk rail={<Rail leagues={rail} currentId={league.id} profile={profile} signOutAction={signOutAction} helpHref={`${base}/help`} />} dock={dock}>
        <div className="min-w-0">
          <header className="bg-brand px-4 py-3 text-white lg:hidden" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
            <div className="mx-auto flex max-w-2xl items-center gap-3">
              <div className="min-w-0 flex-1">{brand}</div>
              <Link href={`${base}/help`} className="rounded-md p-1.5 text-white/70 hover:bg-white/10" aria-label="How to play"><Icon.help /></Link>
              <Link href="/settings" className="rounded-md p-1.5 text-white/70 hover:bg-white/10" aria-label="Your settings"><Icon.admin /></Link>
              <Link href="/?all=1" className="rounded-md p-1.5 text-white/70 hover:bg-white/10" aria-label="My leagues"><Icon.home /></Link>
            </div>
          </header>

          {/* Desktop: the league's own header and tabs across the top of the center pane. */}
          <div className="hidden border-b border-line bg-surface px-6 pt-4 lg:block">
            <div className="mx-auto max-w-[1400px]">
              <div className="mb-3 flex items-center gap-3">
                {league.logo_url
                  ? <img src={league.logo_url} alt="" className="h-10 w-10 rounded-md object-contain" />
                  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md font-display text-xl font-bold text-white" style={{ background: league.color2 }}>{league.name.slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <h1 className="truncate font-display text-2xl font-bold leading-none tracking-tight">{league.name}</h1>
                  <div className="mt-0.5 text-xs text-muted">{sport.name}{slate ? ` · ${slate.label}` : ''}{isCommish ? ' · you run this one' : ''}</div>
                </div>
                {live && <span className="pill pill-warn">Live</span>}
              </div>
              <TopTabs base={base} isCommish={isCommish} survivor={Boolean(league.survivor)} draft={Boolean(league.draft)} hasDock={Boolean(dock)} />
            </div>
          </div>

          <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-5 lg:px-6 lg:pb-10 lg:pt-6">
            <InstallPrompt />
            <PushPrompt publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} demo={demo} />
            {children}
          </main>
        </div>
      </Desk>
      <TabBar base={base} isCommish={isCommish} survivor={Boolean(league.survivor)} draft={Boolean(league.draft)} />
    </div>
  );
}
