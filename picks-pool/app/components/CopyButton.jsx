'use client';

import { useState } from 'react';
import { Icon } from './icons';

export default function CopyButton({ text, label = 'Copy link' }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      window.prompt('Copy this link', text);
    }
  }
  return (
    <button type="button" className="btn btn-sm" onClick={copy}>
      {done ? <Icon.check width={16} height={16} /> : <Icon.copy width={16} height={16} />}
      {done ? 'Copied' : label}
    </button>
  );
}
