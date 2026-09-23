# SVG Performance

Private-preview web app from **Ricky Maynez / SVG MMA Academy** (El Paso).

SVG Performance is **not** gym-members-only. It is for **anybody** who wants to improve performance — especially combat sports athletes, and also people just getting in shape. SVG members are welcome (gym verify / member pricing). You do not have to train at SVG to create an account.

You can run this on a laptop. A new person can create an account, follow one labeled **DEMO** strength program, save a workout, tap **Watch form** for a YouTube technique video, log a meal estimate, open a DEMO lesson, talk to SVG Coach, and use a Home screen with a lime welcome, quick-action tiles, today’s workout, a daily quote, nutrition, and an SVG & CO shop block.

It does **not** charge live cards, talk to Gymdesk, fake an Apple Watch pairing, or claim Ricky types each AI reply.

## What you can do in this preview

1. Create an account, answer a short first-run survey (goal, experience, martial art, equipment, days, units), log in, log out, and reset a password. New accounts cannot open Home until that required intake is saved.
2. Finish the required intake (name, goal, experience, martial art, equipment, days, units; optional limitations/diet/allergies). An optional second screen (weight, session length, location, competition, coaching tone, obstacles) can be skipped. Edit either later on Profile.
3. Use Home for: a lime **Welcome** wash, four large academy photo tiles (Train / Coach / Learn / Progress) plus smaller Fuel / Calendar letter tiles, **Today’s workout**, a **daily quote** (full on Performance+; Member Access sees a teaser), nutrition rings, and an SVG &amp; CO merch block (live store, names only). Paths / journal / wrap / challenge stay on their own screens.
4. Follow a **DEMO training path** (Beginner Foundations, Build Your Gas Tank, or Strength for Combat) with milestones. Default comes from onboarding. Open the DEMO strength program (sets, reps, load, rest). Tap **Watch form** for a YouTube proper-form reference (or see “Video pending coach review”).
5. Log a session, tap the rest pill to start a between-set countdown (Stop or 0 clears it), see it in history, and fix a mistaken number.
6. See **My Progress**: type body weight / sleep / resting HR / lean mass / body fat yourself, see calories from food logs, **upload private progress photos** (jpeg/png/webp), a **personal records** board (heaviest load per exercise + longest days-active streak), plus workout charts. Open **Heart rate** to import Apple Health / watch workouts (JSON, XML, or CSV), type RHR, or optionally connect Polar. Open the **weekly SVG report** for an automated summary (strength / conditioning / difficulty / next focus). Coach comments stay empty until a human writes them. Apple Watch is not shown as connected on the web.
7. Log meals by hand. Search a small **DEMO** food list or your saved meals. Calories/macros are **manual estimates**. Correct them later. **Meal-prep v1** on Fuel scales portions, applies simple swaps, and builds a grocery list (verify allergies yourself).
8. Browse a **DEMO** Learn technique library filtered by **skill level** and **martial art** (both at once). Each card shows a YouTube thumb, channel, tags, a short summary, and a technical write-up. Videos are labeled YouTube references — not SVG-produced film. Bookmark or mark complete. Admins can draft/publish. Member Access stays beginner-only when Stripe keys are on.
9. Chat with **SVG Coach** (AI assistant). Pick Martial art (then an art), Conditioning, or Mental first. Safety rails refuse pain, medical, weight-cut, and other-member record requests. Knowledge prefers `COACHING_GUIDE.md` + DEMO seeds. No API key = honest offline/DEMO answers.
10. Keep a **personal coaching journal** (goals, notes, questions, lessons). Owner-only unless an assigned coach adds feedback + action items on Fighter Development+. Request human coach help from Home (status: open / seen / closed — not a 24/7 promise).
11. **Heart rate (Apple Health first):** import a Health Auto Export JSON, Apple Health `export.xml`, or CSV from iPhone Health / Shortcuts. Rows are labeled `apple_health` or `apple_watch_import`. The web app cannot pair a Watch. Polar is optional (env keys). Manual avg/max is a backup. Analysis is **not medical advice**. Automatic Watch sync is Phase 2 (native iOS / HealthKit).
12. Open the real [SVG & CO shop](https://www.svgandco.com) (we do not invent products or prices).
13. See draft **App Plans / Online Coaching / VIP Experiences** on Pricing (gym vs nonmember, PROPOSAL / TEST). Checkout only runs if Stripe TEST keys are set. Access is granted only by webhook, not by the success page. Copy mentions Affirm / Klarna pay-over-time when available; without keys that stays coming soon.
14. See **My plan** for the current catalog plan and this month’s coaching credits. Admins can assign/override a plan for the pilot and mark a credit used.
15. **Book with Ricky**: eligible call types, remaining credits, a prepare checklist, preferred times, and post-call next steps (empty until a coach writes them). Not a live calendar. SVG Coach is not Ricky.
16. Admins can verify gym members, invite emails, assign a 30-day pilot plan, adjust credits, run comment queues, and see simple signup / weekly-active counts. Checking “I train at SVG” still grants nothing.
17. Coaches/admins can see assigned-member **trends** (workouts, lessons, AI handoff flags, last active) — not private food diaries.
18. **Timestamped clips** (Fighter Development+): private mp4/webm upload; assigned coach adds mm:ss notes + a drill. Not a live stream. Local disk; S3 later (names only).
19. **Monthly SVG challenge** (Beginner / Advanced tracks): opt in; score is days you logged a workout and/or meal — not heaviest lift. Seeded DEMO month.
20. Admins schedule a **weekly 60–90s focus video** (YouTube/Vimeo or upload). Drafts stay hidden. Today shows the published week for Performance+.

Primary tabs (phone, sticky top, lime highlight on the active tab): **Home · Train · Fuel · Learn · Coach**. Shop, Book, Profile, and Log out sit on the bottom account bar with the official circular neon badge. First open plays Ricky’s splash video until the neon ring closes (muted so phones actually animate; skipped on reduced motion and later visits). The + button is a quick add for workout, food, a body metric, or heart rate. Paid app plans are **additional to gym dues**.

## What you need on your computer

- Node.js 20 or newer
- npm (comes with Node)

No Postgres install is required on your laptop. Local setup uses a SQLite file. A phone-friendly hosted preview uses Postgres (Neon or Vercel Postgres) — steps below.

## First-time setup

```bash
npm install
npm run setup
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

`npm run setup` creates a local `.env` if needed, the database tables, the DEMO program, and DEMO lessons.

To make yourself an admin after you create an account:

```bash
npm run admin:promote -- you@example.com
```

To make a coach account (for reports):

```bash
npm run staff:promote -- coach@example.com coach
```

Or set `ADMIN_BOOTSTRAP_EMAIL` to that email and run `npm run db:seed` again.

### Environment variable names

See `.env.example`. Names only — put real values in your private `.env`:

| Name | What it is for |
| --- | --- |
| `DATABASE_URL` | Laptop: `file:./dev.db`. Hosted: a `postgresql://…` string from Neon or Vercel Postgres. Never a SQLite file on Vercel. |
| `AUTH_SECRET` | Long random string used to hash session and reset tokens |
| `APP_URL` | Public address (`http://localhost:3000` locally) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Optional mail. Empty = password reset shows a PREVIEW link; reminders stay **in-app on Home only** |
| `ADMIN_BOOTSTRAP_EMAIL` | Optional. Seed promotes this existing account to admin |
| `OPENAI_API_KEY` `OPENAI_MODEL` | Optional. Empty = SVG Coach stays offline/DEMO |
| `STRIPE_SECRET_KEY` | Optional. Stripe **TEST** secret only (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Optional. Needed to verify webhooks |
| `STRIPE_PRICE_GYM` | Optional. TEST price id for SVG Performance gym ($19) |
| `STRIPE_PRICE_STANDALONE` | Optional. TEST price id for SVG Performance nonmember ($29) |
| `STRIPE_PRICE_CONDITIONING_GYM` / `_NON` | Optional. Fighter Conditioning $49 / $59 |
| `STRIPE_PRICE_DEVELOPMENT_GYM` / `_NON` | Optional. Fighter Development $149 / $179 |
| `STRIPE_PRICE_ELITE_GYM` / `_NON` | Optional. Elite Online $299 / $349 (cap ~6) |
| `STRIPE_PRICE_VIP` | Optional. SVG VIP $699 (cap 2) |
| `STRIPE_PRICE_PLATINUM` | Optional. SVG Platinum VIP $1,199 (cap 1) |
| `PROGRESS_PHOTO_DIR` | Optional. Local folder for progress photos (default `uploads/progress-photos`). Never commit those files |
| `TRAINING_CLIP_DIR` | Optional. Local folder for private training clips (default `uploads/training-clips`) |
| `FOCUS_VIDEO_DIR` | Optional. Local folder for uploaded weekly focus clips (default `uploads/focus-videos`) |
| `POLAR_CLIENT_ID` `POLAR_CLIENT_SECRET` `POLAR_REDIRECT_URI` | Optional. Polar AccessLink. Empty = Connect Polar (TEST) / not configured |
| `S3_BUCKET` `S3_REGION` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` `S3_ENDPOINT` | Names only for a later cloud disk. **Not wired** in this preview |

If Polar keys are missing: Heart rate still works with Apple Health import, manual entry, and labeled DEMO samples. Connect Polar (TEST) stays off. We never show Apple Watch as connected.

## Apple Health / Watch (Phase 1 — primary)

The browser cannot fully pair an Apple Watch. Members import a file:

1. On iPhone, open **Health**, **Health Auto Export**, or **Shortcuts**.
2. Export resting heart rate + workouts as JSON or CSV, or share `export.xml`.
3. Open **Heart rate** → **Connect Apple Health** → import the file.
4. Progress tiles fill from imported samples. Source is `apple_health` or `apple_watch_import`, never “Apple Watch connected.”

**Phase 2:** a native iOS companion with HealthKit for automatic Watch sync. Not in this preview.

## Polar AccessLink (optional / secondary)

1. Create a Polar AccessLink client at the Polar developer portal.
2. Set redirect URI to `{APP_URL}/api/polar/callback` (local: `http://localhost:3000/api/polar/callback`).
3. Put `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET`, and `POLAR_REDIRECT_URI` in `.env`. Restart `npm run dev`.
4. Open **Heart rate** (below Apple Health) → **Connect Polar**. After Polar approves, use **Pull recent activities**.
5. Without keys: Connect Polar (TEST) stays disabled.

Never put Polar secrets in git.

Never put a live `sk_live_` key in this preview. Live keys are rejected.

Affirm, Klarna, and similar pay-over-time methods use those same TEST keys. Stripe does not require extra Affirm/Klarna secrets for Checkout. Turn the methods on in the Stripe Dashboard (TEST).

If Stripe keys are missing: checkout buttons stay off and nobody is marked paid. Training still works. Pricing still shows the Affirm/Klarna message as **coming soon** — we do not fake a successful buy.

If OpenAI is missing: SVG Coach still refuses unsafe asks and answers common questions from DEMO notes.

If SMTP is missing: reminders still appear on Home once per day after your preferred hour. No email is sent. Turn them off under Profile → Reminders.

## Stripe TEST (beginner walkthrough)

Do this only with **test** keys. Do not turn on live billing.

1. Create a Stripe account and stay in **Test mode** (toggle in the Stripe dashboard).
2. Copy the **secret key** that starts with `sk_test_` into `STRIPE_SECRET_KEY`.
3. In Stripe, create monthly recurring TEST prices for the plans you want to try. At minimum put ids in `STRIPE_PRICE_GYM` ($19) and `STRIPE_PRICE_STANDALONE` ($29). Other names are in the table above. Gym-member prices still need an admin verify.
4. On your laptop, install the Stripe CLI, then forward webhooks:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

5. Copy the CLI `whsec_...` value into `STRIPE_WEBHOOK_SECRET`. Restart `npm run dev`.
6. Log in, open **Pricing**, start TEST checkout. Use Stripe’s test card `4242 4242 4242 4242`, any future date, any CVC. If Affirm/Klarna appear, that is Stripe TEST — still not live money. We never invent a successful Affirm/Klarna purchase when keys are missing.
7. The success page does **not** unlock tools. Access changes after the webhook (`checkout.session.completed` or `invoice.paid`), the same for card or BNPL. SVG does not store loan details.
8. Duplicate webhooks are ignored. Failed payment → `past_due` (tools lock if keys are on). Cancel → no access. If the period end date is in the past, access is treated as expired.

Gym $19 still needs an **admin verify**. The gym checkbox never grants a price by itself.

Without keys: Pricing shows “not configured” and Affirm/Klarna as coming soon. Nobody is faked as paid.

Cards and BNPL loans never touch this app’s database.

## Affirm / Klarna (TEST)

Do this only in **Stripe Test mode**. Do not enable live charges.

1. Stripe Dashboard → **Settings → Payment methods** (Test mode). Enable **Affirm** and **Klarna**. Afterpay/Clearpay is optional similar BNPL.
2. No extra env names beyond the Stripe TEST keys already listed. Stripe Checkout uses `STRIPE_SECRET_KEY`.
3. Amount / currency (USD, typical Stripe TEST minimums — confirm in Dashboard):
   - Klarna: about **$10+**
   - Afterpay/Clearpay: about **$35+**
   - Affirm: about **$50–$30,000**
4. That means $19 / $29 Performance SKUs can offer Klarna when Dashboard allows, but not Affirm. Fighter Conditioning $59+, Development, Elite, VIP, and Platinum are the Affirm-sized plans. Intensives ($1,500 / from $4,500) are a main use case, but this preview’s Book stubs are **not** Stripe Checkout.
5. **US / eligibility:** Affirm is primarily US. Klarna depends on Stripe + shopper location. Not everyone qualifies. Affirm or Klarna decide approval — SVG does not.
6. Subscription Checkout sometimes rejects Affirm. This app tries explicit `payment_method_types`, then Dashboard `automatic_payment_methods`, then card-only. Still TEST.
7. Without keys: UI says coming soon. Checkout stays off. We do not fake BNPL success.

## Tests

```bash
npm test
```

Coverage includes:

- Auth, password reset, and workout ownership (Milestone 1)
- Nutrition ownership (user B cannot edit user A’s food log or saved meals)
- DEMO food search + saved meals
- Draft lessons stay hidden until an admin publishes
- Learn filters: beginner default; boxing/intermediate change the result set; pending video UX
- Onboarding gate: incomplete users stay on `/onboarding`; completed users reach Home; answers persist and edit on Profile
- Optional deeper onboarding: skip still reaches Home; complete step 2 persists weight/session/tone/competition; Home prompt if skipped; weight does not change DEMO nutrition targets
- Daily quote: even mix of UFC legends, well-known high achievers, and Bible verses (attribution on the card). Performance+ / paid catalog get the full line; Member Access sees a locked teaser; reminder uses the same in-app / SMTP pattern (no mobile push yet)
- Difficulty rating persists on a completed session; too-easy streaks flag for coaches without shame copy
- Weekly wrap: last 7 days counts (days trained, workouts, meals, lessons, avg rated feel); quiet-week copy has no shame; no food names
- Personal records: heaviest logged load per exercise and longest days-active streak, recalculated from existing logs; empty state when nothing is logged yet
- Today guide: beginner vs fighter priorities from onboarding; default DEMO path; recommended Learn lesson; check-in from credits / open request
- Weekly SVG report: labeled Automated SVG summary; no fake Ricky comment; assigned coach can write one on Fighter Development+
- Training paths: enroll, auto-complete milestones from logged DEMO days, celebration on manual mark-done
- Journal owner-only; coach feedback + action items on coaching tiers; user B cannot read user A
- Book next steps stay empty until staff writes them; booking reminder uses the existing in-app / SMTP pattern
- Heart rate ownership (user B cannot read/delete user A); Polar “connected” only with env keys + a stored token; Apple Watch connected and HealthKit bridge are always false
- Apple Health JSON / XML / CSV import labeled `apple_health` / `apple_watch_import`; zone math; RHR trend; DEMO samples labeled DEMO
- SVG Coach refusals: pain, weight-cut, cross-account
- Knowledge pack loads the guide + DEMO seeds, not the interview worksheet
- Gym checkbox does not verify; only an admin can
- Stripe webhook signature, duplicates, failed payment, cancel, renewal, expiration
- Affirm/Klarna payment-method selection by amount; webhook still grants access the same way; no fake BNPL success without keys
- Pilot invites (invited → joined on signup); clip ownership; challenge days-active scoring; meal-prep grocery merge; focus video draft vs published
- Reminder prefs, no-spam, SMTP on vs in-app only
- Coach/admin report role gates; help-request statuses; no food-diary dump
- Home weekly activity copy (no shame)
- Body metric / photo-placeholder ownership (user B cannot touch user A’s numbers)
- Progress photo files: owner-only read/edit/delete; jpeg/png/webp only; coaches cannot open another member’s file
- Every seeded DEMO exercise has a YouTube form URL **or** an explicit pending flag
- Plan entitlements: Member Access vs Performance vs Elite; gym-price verify; Elite cap + waitlist
- SVG Coach ≠ Ricky disclaimer string; VIP included strategy credit on Book requests

See `EVALS.md` for the SVG Coach evaluation set.

## Preview walkthrough

1. `npm install && npm run setup && npm run dev`
2. Create an account (18+ required) → finish the required intake → optional deeper screen (or Skip) → land on Home
3. Training → **Calendar** (Today / Tomorrow list, lime today-dot) → tap a DEMO workout card → day overview (YouTube form stills + play mark, silhouette if pending) → **Start Now** → log Previous / Reps / Lbs → tap a thumb or **Watch form** (YouTube) → Save → refresh History
4. Fuel → search “chicken” in the DEMO list or save a meal → log an estimate → correct a number
5. Learn → filter Boxing, then Intermediate, then both together → a card shows thumb, channel, tags, summary, and a technical write-up → open it → **Watch on YouTube** (or pending) → bookmark / complete
6. Coach → pick Martial art → Boxing (or Conditioning / Mental) → ask about a missed class; also try a weight-cut question and watch the refusal. Header says SVG Coach.
7. Home → greeting, daily quote, **Today’s workout** (type · est. minutes · N Exercises), nutrition rings, quiet Calendar / Progress links, + button. Weekly wrap, challenge, and focus video stay on Report / Challenge / Learn — not stacked on Home.
8. Progress → type a body weight; open Heart rate and import an Apple Health file (Watch stays disconnected on the web); upload a jpeg/png/webp photo (private to you); see the **personal records** board (empty until a load or an active day, then heaviest load + longest streak)
9. Profile → turn a reminder off; optional nutrition targets
10. Pricing → three sections, gym vs nonmember, checkout off unless TEST keys exist; Affirm/Klarna copy is coming soon without keys
11. Plan → see current plan + credits; Book → send a mindset request (not a calendar slot)
12. Promote an admin, open **Admin** (invites, queues, counts), verify a gym member, assign a plan
13. Promote a coach, assign a member, open Staff → trends (no food names); review a training clip if one exists
14. Fuel → Meal-prep: set portions on a saved meal → grocery list
15. Home → monthly challenge opt-in; Today shows this week’s focus video (or a Performance+ teaser)

## Pilot go / no-go checklist

Use this before inviting ~15–20 adults. Check a box only if you actually tried it.

- [ ] Signup works (18+ confirmation). New accounts hit `/onboarding` and cannot open Home until the survey is saved. Logout / login / password reset behave.
- [ ] Intake answers persist and can be edited on Profile. Learn defaults to that experience (and art when it is one of the six). Home suggests a DEMO day from the answers — still labeled DEMO.
- [ ] After required intake, the optional deeper screen can be skipped. Home then shows “2-minute deeper profile for better programming.” Completing it (or editing Profile) saves session length, location, competition, tone, and obstacles. Weight is display-only — nutrition targets stay DEMO estimates.
- [ ] Gym checkbox does **not** unlock $19 or paid tools by itself.
- [ ] Home is a white shell with a lime welcome, four large academy photo tiles (Train / Coach / Learn / Progress) plus Fuel / Calendar letter tiles, today’s workout (type · est. minutes · exercise count), quote, nutrition rings (estimates), SVG & CO shop block, and a + quick-add. No Chuze blue.
- [ ] Home Today is the workout hero (title + one CTA). Goal can appear under the greeting. No invented fight date or Ricky comment.
- [ ] Training paths enroll from onboarding default; a logged DEMO day can complete a milestone. Journal entries stay private. Weekly report is labeled Automated SVG summary.
- [ ] Home weekly wrap shows last-7-day counts (days trained, workouts, meals, lessons, avg feel if rated). Quiet week copy is okay, not shame. No meal names on the card.
- [ ] Days-active copy never shames a quiet week.
- [ ] Train: **Calendar** lists Today / Tomorrow with DEMO cards; a workout card opens the day overview (YouTube form stills when a link exists, silhouette if pending); **Start Now** opens the logger (Previous / Reps / Lbs); tap the rest pill to start a lime countdown in the header and Stop to cancel; a thumb or **Watch form** opens a YouTube technique video (or shows pending); a logged workout survives refresh; a wrong number can be corrected.
- [ ] Fuel: DEMO search or saved meal fills the form; estimates stay labeled; owner can correct; another account cannot open that log.
- [ ] Learn: members see published DEMO lessons only; skill-level and martial-art chips work together; a card shows thumb, channel, summary, and technical description; Watch on YouTube is labeled as a reference (or pending); bookmark / complete stick.
- [ ] SVG Coach: pick a topic (and an art when Martial art); missed-class answer is usable; pain / weight-cut / other-member asks are refused; offline still works without an OpenAI key. The UI does not say Coach Savage.
- [ ] Home shows today’s quote for a Performance+ / preview account, and a teaser when Stripe is on and the plan is Member Access. Quote reminder can be turned off under Profile → Reminders. True mobile push is later.
- [ ] After saving a workout, completing a lesson, adding a first-of-day log, or uploading a photo, a short celebration appears (respects reduced motion). Completing a workout asks how it felt; history and staff trends show the rating / recent feel.
- [ ] Progress: a typed body weight saves; Heart rate tiles fill from Apple Health import / Polar / manual / DEMO when data exists; Apple Watch is not shown as connected; a jpeg/png/webp photo uploads, shows, and deletes; another account cannot open that URL.
- [ ] Progress personal records: empty until a logged load or active day; then heaviest load per exercise and longest days-active streak, recalculated from existing logs.
- [ ] Shop links open live svgandco.com pages (names only, no invented prices).
- [ ] Subscription TEST: without keys, checkout stays off and Affirm/Klarna is coming soon (no fake buy). With TEST keys + webhook forward, access flips only after the webhook for card or BNPL. Cancel / failed payment do not leave someone “paid.”
- [ ] Pricing shows App / Coaching / VIP, gym vs nonmember, PROPOSAL / TEST, “dues are separate,” and “Pay over time with Affirm or Klarna when available.”
- [ ] Member Access (keys on, no sub) still trains and sees beginner Learn; Fuel / Coach stay paywalled.
- [ ] Book with Ricky stores a request. VIP/Platinum can flag an included strategy credit. Intensives stay a Platinum stub.
- [ ] Elite / VIP / Platinum show a waitlist when the pilot cap is full.
- [ ] Privacy: staff trends do not list meals. Help requests move open → seen → closed.
- [ ] Admin can verify gym membership, assign a pilot plan, restore/mark a credit, invite emails, and see signup / weekly-active counts (counts only).
- [ ] Reminders can be turned off in one screen.
- [ ] Timestamped clips: Fighter Development+ can upload; another member cannot open the file; assigned coach can add mm:ss + drill. Not shown as a live stream.
- [ ] Monthly challenge: opt-in beginner/advanced; progress is days active, not heaviest lift. Quiet days stay okay.
- [ ] Meal-prep builds a grocery list from saved meals + optional swaps. Allergy line says verify ingredients. Estimates stay labeled.
- [ ] Weekly focus video: drafts hidden; published week shows on Today for Performance+. Member Access sees a teaser. Not a live stream.
- [ ] **Go-live pack:** repo is private; this PR is reviewed; hosted preview URL is written down only after a real Vercel+Neon (or Docker) deploy (steps below — no URL is claimed here); Stripe stays TEST; invite list is 15–20 adults; DEMO vs real content labels are honest; Elite/VIP response times are on Pricing; no live billing until Ricky authorizes it.

If any of those fail, do **not** expand the pilot yet.

## How we would measure the pilot (light metrics)

The app stores **counts only** (`workout_logged`, `food_logged`, `lesson_completed`, `help_requested`, `reminder_shown`). No food names, no chat text, no card numbers.

Suggested questions for a 4–8 week private pilot:

- **Weekly active use:** how many distinct members recorded at least one of those events in the last 7 days? (That is “showed up in the app,” not a shame score.)
- **Second-month renewal (TEST):** of members who got an `invoice.paid` webhook, how many got another `invoice.paid` about 30 days later vs `customer.subscription.deleted` / `past_due`? Stripe TEST is still not live money.

Do not use days-active copy as a public leaderboard.

## Hosted preview (phone-friendly URL — none is claimed here)

This repo can run on **Vercel + Neon (or Vercel Postgres)**. The files `vercel.json` and `Dockerfile` do **not** mean a public site exists until you deploy with **your** accounts. This README never invents a live URL.

SQLite (`file:./dev.db`) stays for the laptop only. Vercel’s disk is not a real database. Hosted deploys **must** use Postgres.

### A. Create a Postgres database (Neon — free)

1. Open [https://neon.tech](https://neon.tech) and create an account (GitHub login is fine).
2. Click **New project**. Name it something like `svg-performance-preview`. Pick any region close to you. Create.
3. On the project page, find **Connection string**. Copy the string that starts with `postgresql://`.
4. If Neon shows two strings, start with the one that does **not** have `-pooler` in the host name (that one is simpler for the first deploy). If a later build asks for a pooled URL, you can switch.
5. Keep that string private. Do not paste it into this repo or into a public chat.

**Vercel Postgres** is also fine: in a Vercel project, Storage → Create Database → Postgres, then copy `DATABASE_URL`.

### B. Create a random AUTH_SECRET

On your laptop, in a terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the printed line. That is `AUTH_SECRET`. Not a Stripe key.

### C. Import the GitHub repo on Vercel

1. Open [https://vercel.com](https://vercel.com) and sign in (GitHub is easiest).
2. **Add New… → Project** and import `rickysvg/Svg-performance` (or your fork).
3. Framework should be **Next.js**. Leave the root folder as `.`
4. **Do not deploy yet.** Open **Environment Variables** and add these three names (Production + Preview):

   | Name | Value |
   | --- | --- |
   | `AUTH_SECRET` | The random string from step B |
   | `DATABASE_URL` | The `postgresql://…` string from Neon (not `file:./dev.db`) |
   | `APP_URL` | Leave a placeholder like `https://example.vercel.app` for the first deploy, then fix it in step D |

5. Leave every `STRIPE_*` name **empty** unless you are ready for Stripe **TEST** (`sk_test_…` only). Never `sk_live_`.
6. Click **Deploy**. Wait until Vercel says the build succeeded.
7. Open the URL Vercel shows you on your phone. That is your preview. Write it down yourself. This document still does not claim one.

The build runs `node scripts/prisma-prepare.mjs --deploy`, which generates the Postgres Prisma client and runs `prisma db push` (creates tables). It will **fail on purpose** if `DATABASE_URL` is missing or still a SQLite `file:` URL.

### D. Put the real URL into APP_URL

1. Copy the URL Vercel actually gave you (it looks like `https://something.vercel.app`).
2. Vercel → Project → Settings → Environment Variables → `APP_URL` → paste that real URL.
3. Redeploy once (Deployments → … → Redeploy). Password-reset links and Stripe return URLs need this.
4. Do not put a guessed URL on flyers or Instagram until you have opened it yourself.

### E. Optional: DEMO program and lessons on the host

The first deploy has empty tables (no DEMO program until you seed). Home still loads — it shows an empty training CTA instead of “This page hit a snag.” Seed when you want the DEMO days and lessons:

```bash
DATABASE_URL="postgresql://PASTE_THE_SAME_NEON_STRING" npm run db:seed
```

That writes the labeled DEMO program and DEMO lessons into Neon. It does not enable live billing.

Then create your admin account on the hosted site and run (still on the laptop, same `DATABASE_URL`):

```bash
DATABASE_URL="postgresql://PASTE_THE_SAME_NEON_STRING" npm run admin:promote -- you@example.com
```

### F. Stripe TEST on a host (optional, later)

Same beginner walkthrough as the laptop Stripe section. Point a Dashboard **TEST** webhook or `stripe listen --forward-to {your-real-APP_URL}/api/stripe/webhook`. Affirm/Klarna still need Dashboard TEST payment methods. **No live mode.**

### Docker (laptop or a VPS you control)

```bash
docker build -t svg-performance .
docker run --rm -p 3000:3000 --env-file .env svg-performance
```

- Laptop SQLite: keep `DATABASE_URL=file:./dev.db` and mount a volume over `prisma/` and `uploads/` if you want data to survive the container.
- VPS Postgres: set `DATABASE_URL` to your `postgresql://…` string. On start the container runs the same prepare + `db push` path.

There is **no** production URL in this document on purpose.

## Database notes

- **Laptop / `npm test`:** SQLite. `npm run setup` still uses `file:./dev.db` and the existing Prisma migrations.
- **Hosted preview:** Postgres. `scripts/prisma-prepare.mjs` copies `prisma/schema.prisma` → `prisma/schema.postgres.prisma` and runs `db push`. We do not replay SQLite migration SQL on Postgres (those files are SQLite-only).
- Never commit `.env` or a real connection string.

## Known limitations

- One DEMO strength program. DEMO lessons only. Not a personalized coach plan.
- Food numbers are estimates (typed or from a tiny DEMO list). No barcode database, no photo AI.
- Progress photos are stored on the server disk in this preview (not S3). Only the owner can view them. No public CDN.
- Form videos and Learn technique videos are public YouTube references, not SVG coaching films. Two DEMO strength moves and one DEMO cage-exit lesson are pending coach review.
- SVG Coach knowledge is a fillable pack in `content/coach-savage/` (folder name kept). Interview questions are not loaded into the model.
- Password reset email and live model replies need extra keys.
- Stripe is TEST structure only until keys + webhook forwarding are added. No live mode. Affirm/Klarna need Dashboard TEST payment methods; still not live money.
- Apple Health Phase 1 is file import only. Automatic Watch sync needs a native iOS companion / HealthKit (Phase 2). Polar is optional. Garmin OAuth is later. No medical diagnosis.
- No Gymdesk, no fight-camp weight-cut tools, no voice, no native apps.

### Later / not in this pass (backlog only)

- Native iOS companion + HealthKit for automatic Apple Watch / Apple Health sync
- Garmin full OAuth
- Ricky voice-note of the week
- Offline workout cards
- Native / PWA push beyond the existing reminder pattern (in-app after the preferred hour; email if SMTP)
- Fighter-week challenge badges (separate from the monthly consistency challenge)
- Coach-authored shorts CMS beyond the weekly 60–90s focus video
- SVG Coach long-term memory with consent UI

## Source

- App code: `src/`
- Database: `prisma/` (SQLite schema + generated `schema.postgres.prisma`)
- Hosted DB helper: `scripts/prisma-prepare.mjs`
- Coach notes: `content/coach-savage/`
- Why we chose these tools: `DECISIONS.md`
