'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from './LeagueNav';
import { Icon } from './icons';
import { useDock } from './Desk';

// The league's tabs across the top of the center pane (desktop). When the
// chat is docked on the right, the Chat tab steps aside; the pin brings the
// dock back.
export default function TopTabs({ base, isCommish, survivor = false, draft = false, hasDock = false }) {
  const pathname = usePathname();
  const { open, toggle } = useDock();
  const items = navItems(base, isCommish, survivor, draft);
  return (
    <div className="flex items-center gap-1 border-b border-line">
      {items.map((it) => {
        const on = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        const I = Icon[it.icon];
        const hide = hasDock && open && it.icon === 'chat' ? 'xl:hidden' : '';
        return (
          <Link key={it.href} href={it.href} aria-current={on ? 'page' : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${hide} ${on ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
            <I className="h-[18px] w-[18px]" /> {it.label}
          </Link>
        );
      })}
      {hasDock && (
        <button type="button" onClick={toggle} aria-pressed={open} title={open ? 'Unpin the chat' : 'Pin the chat to the right'}
          className={`ml-auto hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold xl:flex ${open ? 'text-accent' : 'text-muted hover:text-ink'}`}>
          <Icon.chat className="h-4 w-4" /> {open ? 'Docked' : 'Dock chat'}
        </button>
      )}
    </div>
  );
}
