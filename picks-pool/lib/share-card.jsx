import { ImageResponse } from 'next/og';
import { slateResults, potFor, money } from './stats';

// A standings card for the group text: 1200x630, league colors, no emoji
// (the image renderer would need a font for them; names carry enough).
export function shareCard({ league, sport, label, games, entries, picks, names }) {
  const { rows, complete, winners, live, finals } = slateResults(games, entries, picks);
  const { pot } = potFor(entries, league.entry_fee_cents, winners);
  const top = rows.slice(0, 10);
  const status = complete ? 'Final' : live ? `Live · ${finals} of ${games.length} final` : finals ? `${finals} of ${games.length} final` : 'Picks are in';
  const c1 = league.color1 || '#1d4ed8';
  const c2 = league.color2 || '#111827';
  const name = (r) => names.get(r.user_id)?.display_name ?? 'Player';

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: c2, color: 'white', fontFamily: 'sans-serif', padding: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 22, letterSpacing: 4, opacity: 0.7, textTransform: 'uppercase' }}>{`${sport.name} · ${label}`}</div>
            <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>{league.name}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 22, opacity: 0.7 }}>Pot</div>
            <div style={{ fontSize: 48, fontWeight: 700 }}>{money(pot)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <div style={{ background: c1, color: 'white', fontSize: 20, fontWeight: 700, padding: '4px 14px', borderRadius: 999 }}>{status}</div>
          {complete && winners.length > 0 && (
            <div style={{ fontSize: 22, opacity: 0.9 }}>{`${winners.map((w) => name(w)).join(' & ')} ${winners.length > 1 ? 'split it' : 'takes it'}`}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24, borderTop: '2px solid rgba(255,255,255,.15)' }}>
          {top.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.1)', fontSize: 30 }}>
              <div style={{ width: 60, opacity: 0.6 }}>{String(r.rank)}</div>
              <div style={{ flex: 1, fontWeight: i === 0 ? 700 : 500 }}>{name(r)}</div>
              <div style={{ width: 120, textAlign: 'right', color: '#7ee2a2', fontWeight: 700 }}>{String(r.correct)}</div>
              <div style={{ width: 120, textAlign: 'right', opacity: 0.55 }}>{String(r.incorrect)}</div>
              {live > 0 && <div style={{ width: 140, textAlign: 'right', color: '#9cc4ff' }}>{r.leading ? `▲ ${r.leading}` : ''}</div>}
            </div>
          ))}
          {rows.length > top.length && <div style={{ fontSize: 22, opacity: 0.6, paddingTop: 10 }}>{`and ${rows.length - top.length} more`}</div>}
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 20, opacity: 0.55 }}>Picks Pool</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
