'use client';

import { useRouter, useSearchParams } from 'next/navigation';

// Preview only. Bumps ?bump=N with a soft navigation, so the page re-renders
// with new scores while every component stays mounted: exactly what a live
// refresh does on a real Sunday.
export default function DevBump() {
  const router = useRouter();
  const params = useSearchParams();
  const next = new URLSearchParams(params.toString());
  next.set('bump', String(Number(params.get('bump') ?? 0) + 1));
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/dev?${next}`, { scroll: false })}>
      Simulate a score
    </button>
  );
}
