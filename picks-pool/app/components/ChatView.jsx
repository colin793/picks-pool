import LocalTime from './LocalTime';
import LiveRefresh from './LiveRefresh';
import { postMessage, deleteMessage } from '../../lib/actions';

// The league's room. Server-rendered; LiveRefresh re-fetches every 15s so a
// new message shows up without anyone reloading. Oldest at the top, the
// composer at the bottom, like every chat you have ever used.
export default function ChatView({ leagueId, messages, names, me, isCommish, demo = false }) {
  return (
    <>
      {!demo && <LiveRefresh live everyMs={15_000} />}
      <div className="mb-5">
        <p className="eyebrow">Members only</p>
        <h1 className="h1 mt-1">Chat</h1>
      </div>
      <section className="card !p-0">
        <ol className="max-h-[60vh] overflow-y-auto px-4 py-2" data-chat>
          {messages.length === 0 && <li className="py-8 text-center text-sm text-muted">Nothing yet. Say something about somebody&rsquo;s picks.</li>}
          {messages.map((m) => {
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
      </section>
    </>
  );
}
