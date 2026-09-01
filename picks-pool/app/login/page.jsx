'use client';

import { useState } from 'react';
import { sbBrowser } from '../../lib/supabaseBrowser';

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [msg, setMsg] = useState('');

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
    <div className="hero">
      <div className="authcard">
        <div className="mark">🏈</div>
        <h1>Picks Pool</h1>
        <p className="tag">Pick winners. A buck a week. Most correct takes the pot.</p>
        {state === 'sent' ? (
          <p style={{ textAlign: 'center' }}>
            Check your email.<br />
            <span className="note">The sign-in link lands in a minute or two. First time? Peek at spam.</span>
          </p>
        ) : (
          <form onSubmit={send}>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
            <button className="btn" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            {state === 'error' && <p className="err">{msg}</p>}
          </form>
        )}
      </div>
      <div className="feats">
        <div className="feat"><span>📺</span>Live scores</div>
        <div className="feat"><span>💸</span>Venmo the pot</div>
        <div className="feat"><span>📅</span>Play any week</div>
      </div>
      <p className="foot">No passwords. You get a link, you tap it, you're in.</p>
    </div>
  );
}
