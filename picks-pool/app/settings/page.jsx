import { redirect } from 'next/navigation';
import { sb, currentUser } from '../../lib/supabase';
import { saveProfile } from '../../lib/actions';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { data: p } = await sb().from('profiles').select('*').eq('id', user.id).single();

  return (
    <div className="wrap">
      <h1>My settings</h1>
      <form action={saveProfile} className="card">
        <label>Display name</label>
        <input type="text" name="display_name" defaultValue={p?.display_name ?? ''} required />
        <label>Emoji avatar</label>
        <input type="text" name="emoji" defaultValue={p?.emoji ?? '🏈'} maxLength={8} />
        <label>Venmo handle (so the winner link points at you when you win)</label>
        <input type="text" name="venmo_handle" defaultValue={p?.venmo_handle ?? ''} placeholder="@your-venmo" />
        <button className="btn">Save</button>
      </form>
    </div>
  );
}
