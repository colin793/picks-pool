'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';

// One nav definition, two renderings: sidebar on desktop, tab bar on phones.
export function navItems(base, isCommish, survivor = false, draft = false) {
  const items = [
    { href: base, label: 'Picks', icon: 'picks', exact: true },
    { href: `${base}/board`, label: 'This week', icon: 'board' },
    ...(survivor ? [{ href: `${base}/survivor`, label: 'Survivor', icon: 'survivor' }] : []),
    ...(draft ? [{ href: `${base}/draft`, label: 'Draft', icon: 'draft' }] : []),
    { href: `${base}/season`, label: 'Season', icon: 'season' },
    { href: `${base}/chat`, label: 'Chat', icon: 'chat' },
  ];
  if (isCommish) items.push({ href: `${base}/admin`, label: 'Admin', icon: 'admin' });
  return items;
}

function isOn(pathname, item) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function SidebarNav({ base, isCommish, slateLabel, survivor = false, draft = false }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {navItems(base, isCommish, survivor, draft).map((it) => {
        const I = Icon[it.icon];
        const on = isOn(pathname, it);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition
              ${on ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
          >
            <span className={`h-5 w-1 rounded-full -ml-3 ${on ? 'bg-accent' : 'bg-transparent'}`} />
            <I className="opacity-90" />
            <span className="flex-1">{it.label === 'This week' && slateLabel ? slateLabel : it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ base, isCommish, survivor = false, draft = false }) {
  const pathname = usePathname();
  const items = navItems(base, isCommish, survivor, draft);
  const tight = items.length > 5; // every mode on: smaller labels so seven tabs fit a phone
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => {
          const I = Icon[it.icon];
          const on = isOn(pathname, it);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={on ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 font-semibold ${tight ? 'text-[10px]' : 'text-[11px]'} ${on ? 'text-accent' : 'text-muted'}`}
            >
              <I />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
