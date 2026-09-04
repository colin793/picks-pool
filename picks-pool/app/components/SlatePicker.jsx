'use client';

import { useRouter, usePathname } from 'next/navigation';

export default function SlatePicker({ slates, current }) {
  const router = useRouter();
  const pathname = usePathname();
  if (slates.length < 2) return null;
  return (
    <select
      className="input !w-auto py-1.5 text-sm font-semibold"
      value={current}
      onChange={(e) => router.push(`${pathname}?slate=${encodeURIComponent(e.target.value)}`)}
      aria-label="Choose a slate"
    >
      {slates.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
    </select>
  );
}
