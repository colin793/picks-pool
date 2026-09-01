# Picks Pool

Weekly NFL pick-em pool. Pick winners, $1 a week (or whatever the league sets), most correct takes the pot. Multiple leagues, each with its own branding, entry fee, and commissioner. Scores come from ESPN automatically. Venmo handles the money through prefilled payment links. An optional AI recap email goes out Tuesday mornings.

## What you need

Free accounts on Supabase (database + logins), Vercel (hosting), and GitHub (Vercel deploys from it). Optional, only for the Tuesday recap email: Resend (sends the email) and an Anthropic API key (writes it).

## Setup

### 1. Supabase

1. Create a project at supabase.com (any name, any region, free tier).
2. Open the SQL Editor, paste the entire contents of `supabase/schema.sql`, and run it once.
3. Go to Authentication > URL Configuration. Set Site URL to your app's URL (once you have it from Vercel; use `http://localhost:3000` until then) and add `https://YOUR-APP.vercel.app/auth/confirm` to Redirect URLs.
4. Go to Authentication > Email Templates > Magic Link and replace the link in the template body with:

   ```
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">Sign in</a>
   ```

   This step matters. Without it, sign-in links won't complete.
5. Copy three values from Project Settings > API: the Project URL, the `anon` key, and the `service_role` key.

Supabase's built-in email sender is rate-limited to a handful of messages per hour. Fine for a small league. If sign-in emails start getting throttled, plug Resend's SMTP into Authentication > SMTP Settings later.

### 2. Vercel

1. Push this folder to a GitHub repo, then import the repo at vercel.com.
2. In the project's Environment Variables, add everything from `.env.example`: the three Supabase values, `APP_URL` (your Vercel URL, no trailing slash), and `CRON_SECRET` (any long random string). The recap variables can wait.
3. Deploy. Go back to step 3 of the Supabase section and set the real URL.

### 3. First run

Open the app, sign in with your email, tap the link. Hit "Create a league," then open the Admin tab: set the entry fee, your Venmo handle, colors, and a logo URL. Text the invite link to the league. Done.

Scores sync themselves whenever anyone opens the app (throttled to once per 2 minutes), with a daily cron as a backstop, so the board is live on Sundays without any scheduler setup.

### 4. Tuesday recap email (optional)

1. Get an Anthropic API key at console.anthropic.com and set `ANTHROPIC_API_KEY`.
2. Create a Resend account, verify a domain you own (required to email other people), set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `Picks Pool <picks@yourdomain.com>`).
3. Redeploy. Every Tuesday at 9am ET the app finds the week that just ended, writes a short recap (congratulates the winner, states the pot, lightly roasts the worst picker's actual bad picks), and emails every league that has the recap toggle on. If the AI call fails, a plain results email goes out instead.

Test it without waiting for Tuesday:

```
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR-APP.vercel.app/api/cron/recap?force=1"
```

## House rules (built in)

Straight-up winners, every game including Thursday and Monday. Each game locks at its own kickoff. No pick on a game counts as a loss. NFL tie games score for nobody. Tiebreaker is total points in the week's final game, closest wins, dead heat splits the pot. Other players' picks stay hidden until each game kicks off; tiebreakers stay hidden until the last game starts. Only the commissioner can mark entries paid. All of that is enforced by the database, not the browser.

## Local development

```
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
npm run check                # scoring-logic self-test
```
