// Time formatting shared by server (emails, first paint) and client.
const base = { weekday: 'short', hour: 'numeric', minute: '2-digit' };

export function fmtET(iso, extra = {}) {
  return new Intl.DateTimeFormat('en-US', { ...base, timeZone: 'America/New_York', ...extra }).format(new Date(iso)) + ' ET';
}

export function fmtLocal(iso, extra = {}) {
  return new Intl.DateTimeFormat('en-US', { ...base, ...extra, timeZoneName: 'short' }).format(new Date(iso));
}
