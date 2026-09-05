import { ImageResponse } from 'next/og';
import { admin } from '../../../lib/supabase';
import { sport as sportOf } from '../../../lib/scores/sports';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The picture under an invite link when it is pasted into a text thread.
// Public by nature (the link is), so it carries the name and sport only.
export default async function Image({ params }) {
  const { data: league } = await admin().from('leagues').select('name, sport, color1, color2').eq('invite_code', params.code.toLowerCase()).maybeSingle();
  const name = league?.name ?? 'Picks Pool';
  const sport = league ? sportOf(league.sport).name : '';
  const c1 = league?.color1 || '#1d4ed8';
  const c2 = league?.color2 || '#111827';
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: c2, color: 'white', fontFamily: 'sans-serif', padding: 72 }}>
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, opacity: 0.7, textTransform: 'uppercase' }}>{`You're invited${sport ? ` · ${sport}` : ''}`}</div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05, marginTop: 14 }}>{name}</div>
        <div style={{ display: 'flex', marginTop: 28, background: c1, color: 'white', fontSize: 28, fontWeight: 700, padding: '10px 22px', borderRadius: 999, width: 'fit-content' }}>Pick winners with friends. Most correct takes the pot.</div>
        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 22, opacity: 0.55 }}>Picks Pool</div>
      </div>
    ),
    size
  );
}
