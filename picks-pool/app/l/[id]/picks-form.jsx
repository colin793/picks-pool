'use client';

import { useMemo, useState } from 'react';
import { savePicks } from '../../../lib/actions';

const fmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});

export default function PicksForm({ leagueId, season, week, games, initialPicks, initialTiebreaker, entered }) {
  const [picks, setPicks] = useState(initialPicks);
  const [tb, setTb] = useState(initialTiebreaker);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  const now = Date.now();
  const lastGame = games[games.length - 1];
  const tbLocked = lastGame ? new Date(lastGame.kickoff).getTime() <= now : true;
  const openCount = useMemo(() => games.filter((g) => new Date(g.kickoff).getTime() > now).length, [games, now]);

  async function submit() {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await savePicks(leagueId, season, week, picks, tb);
      setSaved(true);
    } catch (e) {
      setErr(e?.message ?? 'Save failed, try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      {games.map((g) => {
        const locked = new Date(g.kickoff).getTime() <= now;
        const mine = picks[g.id];
        return (
          <div key={g.id}>
            <div className="game">
              <button
                type="button"
                className={`side${mine === 'AWAY' ? ' on' : ''}`}
                disabled={locked}
                onClick={() => setPicks((p) => ({ ...p, [g.id]: 'AWAY' }))}
              >
                {g.away_abbr} {g.away_name}{g.state !== 'pre' ? ` ${g.away_score}` : ''}
              </button>
              <span className="at">@</span>
              <button
                type="button"
                className={`side${mine === 'HOME' ? ' on' : ''}`}
                disabled={locked}
                onClick={() => setPicks((p) => ({ ...p, [g.id]: 'HOME' }))}
              >
                {g.home_abbr} {g.home_name}{g.state !== 'pre' ? ` ${g.home_score}` : ''}
              </button>
            </div>
            <div className="meta">
              {locked
                ? g.state === 'post' ? 'Final' : g.state === 'in' ? 'Live' : 'Locked'
                : fmt.format(new Date(g.kickoff))}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 16 }}>
        <label>
          Tiebreaker: total points in {lastGame ? `${lastGame.away_abbr} @ ${lastGame.home_abbr}` : 'the final game'}
        </label>
        <input
          type="number" min="0" max="150" value={tb} disabled={tbLocked}
          onChange={(e) => setTb(e.target.value)} placeholder="e.g. 44"
        />
      </div>

      <button className="btn" onClick={submit} disabled={saving || (openCount === 0 && tbLocked)}>
        {saving ? 'Saving…' : entered ? 'Update picks' : 'Submit picks'}
      </button>
      {saved && <span className="badge green" style={{ marginLeft: 8 }}>saved</span>}
      {err && <p className="err">{err}</p>}
      <p className="note">Each game locks at its own kickoff. The tiebreaker locks when the last game kicks off.</p>
    </div>
  );
}
