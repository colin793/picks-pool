# Picks Pool

A weekly pick'em pool you can run with real money and zero cash handling. Pick winners straight up, a buck a week (or whatever your league sets), most correct picks takes the pot. Built for the office pool that died when people stopped carrying cash.

Run multiple leagues from one app, each with its own sport, name, colors, logo, entry fee, and commissioner. Scores, team logos and team colors pull from ESPN automatically. Money moves through prefilled Venmo links, so the app never touches a dollar: players tap "Pay," Venmo opens with the amount and note filled in, and the commissioner taps one link to pay the winner. An optional AI recap email goes out the morning after a slate wraps, congratulating the winner and lightly roasting the worst picker using their real picks.

## Features

- Magic-link sign-in, no passwords
- NFL and college football by the week; NBA, NHL and MLB by the day; Premier League by the matchweek, with draws as a pickable outcome
- Opt in per slate: play the weeks you want, skip the rest
- Each game locks at its own kickoff, so Friday joiners can still play the Sunday slate
- Team logos and colors on every matchup; your pick fills with that team's color
- Live scoreboard on game days, with a "leading" column while games are in progress
- Everyone's picks in one grid, each column revealed at that game's kickoff
- Tiebreaker: total points in the slate's final game, hidden from other players until it kicks off
- Unpaid entries get a public red badge (shame collects faster than you will)
- Sortable season standings: wins, money won, average finish, pick percentage
- Browse any past slate's board
- Morning-of reminder emails to anyone who hasn't entered yet
- Results recap email, with an AI-written roast when an Anthropic key is present
- Works on a laptop and on a phone, light and dark, and installs to a phone home screen
- Every rule is enforced by the database (row-level security), not the browser

## Stack

Next.js 14 on Vercel, Tailwind, Supabase for the database and logins, Resend for email, ESPN's public scoreboard feed for scores, the Anthropic API for the recap. Everything runs on free tiers except the AI recap, which costs a few cents per season.

## Setup

You need free accounts at Supabase, Vercel, and GitHub, plus Resend and a domain you control for email. Budget 30 to 45 minutes.

### 1. Database

Create a Supabase project. Open the SQL Editor, paste the entire contents of `picks-pool/supabase/schema.sql`, run it once.

Then, in Project Settings, API, raise **Max Rows** from 1000 to 5000. The app pages through large reads anyway, but the higher ceiling keeps season pages fast.

### 2. Deploy

1. Get this code into a GitHub repo of your own (fork this repo, or upload the files).
2. Import the repo at vercel.com as a new project.
3. `package.json` lives in `picks-pool/`, so set **Root Directory** to `picks-pool` in the Vercel project settings, and make sure Framework Preset says Next.js.
4. Add environment variables before deploying. Names and placeholders are in `picks-pool/.env.example`. The types matter:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: plain type, never Secret. Vercel refuses to save `NEXT_PUBLIC_` values as Secrets, and these two are public by design. Both come from Supabase under Project Settings, API. The URL must be exactly `https://YOURREF.supabase.co`, nothing appended.
   - `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (any long random string), and later `RESEND_API_KEY` and `ANTHROPIC_API_KEY`: Secret type.
   - `APP_URL`: your Vercel URL once you have it, no trailing slash. Invite links and emails use it. (Without it the app falls back to the request's own host, which is fine for preview deploys.)
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

Open your URL, sign in with your email, create a league (pick the sport here; it's fixed afterwards), set the entry fee and your Venmo handle in the Admin tab, and text the invite link to your league. Scores sync automatically whenever anyone opens the app, throttled to once a minute per sport, with a daily cron backstop. While games are on, the Picks and This week pages refresh themselves every minute, and a score change makes the team's card glow.

### 6. Email jobs (optional)

Add `RESEND_API_KEY` and `EMAIL_FROM` to Vercel and redeploy. One cron runs every day at 9 AM Eastern (`vercel.json`) and does three things: syncs scores for every sport with a league, sends the results recap for any slate that finished in the last 40 hours (once per slate, tracked in `recaps_sent`), and sends a reminder to anyone in a week-mode league who hasn't entered a slate that has games kicking off that day (NFL: Thursday and Sunday mornings). Each league can turn recaps and reminders off in Admin. With `ANTHROPIC_API_KEY` set (needs a few dollars of prepaid credit) the recap is written by Claude; without it a plain results email goes out.

Test a piece without waiting for the schedule:

```
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR-APP.vercel.app/api/cron/daily?task=recap"
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR-APP.vercel.app/api/cron/daily?task=remind"
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR-APP.vercel.app/api/cron/scores?sport=nfl"
```

### 7. Push notifications (optional)

Two alerts, nothing else: "picks lock in 45 min and you haven't entered", and "Kevin just passed you" when the lead changes hands after a final. Per device; each person turns it on in Settings (on an iPhone, only after adding the app to the home screen).

1. Make a key pair once: `npx web-push generate-vapid-keys` on any computer with Node, or any VAPID key generator site.
2. In Vercel, add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (plain), `VAPID_PRIVATE_KEY` (Secret) and `VAPID_SUBJECT` (`mailto:you@example.com`), then redeploy.
3. Run `picks-pool/supabase/migrations/2026-09-05-push-notifications.sql` in the Supabase SQL Editor once.

The alerts run after every real score sync (so whenever anyone has the app open on game day) and from `/api/cron/push`. For the hour nobody has it open, point a scheduler at that route every five minutes on game days: Vercel's cron on a Pro plan, or a free pinger such as cron-job.org with the header `Authorization: Bearer YOUR_CRON_SECRET`.

## House rules

Every game straight up. No pick on a game counts as a loss. Tie games score for nobody. Ties for first go to the tiebreaker (closest to the total points of the slate's last game), and a dead heat splits the pot. You can withdraw from a slate until one of your picked games kicks off. Only the commissioner can mark entries paid, remove members, hand off the league, or delete it. All of it is enforced by database rules, not the browser, so nobody edits a pick after kickoff.

## How slates work

A *slate* is one bucket of games you pick together: an NFL week, a college football week, one calendar day of NBA, NHL or MLB games, or a Premier League matchweek. `lib/scores/sports.js` is the list of sports and how each one talks to ESPN; `public.sports` in the database mirrors the keys. Adding a sport ESPN carries is one entry in each.

Three slate modes. **week**: ESPN numbers the weeks (NFL, college football). **date**: no weeks, one calendar day is a slate (NBA, NHL, MLB). **span**: no week numbers in the feed but the schedule comes in clusters, so consecutive game days form one slate (Premier League: Friday to Monday is a matchweek, a Tuesday-Wednesday round is its own). A game never moves slates once stored, so postponements just stay where they were.

Soccer also gets a third button, Draw, and lists the home side first. Everywhere else a tie scores for nobody.

Slate keys sort as text so "past slates" is just a sort: `2026-2-01` is season 2026, regular season (ESPN type 2), week 1. Playoffs are type 3 (`2026-3-01` is Wild Card weekend). Date and span slates are the ET calendar date they start on, `2026-11-14`.

To add another soccer league, copy the `epl` entry in `lib/scores/sports.js` with ESPN's path (`soccer/usa.1` for MLS, `soccer/uefa.champions` for the Champions League) and add the matching row to `public.sports`.

### Featured games (college football)

A college Saturday has eighty games; a pool picks fifteen. For sports with a `featured` size in `lib/scores/sports.js` (college football today), the first time anyone in a league opens a new slate the app picks the games from the AP rankings ESPN sends with every game: ranked-vs-ranked first (best combined rank), then the best ranked teams, then power-conference games by kickoff. Games against lower-division opponents are skipped. The set is frozen for that league from then on; the commissioner can swap games in and out from Admin (a game that has kicked off stays put, and removing a game deletes any picks on it) or hit "Back to auto-pick". Only featured games can be picked, count toward standings, or move the tiebreaker lock. The NFL plays every game and none of this applies.

The rule lives in `lib/featured.js` with its own self-check; `/dev?view=featured` shows the commissioner's view on a fixture board and `/dev?view=cfb` the picks page with ranks.

## Local development

```
cd picks-pool
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

Checks that need no Supabase at all:

```
npm run check        # scoring, slate keys, live refresh and featured-game rules (the lib/**/*.test.mjs files)
npm run check:espn   # hit ESPN for real and print what a sync would write (nfl | cfb | nba | nhl | mlb | epl)
npm run check:db     # apply schema.sql to a local Postgres and run the row-level security tests
```

`check:db` needs a local Postgres reachable at `DATABASE_URL` (default `postgres://claude:claude@localhost/pool`); `scripts/db/supabase-stub.sql` fakes just enough of Supabase's `auth` schema for the policies to run.

`http://localhost:3000/dev` is a design preview on fixture data with no database: the picks page, the board and the admin page, frozen at a Sunday 4:40 PM with finals, live games and open games. Add `?view=board`, `?view=admin`, or `?view=epl` for the soccer treatment. It 404s in production unless `ALLOW_PREVIEW=1` is set.

### Staging with fake data

Point a second Supabase project at a preview deploy, then:

```
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed -- you@example.com
```

That creates six players, a league you commission, and a 14-game demo slate shifted so "now" is mid-Sunday. Set `SCORES_FROZEN=1` on that deploy so the ESPN sync leaves the demo slate alone. Sign in with the email you passed.

## Upgrading from v1

v2 changes the schema (weeks became slates, games gained a sport and logos). There is no in-place migration; it was built when the only data in production was test data.

1. Supabase SQL Editor: run `picks-pool/supabase/reset.sql` (drops everything), then `schema.sql`.
2. Rotate `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in Supabase and Vercel while you're there.
3. Deploy the `v2` branch. `vercel.json` now has one cron instead of two.
4. Existing accounts keep working (schema.sql rebuilds their profile rows); people will need to set their display name and Venmo handle again in Settings.

## Upgrading from v2.1 to v2.2 (push notifications)

Same shape: paste `picks-pool/supabase/migrations/2026-09-05-push-notifications.sql` into the Supabase SQL Editor and Run, then add the three VAPID variables in Vercel (Setup, step 7). Without the variables the app runs exactly as before and the Notifications section in Settings says so.

## Upgrading from v2 to v2.1 (featured slates)

One SQL file, no data loss: Supabase SQL Editor, paste `picks-pool/supabase/migrations/2026-09-05-featured-slates.sql`, Run. It adds the rank columns and the curated-slate table and is safe to run twice. Fresh installs get the same from `schema.sql`.

## License

MIT. Run your own pool, rename it, reskin it, have fun. The idea is that this is a friendly pool format where the commissioner keeps nothing, just a game night.
