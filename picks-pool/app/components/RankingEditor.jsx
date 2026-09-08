'use client';

import { useMemo, useState, useTransition } from 'react';
import { saveRanking, leaveDraft } from '../../lib/actions';
import LocalTime from './LocalTime';

// Rank the slate's teams. Saved order first, the rest in the default order
// (favorites first); move a team with the arrows or send it to the top.
export default function RankingEditor({ leagueId, season, slateKey, teams, initial = null, entered = false, demo = false }) {
  const defaults = useMemo(() => teams.map((t) => t.key), [teams]);
  const [order, setOrder] = useState(() => {
    const saved = (initial ?? []).filter((k) => defaults.includes(k));
    return [...saved, ...defaults.filter((k) => !saved.includes(k))];
  });
  const [msg, setMsg] = useState(null);
  const [pending, start] = useTransition();
  const byKey = new Map(teams.map((t) => [t.key, t]));

  const move = (i, to) => setOrder((o) => { const n = [...o]; const [k] = n.splice(i, 1); n.splice(Math.max(0, Math.min(n.length, to)), 0, k); return n; });
  const save = () => { if (demo) return; setMsg(null); start(async () => { try { await saveRanking(leagueId, season, slateKey, order); setMsg({ ok: true, text: entered ? 'Ranking saved.' : "Saved. You're in this week's draft." }); } catch (e) { setMsg({ ok: false, text: e?.message ?? 'Could not save.' }); } }); };
  const leave = () => { if (demo || !confirm('Leave this week’s draft? Your ranking is deleted.')) return; start(async () => { try { await leaveDraft(leagueId, season, slateKey); } catch (e) { setMsg({ ok: false, text: e?.message }); } }); };

  return (
    <div>
      <ol className="divide-y divide-line rounded-lg border border-line">
        {order.map((k, i) => {
          const t = byKey.get(k);
          if (!t) return null;
          const tag = t.edge > 0 ? `-${t.edge}` : t.edge < 0 ? `+${-t.edge}` : '';
          return (
            <li key={k} className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <span className="num w-6 text-right text-muted">{i + 1}</span>
              {t.logo ? <img src={t.logo} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 object-contain" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <span className="h-[22px] w-[22px] shrink-0 rounded-full bg-surface2" />}
              <span className="min-w-0 flex-1 truncate"><span className="font-display text-base font-bold tracking-wide">{t.abbr}</span> <span className="text-xs text-muted">{t.opp}{tag ? ` · ${tag}` : ''} · <LocalTime iso={t.kickoff} /></span></span>
              <span className="flex shrink-0 gap-1">
                <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => move(i, 0)} disabled={i === 0} aria-label="To the top" title="To the top">⇈</button>
                <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Up">↑</button>
                <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label="Down">↓</button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`min-w-0 flex-1 text-xs ${msg ? (msg.ok ? 'text-good' : 'text-bad') : 'text-muted'}`}>{msg?.text ?? 'Favorites are on top to start. Change nothing and save, and you still draft the best team left each round.'}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOrder(defaults)} disabled={pending}>Reset</button>
        {entered && <button type="button" className="btn btn-ghost btn-sm" onClick={leave} disabled={pending}>Leave draft</button>}
        <button type="button" className="btn" onClick={save} disabled={pending}>{pending ? 'Saving…' : entered ? 'Save ranking' : "Save, I'm in"}</button>
      </div>
    </div>
  );
}
