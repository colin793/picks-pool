'use client';

import { useEffect, useState } from 'react';
import { sbBrowser } from '../../lib/supabaseBrowser';

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [msg, setMsg] = useState('');
  const [linkError, setLinkError] = useState(false);
  useEffect(() => { setLinkError(Boolean(new URLSearchParams(location.search).get('error'))); }, []);

  async function send(e) {
    e.preventDefault();
    setState('sending');
    const next = new URLSearchParams(location.search).get('next') || '/';
    const { error } = await sbBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    if (error) { setState('error'); setMsg(error.message); }
    else setState('sent');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f172a] px-4 py-10 text-white"
      style={{ backgroundImage: 'radial-gradient(1200px 600px at 50% -10%, rgba(29,78,216,.55), transparent 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/icon.png" alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-lg" />
          <h1 className="font-display text-4xl font-bold tracking-tight">Picks Pool</h1>
          <p className="mt-1 text-sm text-white/70">Pick winners. A buck a week. Most correct takes the pot.</p>
        </div>
        <div className="rounded-2xl bg-white p-6 text-ink shadow-2xl" style={{ '--ink-rgb': '20 25 32', '--muted-rgb': '111 122 137', '--line-rgb': '225 229 235', '--surface-rgb': '255 255 255', '--ink-2-rgb': '74 84 98', '--c1-rgb': '29 78 216', '--bad-rgb': '179 38 30' }}>
          {state === 'sent' ? (
            <div className="text-center">
              <p className="font-semibold">Check your email.</p>
              <p className="mt-1 text-sm text-muted">The sign-in link lands in a minute or two. First time? Peek at spam.</p>
            </div>
          ) : (
            <form onSubmit={send}>
              <label className="label !mt-0">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
              <button className="btn mt-3 w-full" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
              </button>
              {state === 'error' && <p className="mt-2 text-sm text-bad">{msg}</p>}
              {linkError && state !== 'error' && (
                <p className="mt-2 text-sm text-bad">That link expired or was already used. Send a new one.</p>
              )}
            </form>
          )}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-white/80">
          <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-3"><span className="block text-xl">📺</span>Live scores</div>
          <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-3"><span className="block text-xl">💸</span>Venmo the pot</div>
          <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-3"><span className="block text-xl">🏈</span>Any sport</div>
        </div>
        <p className="mt-5 text-center text-xs text-white/50">No passwords. You get a link, you tap it, you&rsquo;re in.</p>
      </div>
    </div>
  );
}
