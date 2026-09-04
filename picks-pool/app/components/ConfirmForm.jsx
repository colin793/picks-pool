'use client';

import { useState } from 'react';

// A form that stays disabled until the user types a phrase. For deletes.
export default function ConfirmForm({ action, phrase, children, buttonLabel = 'Delete', note }) {
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const ok = typed.trim() === phrase;
  if (!open) {
    return (
      <button type="button" className="btn btn-danger btn-sm" onClick={() => setOpen(true)}>{buttonLabel}</button>
    );
  }
  return (
    <form action={action} className="rounded-lg border border-bad/40 bg-badsoft/40 p-3">
      {children}
      {note && <p className="text-xs text-ink2 mb-2">{note}</p>}
      <label className="label">Type <span className="font-mono text-ink">{phrase}</span> to confirm</label>
      <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
      <div className="mt-3 flex gap-2">
        <button className="btn btn-danger btn-sm" disabled={!ok}>{buttonLabel}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
