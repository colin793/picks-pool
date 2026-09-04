// Time formatting shared by server (emails, first paint) and client.
const base = { weekday: 'short', hour: 'numeric', minute: '2-digit' };

// Newer ICU puts a narrow no-break space before AM/PM; normalize so the
// server string and the client string match byte for byte.
const clean = (s) => s.replace(/\u202f/g, ' ');

export function fmtET(iso, extra = {}) {
  return clean(new Intl.DateTimeFormat('en-US', { ...base, timeZone: 'America/New_York', ...extra }).format(new Date(iso))) + ' ET';
}

export function fmtLocal(iso, extra = {}) {
  return clean(new Intl.DateTimeFormat('en-US', { ...base, ...extra, timeZoneName: 'short' }).format(new Date(iso)));
}
