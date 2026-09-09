'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { loadChat, postMessage } from '../../lib/actions';
import { fmtLocal } from '../../lib/time';
import { useDock } from './Desk';

const GRADE = { hit: 'pill-good', miss: 'pill-bad', pending: 'pill-muted' };

// The chat, docked on the right of the desk. Polls every 15 seconds while
// the tab is visible; posts through the same action as the Chat tab.
export default function ChatDock({ leagueId, chatHref, initial = null, demo = false }) {
  const [feed, setFeed] = useState(initial);
  const [pending, start] = useTransition();
  const { toggle } = useDock();
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (demo) return undefined;
    let timer;
    const pull = async () => { try { setFeed(await loadChat(leagueId)); } catch { /* keep what we have */ } };
    const loop = () => { clearTimeout(timer); if (!document.hidden) timer = setTimeout(async () => { await pull(); loop(); }, 15_000); };
    pull(); loop();
    const vis = () => { if (!document.hidden) pull(); loop(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', vis); };
  }, [leagueId, demo]);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [feed]);

  const items = feed
    ? [...feed.messages.map((m) => ({ kind: 'msg', at: m.created_at, m })), ...feed.calls.map((c) => ({ kind: 'call', at: c.created_at, c }))].sort((a, b) => new Date(a.at) - new Date(b.at))
    : [];
  const name = (id) => feed?.names?.[id] ?? {};

  function send(formData) {
    const body = String(formData.get('body') || '').trim();
    if (!body || demo) return;
    if (inputRef.current) inputRef.current.value = '';
    start(async () => { try { await postMessage(leagueId, formData); setFeed(await loadChat(leagueId)); } catch { /* the next poll catches up */ } });
  }

  return (
    <aside className="sticky top-0 flex h-screen flex-col border-l border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <h2 className="h2 flex-1">Chat</h2>
        <a href={chatHref} className="text-xs font-semibold text-muted hover:text-ink" title="Open the full chat tab">Expand</a>
        <button type="button" onClick={toggle} className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-ink" aria-label="Unpin the chat" title="Unpin">📌</button>
      </div>
      <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
        {!feed && <li className="py-8 text-center text-xs text-muted">Loading the room…</li>}
        {feed && items.length === 0 && <li className="py-8 text-center text-xs text-muted">Nothing yet. Say something about somebody&rsquo;s picks.</li>}
        {items.map((it) => {
          if (it.kind === 'call') {
            const c = it.c, p = name(c.user_id);
            return (
              <li key={`c-${c.id}`} className={`rounded-lg border px-2.5 py-1.5 ${c.grade === 'hit' ? 'border-good/40 bg-goodsoft/40' : c.grade === 'miss' ? 'border-bad/40 bg-badsoft/40' : 'border-warn/40 bg-warnsoft/40'}`}>
                <div className="flex items-center gap-1.5 text-[11px] text-muted"><span>{p.emoji}</span><span className="font-semibold text-ink2">{p.display_name ?? 'Player'}</span> called it <span className={`pill ${GRADE[c.grade]} ml-auto`}>{c.grade === 'pending' ? 'on record' : c.grade}</span></div>
                <div className="font-display text-base font-bold leading-tight">{c.text} <span className="text-xs font-semibold text-muted">{c.matchup}</span></div>
                {c.body && <div className="text-xs text-ink2">{c.body}</div>}
              </li>
            );
          }
          const m = it.m, p = name(m.user_id), mine = m.user_id === feed.me;
          return (
            <li key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse text-right' : ''}`}>
              <span className="mt-0.5 text-base" aria-hidden>{p.emoji ?? '👤'}</span>
              <div className="min-w-0 max-w-[85%]">
                <div className="text-[11px] text-muted"><span className="font-semibold text-ink2">{p.display_name ?? 'Former member'}</span> · {fmtLocal(m.created_at, { hour: 'numeric', minute: '2-digit' })}</div>
                <p className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 ${mine ? 'bg-accent text-white' : 'bg-surface2 text-ink'}`}>{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <form action={send} className="flex gap-2 border-t border-line p-2.5">
        <input ref={inputRef} className="input flex-1 !py-2" name="body" maxLength={500} placeholder="Message the league" autoComplete="off" required disabled={pending} />
        <button className="btn !px-3" disabled={pending}>Send</button>
      </form>
    </aside>
  );
}
