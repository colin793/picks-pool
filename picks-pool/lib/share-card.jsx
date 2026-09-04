import { ImageResponse } from 'next/og';
import { slateResults, potFor, money } from './stats';

// A standings card for the group text: 1200x630, league colors, no emoji
// (the image renderer would need a font for them; names carry enough).
export function shareCard({ league, sport, label, games, entries, picks, names }) {
  const { rows, complete, winners, live, finals } = slateResults(games, entries, picks);
  const { pot } = potFor(entries, league.entry_fee_cents, winners);
  const top = rows.slice(0, 8);
  // Rows share ~330px under the header; size them to the count so eight fit.
  const rowH = Math.max(34, Math.min(54, Math.floor(330 / Math.max(top.length, 1))));
  const rowFont = rowH >= 50 ? 28 : rowH >= 42 ? 24 : 20;
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
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 16, letterSpacing: 2, opacity: 0.55, textTransform: 'uppercase', paddingBottom: 6, borderBottom: '2px solid rgba(255,255,255,.15)' }}>
            <div style={{ width: 60 }}>#</div>
            <div style={{ flex: 1 }}>Player</div>
            <div style={{ width: 120, textAlign: 'right' }}>Right</div>
            <div style={{ width: 120, textAlign: 'right' }}>Wrong</div>
            {live > 0 && <div style={{ width: 140, textAlign: 'right' }}>Leading</div>}
          </div>
          {top.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', height: rowH, borderBottom: '1px solid rgba(255,255,255,.1)', fontSize: rowFont }}>
              <div style={{ width: 60, opacity: 0.6 }}>{String(r.rank)}</div>
              <div style={{ flex: 1, fontWeight: i === 0 ? 700 : 500 }}>{name(r)}</div>
              <div style={{ width: 120, textAlign: 'right', color: '#7ee2a2', fontWeight: 700 }}>{String(r.correct)}</div>
              <div style={{ width: 120, textAlign: 'right', opacity: 0.55 }}>{String(r.incorrect)}</div>
              {live > 0 && <div style={{ width: 140, textAlign: 'right', color: '#9cc4ff' }}>{r.leading ? `+${r.leading}` : ''}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', fontSize: 18, opacity: 0.55 }}>
          <div>{rows.length > top.length ? `and ${rows.length - top.length} more` : ''}</div>
          <div>Picks Pool</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
