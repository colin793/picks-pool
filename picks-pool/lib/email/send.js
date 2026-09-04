// One recipient per message, so nobody sees anyone else's address.
export async function sendEmail(to, subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Picks Pool <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
  });
  return res.ok;
}

export async function sendEach(emails, subject, text) {
  let sent = 0;
  for (const to of emails) if (await sendEmail(to, subject, text)) sent += 1;
  return sent;
}
