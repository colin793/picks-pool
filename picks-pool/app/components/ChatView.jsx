import LocalTime from './LocalTime';
import LiveRefresh from './LiveRefresh';
import { postMessage, deleteMessage, postCall, deleteCall } from '../../lib/actions';
import { callText, gradeCall, resultText } from '../../lib/calls';
import CallComposer from './CallComposer';

// The league's room. Server-rendered; LiveRefresh re-fetches every 15s so a
// new message shows up without anyone reloading. Oldest at the top, the
// composer at the bottom, like every chat you have ever used.
// calls: the room's calls (newest first); games: the games they are on plus
// this slate's, for the composer. Calls sit in the stream with the messages.
export default function ChatView({ leagueId, messages, names, me, isCommish, demo = false, calls = [], games = [], homeFirst = false, callsOn = false, now = Date.now() }) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const stream = [...messages.map((m) => ({ kind: 'msg', at: m.created_at, m })), ...calls.map((c) => ({ kind: 'call', at: c.created_at, c }))]
    .sort((a, b) => new Date(a.at) - new Date(b.at));
  const open = games.filter((g) => new Date(g.kickoff).getTime() > now);
  const GRADE = { hit: 'pill-good', miss: 'pill-bad', pending: 'pill-muted' };
  return (
    <>
      {!demo && <LiveRefresh live everyMs={15_000} />}
      <div className="mb-5">
        <p className="eyebrow">Members only</p>
        <h1 className="h1 mt-1">Chat</h1>
      </div>
      <section className="card !p-0">
        <ol className="max-h-[60vh] overflow-y-auto px-4 py-2" data-chat>
          {stream.length === 0 && <li className="py-8 text-center text-sm text-muted">Nothing yet. Say something about somebody&rsquo;s picks{callsOn ? ', or call a game' : ''}.</li>}
          {stream.map((item) => {
            if (item.kind === 'call') {
              const c = item.c, g = byId.get(c.game_id), p = names.get(c.user_id);
              const grade = gradeCall(c, g);
              const canDelete = !demo && (isCommish || (c.user_id === me && g && new Date(g.kickoff).getTime() > now));
              return (
                <li key={`c-${c.id}`} className="group my-1 flex gap-3 py-1">
                  <span className="mt-1 text-lg" aria-hidden>{p?.emoji ?? '👤'}</span>
                  <div className={`min-w-0 flex-1 rounded-xl border px-3 py-2 ${grade === 'hit' ? 'border-good/40 bg-goodsoft/40' : grade === 'miss' ? 'border-bad/40 bg-badsoft/40' : 'border-warn/40 bg-warnsoft/40'}`}>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="font-semibold text-ink2">{p?.display_name ?? 'Former member'}</span> called it · <LocalTime iso={c.created_at} extra={{ hour: 'numeric', minute: '2-digit' }} />
                      <span className={`pill ${GRADE[grade]} ml-auto`}>{grade === 'pending' ? 'On the record' : grade}</span>
                      {canDelete && <form action={deleteCall.bind(null, leagueId, c.id)} className="inline"><button className="text-muted hover:text-bad">take back</button></form>}
                    </div>
                    <p className="font-display text-lg font-bold leading-tight">{callText(c, g)}{g ? <span className="ml-2 text-sm font-semibold text-muted">{homeFirst ? `${g.home_abbr} v ${g.away_abbr}` : `${g.away_abbr} @ ${g.home_abbr}`}</span> : ''}</p>
                    {c.body && <p className="text-sm text-ink2">{c.body}</p>}
                    {grade !== 'pending' && <p className="text-xs text-muted">{resultText(g)}.</p>}
                  </div>
                </li>
              );
            }
            const m = item.m;
            const p = names.get(m.user_id);
            const mine = m.user_id === me;
            return (
              <li key={m.id} className={`group flex gap-3 py-2 ${mine ? 'flex-row-reverse text-right' : ''}`}>
                <span className="mt-1 text-lg" aria-hidden>{p?.emoji ?? '👤'}</span>
                <div className={`min-w-0 max-w-[85%] ${mine ? 'items-end' : ''}`}>
                  <div className="text-[11px] text-muted">
                    <span className="font-semibold text-ink2">{p?.display_name ?? 'Former member'}</span> · <LocalTime iso={m.created_at} extra={{ hour: 'numeric', minute: '2-digit' }} />
                    {(mine || isCommish) && !demo && (
                      <form action={deleteMessage.bind(null, leagueId, m.id)} className="ml-2 inline">
                        <button className="text-muted opacity-0 hover:text-bad group-hover:opacity-100 focus:opacity-100" aria-label="Delete">delete</button>
                      </form>
                    )}
                  </div>
                  <p className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${mine ? 'bg-accent text-white' : 'bg-surface2 text-ink'}`}>{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <form action={demo ? undefined : postMessage.bind(null, leagueId)} className="flex gap-2 border-t border-line p-3">
          <input className="input flex-1" name="body" maxLength={500} placeholder="Message the league" autoComplete="off" required />
          <button className="btn">Send</button>
        </form>
        {callsOn && <CallComposer leagueId={leagueId} games={open} homeFirst={homeFirst} action={demo ? null : postCall.bind(null, leagueId)} />}
      </section>
    </>
  );
}
