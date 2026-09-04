'use client';

import { useEffect } from 'react';
import { registerWorker } from '../../lib/push/client';

// Registers the service worker on every page so a push can arrive whether or
// not the app is open. Cheap and idempotent. Renders nothing.
export default function PushSetup() {
  useEffect(() => { registerWorker(); }, []);
  return null;
}
