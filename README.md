# Picks Pool

A weekly NFL pick-em pool you can run with real money and zero cash handling. Pick winners straight up, a buck a week (or whatever your league sets), most correct picks takes the pot. Built for the office pool that died when people stopped carrying cash.

Run multiple leagues from one app, each with its own name, colors, logo, entry fee, and commissioner. Scores pull from ESPN automatically. Money moves through prefilled Venmo links, so the app never touches a dollar: players tap "Pay," Venmo opens with the amount and note filled in, and the commissioner taps one link to pay the winner. An optional AI recap email goes out Tuesday mornings that congratulates the winner and lightly roasts the week's worst picker using their real picks.

## Features

- Magic-link sign-in, no passwords
- Weekly opt-in: play the weeks you want, skip the rest
- Each game locks at its own kickoff, so Friday joiners can still play the Sunday slate
- Live scoreboard on game days
- Tiebreaker: total points in the week's final game
- Unpaid entries get a public red badge (shame collects faster than you will)
- Sortable season standings: weekly wins, money won, average finish, pick percentage
- Other players' picks stay hidden until each game kicks off, enforced by the database
- Tuesday AI recap email (optional, needs an Anthropic API key)

## Stack

Next.js on Vercel, Supabase for the database and logins, Resend for email, ESPN's public scoreboard feed for scores, the Anthropic API for the recap. Everything runs on free tiers except the AI recap, which costs a few cents per season.

## Setup

You need free accounts at Supabase, Vercel, and GitHub, plus Resend and a domain you control for email. Budget 30 to 45 minutes.

### 1. Database

Create a Supabase project. Open the SQL Editor, paste the entire contents of `picks-pool/supabase/schema.sql`, run it once. Done with the database.

### 2. Deploy

1. Get this code into a GitHub repo of your own (fork this repo, or upload the files).
2. Import the repo at vercel.com as a new project.
3. If your `package.json` is not at the repo root (it lives in `picks-pool/` in this repo), set Root Directory to that folder in the Vercel project settings, and make sure Framework Preset says Next.js.
4. Add environment variables before deploying. Names and placeholders are in `picks-pool/.env.example`. The types matter:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: plain/Config type, never Secret. Vercel refuses to save `NEXT_PUBLIC_` values as Secrets, and these two are public by design. Both values come from Supabase under Project Settings, API. The URL must be exactly `https://YOURREF.supabase.co`, nothing appended.
   - `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (any long random string), and later `RESEND_API_KEY` and `ANTHROPIC_API_KEY`: Secret type.
   - `APP_URL`: your Vercel URL once you have it, no trailing slash.
5. Deploy, note your URL, add `APP_URL`, redeploy. Environment variables only take effect on a fresh deploy.

### 3. Email

Supabase's built-in sender only delivers to your own team and locks the email templates, so custom SMTP is required, not optional.

1. Create a Resend account and verify a domain you own (Domains, Add Domain, add the DNS records it gives you). A subdomain like `mail.yourdomain.com` is fine.
2. Create a Resend API key.
3. In Supabase, Project Settings, Authentication: enable Custom SMTP. Host `smtp.resend.com`, port `465`, username `resend`, password is the API key, sender email on your verified domain.
4. Raise the auth email rate limit from 30 per hour to something comfortable.

### 4. Auth configuration

1. Supabase, Authentication, URL Configuration: set Site URL to your Vercel URL and add `https://YOUR-APP.vercel.app/auth/confirm` to Redirect URLs.
2. Authentication, Email Templates: edit BOTH the "Confirm signup" and "Magic Link" templates (they're separate, and a new user gets the first one, a returning user the second). Replace the link in each with:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">Sign in</a>
   ```

   The app also tolerates the default template format when the link is opened in the same browser that requested it, but the edited templates work from any device, so edit them.

### 5. First run

Open your URL, sign in with your email, create a league, set the entry fee and your Venmo handle in the Admin tab, and send the invite link to your league. Scores sync automatically whenever anyone opens the app, throttled to every two minutes, with a daily cron backstop.

### 6. AI recap (optional)

Add `ANTHROPIC_API_KEY` (from console.anthropic.com, needs a few dollars of prepaid credit) and `RESEND_API_KEY` plus `EMAIL_FROM` to Vercel, redeploy. Every Tuesday at 9am ET the app emails each league a recap of the week that just ended. If the AI call fails, a plain results email goes out instead. Each league can turn recaps off in Admin. Test without waiting for Tuesday:

```
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR-APP.vercel.app/api/cron/recap?force=1"
```

## House rules

Every game straight up, including Thursday and Monday. No pick on a game counts as a loss. NFL tie games score for nobody. Ties for first go to the tiebreaker (closest to the total points of the week's last game), and a dead heat splits the pot. Only the commissioner can mark entries paid. All of it is enforced by database rules, not the browser, so nobody edits a pick after kickoff.

## Local development

```
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
npm run check                # scoring-logic self-test
```

## License

MIT. Run your own pool, rename it, reskin it, have fun. The idea is that this is a friendly pool format where the commissioner keeps nothing, just a game night.
