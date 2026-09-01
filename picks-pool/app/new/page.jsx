import { redirect } from 'next/navigation';
import { currentUser } from '../../lib/supabase';
import { createLeague } from '../../lib/actions';

export const dynamic = 'force-dynamic';

export default async function NewLeague() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/new');

  return (
    <div className="wrap">
      <h1>Create a league</h1>
      <form action={createLeague} className="card">
        <label>League name</label>
        <input type="text" name="name" required placeholder="Draft With Purpose" />
        <label>Your Venmo handle (players pay their weekly entry here)</label>
        <input type="text" name="venmo" placeholder="@your-venmo" />
        <button className="btn">Create league</button>
      </form>
      <p className="note">You become the commissioner. Branding, entry fee, and the rest live in the Admin tab.</p>
    </div>
  );
}
