import webpush from 'web-push';
import { admin } from '../supabase';

// VAPID keys identify this app to the browsers' push services. Generate once:
//   npx web-push generate-vapid-keys
export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:pool@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  ready = true;
}

// Send one payload to a list of subscription rows. A 404/410 means the
// browser dropped the subscription; the row goes with it. Returns sent count.
export async function pushTo(rows, payload) {
  if (!pushConfigured() || !rows?.length) return 0;
  setup();
  const db = admin();
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body, { TTL: 3600 });
      sent += 1;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', r.endpoint);
      else console.error('push failed:', e?.statusCode, e?.message);
    }
  }));
  return sent;
}

// Subscriptions for a set of users: user_id -> rows.
export async function subscriptionsFor(db, userIds) {
  if (!userIds.length) return new Map();
  const { data } = await db.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', userIds);
  const m = new Map();
  for (const r of data ?? []) { if (!m.has(r.user_id)) m.set(r.user_id, []); m.get(r.user_id).push(r); }
  return m;
}
