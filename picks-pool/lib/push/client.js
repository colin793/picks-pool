// Browser side of Web Push. Pure helpers; components decide what to show.

// 'unsupported' | 'needs-install' (iPhone, not on the home screen yet) |
// 'denied' | 'default' (never asked) | 'granted'
export function pushSupport() {
  if (typeof window === 'undefined') return 'unsupported';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (ios && !standalone) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function registerWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('/sw.js'); } catch { return null; }
}

// The subscription this browser already holds, if any.
export async function currentSubscription() {
  const reg = await registerWorker();
  return reg ? reg.pushManager.getSubscription() : null;
}

// Ask, then subscribe. Returns the PushSubscription JSON, or null if refused.
export async function subscribe(publicKey) {
  const reg = await registerWorker();
  if (!reg) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
  return sub.toJSON();
}

export async function unsubscribe() {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

function toKey(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
