# SVG Performance

Private-preview web app for **SVG MMA Academy** (Ricky Maynez, El Paso).

This is a member companion you can run on a laptop. A new person can create an account, follow one labeled **DEMO** strength program, save a workout, tap **Watch form** for a YouTube technique video, log a meal estimate, open a DEMO lesson, talk to Coach Savage AI, and use a Home screen with a greeting, week strip, nutrition rings, and a + button.

It does **not** charge live cards, talk to Gymdesk, fake an Apple Watch pairing, or claim Ricky types each AI reply.

## What you can do in this preview

1. Create an account, answer a short first-run survey (goal, experience, martial art, equipment, days, units), log in, log out, and reset a password. New accounts cannot open Home until that required intake is saved.
2. Finish the required intake (name, goal, experience, martial art, equipment, days, units; optional limitations/diet/allergies). An optional second screen (weight, session length, location, competition, coaching tone, obstacles) can be skipped. Edit either later on Profile.
3. Use Home for: greeting, a **daily quote** (full on Performance+; Member Access sees a teaser), a **Today** guide (workout + goal + recommended tutorial + next check-in; beginner vs fighter copy from intake), a **weekly wrap** (last 7 days, counts only), a **week strip**, nutrition goal rings (estimates), days active this week (no shame copy), unfinished lesson, coach help status, and shop.
4. Follow a **DEMO training path** (Beginner Foundations, Build Your Gas Tank, or Strength for Combat) with milestones. Default comes from onboarding. Open the DEMO strength program (sets, reps, load, rest). Tap **Watch form** for a YouTube proper-form reference (or see “Video pending coach review”).
5. Log a session, see it in history, and fix a mistaken number.
6. See **My Progress**: type body weight / sleep / resting HR / lean mass / body fat yourself, see calories from food logs, **upload private progress photos** (jpeg/png/webp), a **personal records** board (heaviest load per exercise + longest days-active streak), plus workout charts. Open **Heart rate** for Polar (when env keys exist), manual RHR / workout HR, CSV import, and zone analysis. Open the **weekly SVG report** for an automated summary (strength / conditioning / difficulty / next focus). Coach comments stay empty until a human writes them. Apple Watch is not shown as connected on the web.
7. Log meals by hand. Search a small **DEMO** food list or your saved meals. Calories/macros are **manual estimates**. Correct them later.
8. Browse a **DEMO** Learn library filtered by athlete level (starts at Beginner) and martial art (MMA, Muay Thai, Boxing, Wrestling, Jiu-Jitsu, Cagework). Open a lesson for written key details plus a labeled YouTube reference (or “Video pending coach review”). Bookmark or mark complete. Admins can draft/publish.
9. Chat with Coach Savage AI. Safety rails refuse pain, medical, weight-cut, and other-member record requests. Knowledge prefers `COACHING_GUIDE.md` + DEMO seeds. No API key = honest offline/DEMO answers.
10. Keep a **personal coaching journal** (goals, notes, questions, lessons). Owner-only unless an assigned coach adds feedback + action items on Fighter Development+. Request human coach help from Home (status: open / seen / closed — not a 24/7 promise).
11. Connect **Polar** when `POLAR_CLIENT_ID` / `POLAR_CLIENT_SECRET` / `POLAR_REDIRECT_URI` are set. Without keys, Heart rate shows Connect Polar (TEST) and stays honest. Type RHR, record workout avg/max, import an Apple Health export / watch workout CSV (labeled import), or load labeled **DEMO** samples. Analysis is **not medical advice**.
12. Open the real [SVG & CO shop](https://www.svgandco.com) (we do not invent products or prices).
13. See draft **App Plans / Online Coaching / VIP Experiences** on Pricing (gym vs nonmember, PROPOSAL / TEST). Checkout only runs if Stripe TEST keys are set. Access is granted only by webhook, not by the success page.
14. See **My plan** for the current catalog plan and this month’s coaching credits. Admins can assign/override a plan for the pilot and mark a credit used.
15. **Book with Ricky**: eligible call types, remaining credits, a prepare checklist, preferred times, and post-call next steps (empty until a coach writes them). Not a live calendar. Coach Savage is not Ricky.
16. Admins can verify gym members. Checking “I train at SVG” still grants nothing.
17. Coaches/admins can see assigned-member **trends** (workouts, lessons, AI handoff flags, last active) — not private food diaries.

Bottom navigation (phone): **Home · Train · Fuel · Learn · Coach**. Shop and **Book** are in the header (and on Home). The + button is a quick add for workout, food, a body metric, or heart rate. Profile is in the header. Paid app plans are **additional to gym dues**.

## What you need on your computer

- Node.js 20 or newer
- npm (comes with Node)

No Postgres install is required for this preview. The app uses a local SQLite file.

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
| `DATABASE_URL` | Database location. Preview default: `file:./dev.db` |
| `AUTH_SECRET` | Long random string used to hash session and reset tokens |
| `APP_URL` | Public address (`http://localhost:3000` locally) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Optional mail. Empty = password reset shows a PREVIEW link; reminders stay **in-app on Home only** |
| `ADMIN_BOOTSTRAP_EMAIL` | Optional. Seed promotes this existing account to admin |
| `OPENAI_API_KEY` `OPENAI_MODEL` | Optional. Empty = Coach Savage stays offline/DEMO |
| `STRIPE_SECRET_KEY` | Optional. Stripe **TEST** secret only (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Optional. Needed to verify webhooks |
| `STRIPE_PRICE_GYM` | Optional. TEST price id for SVG Performance gym ($19) |
| `STRIPE_PRICE_STANDALONE` | Optional. TEST price id for SVG Performance nonmember ($29) |
| `STRIPE_PRICE_CONDITIONING_GYM` / `_NON` | Optional. Fighter Conditioning $49 / $59 |
| `STRIPE_PRICE_DEVELOPMENT_GYM` / `_NON` | Optional. Fighter Development $149 / $179 |
| `STRIPE_PRICE_ELITE_GYM` / `_NON` | Optional. Elite Online $299 / $349 (cap ~6) |
| `STRIPE_PRICE_VIP` | Optional. SVG VIP $699 (cap 2) |
| `STRIPE_PRICE_PLATINUM` | Optional. Platinum VIP $1,199 (cap 1) |
| `PROGRESS_PHOTO_DIR` | Optional. Local folder for progress photos (default `uploads/progress-photos`). Never commit those files |
| `POLAR_CLIENT_ID` `POLAR_CLIENT_SECRET` `POLAR_REDIRECT_URI` | Optional. Polar AccessLink. Empty = Connect Polar (TEST) / not configured |
| `S3_BUCKET` `S3_REGION` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` `S3_ENDPOINT` | Names only for a later cloud disk. **Not wired** in this preview |

If Polar keys are missing: Heart rate still works with manual entry, CSV import, and labeled DEMO samples. Connect Polar (TEST) stays off. We never show Apple Watch as connected.

## Polar AccessLink (TEST)

1. Create a Polar AccessLink client at the Polar developer portal.
2. Set redirect URI to `{APP_URL}/api/polar/callback` (local: `http://localhost:3000/api/polar/callback`).
3. Put `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET`, and `POLAR_REDIRECT_URI` in `.env`. Restart `npm run dev`.
4. Open **Heart rate** → **Connect Polar**. After Polar approves, use **Pull recent activities**.
5. Without keys: Connect Polar (TEST) stays disabled. Use manual HR, CSV import, or Load DEMO samples.

Never put Polar secrets in git.

Never put a live `sk_live_` key in this preview. Live keys are rejected.

If Stripe keys are missing: checkout buttons stay off and nobody is marked paid. Training still works.

If OpenAI is missing: Coach Savage still refuses unsafe asks and answers common questions from DEMO notes.

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
6. Log in, open **Pricing**, start TEST checkout. Use Stripe’s test card `4242 4242 4242 4242`, any future date, any CVC.
7. The success page does **not** unlock tools. Access changes after the webhook (`checkout.session.completed` or `invoice.paid`).
8. Duplicate webhooks are ignored. Failed payment → `past_due` (tools lock if keys are on). Cancel → no access. If the period end date is in the past, access is treated as expired.

Gym $19 still needs an **admin verify**. The gym checkbox never grants a price by itself.

Without keys: Pricing shows “not configured.” Nobody is faked as paid.

Cards never touch this app.

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
- Daily quote: Performance+ / paid catalog get the full line; Member Access sees a locked teaser; reminder uses the same in-app / SMTP pattern (no mobile push yet)
- Difficulty rating persists on a completed session; too-easy streaks flag for coaches without shame copy
- Weekly wrap: last 7 days counts (days trained, workouts, meals, lessons, avg rated feel); quiet-week copy has no shame; no food names
- Personal records: heaviest logged load per exercise and longest days-active streak, recalculated from existing logs; empty state when nothing is logged yet
- Today guide: beginner vs fighter priorities from onboarding; default DEMO path; recommended Learn lesson; check-in from credits / open request
- Weekly SVG report: labeled Automated SVG summary; no fake Ricky comment; assigned coach can write one on Fighter Development+
- Training paths: enroll, auto-complete milestones from logged DEMO days, celebration on manual mark-done
- Journal owner-only; coach feedback + action items on coaching tiers; user B cannot read user A
- Book next steps stay empty until staff writes them; booking reminder uses the existing in-app / SMTP pattern
- Heart rate ownership (user B cannot read/delete user A); Polar “connected” only with env keys + a stored token; Apple Watch connected is always false
- Zone math from sample fixtures; RHR trend / high-zone insights; CSV import labeled import; DEMO samples labeled DEMO
- Coach Savage refusals: pain, weight-cut, cross-account
- Knowledge pack loads the guide + DEMO seeds, not the interview worksheet
- Gym checkbox does not verify; only an admin can
- Stripe webhook signature, duplicates, failed payment, cancel, renewal, expiration
- Reminder prefs, no-spam, SMTP on vs in-app only
- Coach/admin report role gates; help-request statuses; no food-diary dump
- Home weekly activity copy (no shame)
- Body metric / photo-placeholder ownership (user B cannot touch user A’s numbers)
- Progress photo files: owner-only read/edit/delete; jpeg/png/webp only; coaches cannot open another member’s file
- Every seeded DEMO exercise has a YouTube form URL **or** an explicit pending flag
- Plan entitlements: Member Access vs Performance vs Elite; gym-price verify; Elite cap + waitlist
- Coach Savage ≠ Ricky disclaimer string; VIP included strategy credit on Book requests

See `EVALS.md` for the Coach Savage evaluation set.

## Preview walkthrough

1. `npm install && npm run setup && npm run dev`
2. Create an account (18+ required) → finish the required intake → optional deeper screen (or Skip) → land on Home
3. Training → start the suggested DEMO day → tap **Watch form** (YouTube) → save a workout → refresh History
4. Fuel → search “chicken” in the DEMO list or save a meal → log an estimate → correct a number
5. Learn → starts on Beginner → tap Boxing or Intermediate and watch the list change → open a lesson → read key details → **Watch on YouTube** (or pending) → bookmark / complete
6. Coach → ask about a missed class; also try a weight-cut question and watch the refusal
7. Home → greeting, daily quote, **Today** (goal + path + workout + tutorial + check-in), **weekly wrap** (last 7 days, counts only; a quiet week just says okay), week strip, nutrition rings, + button, days active this week, optional reminder after your hour
8. Progress → type a body weight; open Heart rate for Polar / manual / import; leave Apple Watch disconnected on the web; upload a jpeg/png/webp photo (private to you); see the **personal records** board (empty until a load or an active day, then heaviest load + longest streak)
9. Profile → turn a reminder off; optional nutrition targets
10. Pricing → three sections, gym vs nonmember, checkout off unless TEST keys exist
11. Plan → see current plan + credits; Book → send a mindset request (not a calendar slot)
12. Promote an admin, verify a gym member, assign a plan on Admin → Plans & credits
13. Promote a coach, assign a member, open Staff → trends (no food names)

## Pilot go / no-go checklist

Use this before inviting ~15–20 adults. Check a box only if you actually tried it.

- [ ] Signup works (18+ confirmation). New accounts hit `/onboarding` and cannot open Home until the survey is saved. Logout / login / password reset behave.
- [ ] Intake answers persist and can be edited on Profile. Learn defaults to that experience (and art when it is one of the six). Home suggests a DEMO day from the answers — still labeled DEMO.
- [ ] After required intake, the optional deeper screen can be skipped. Home then shows “2-minute deeper profile for better programming.” Completing it (or editing Profile) saves session length, location, competition, tone, and obstacles. Weight is display-only — nutrition targets stay DEMO estimates.
- [ ] Gym checkbox does **not** unlock $19 or paid tools by itself.
- [ ] Home shows a greeting, week strip, nutrition rings (estimates), a today workout card, and a + quick-add.
- [ ] Home Today shows a workout, the intake goal, a recommended tutorial, and a check-in/Book slot. Beginner and fighter copy differ. No invented fight date or Ricky comment.
- [ ] Training paths enroll from onboarding default; a logged DEMO day can complete a milestone. Journal entries stay private. Weekly report is labeled Automated SVG summary.
- [ ] Home weekly wrap shows last-7-day counts (days trained, workouts, meals, lessons, avg feel if rated). Quiet week copy is okay, not shame. No meal names on the card.
- [ ] Days-active copy never shames a quiet week.
- [ ] Train: DEMO program opens; **Watch form** opens a YouTube technique video (or shows pending); a logged workout survives refresh; a wrong number can be corrected.
- [ ] Fuel: DEMO search or saved meal fills the form; estimates stay labeled; owner can correct; another account cannot open that log.
- [ ] Learn: members see published DEMO lessons only; Beginner + martial-art chips change results; a lesson shows key details and Watch on YouTube (or pending); bookmark / complete stick.
- [ ] Coach Savage: missed-class answer is usable; pain / weight-cut / other-member asks are refused; offline still works without an OpenAI key.
- [ ] Home shows today’s quote for a Performance+ / preview account, and a teaser when Stripe is on and the plan is Member Access. Quote reminder can be turned off under Profile → Reminders. True mobile push is later.
- [ ] After saving a workout, completing a lesson, adding a first-of-day log, or uploading a photo, a short celebration appears (respects reduced motion). Completing a workout asks how it felt; history and staff trends show the rating / recent feel.
- [ ] Progress: a typed body weight saves; Heart rate tiles fill from Polar / manual / import / DEMO when data exists; Apple Watch is not shown as connected; a jpeg/png/webp photo uploads, shows, and deletes; another account cannot open that URL.
- [ ] Progress personal records: empty until a logged load or active day; then heaviest load per exercise and longest days-active streak, recalculated from existing logs.
- [ ] Shop links open live svgandco.com pages (names only, no invented prices).
- [ ] Subscription TEST: without keys, checkout stays off. With TEST keys + webhook forward, access flips only after the webhook. Cancel / failed payment do not leave someone “paid.”
- [ ] Pricing shows App / Coaching / VIP, gym vs nonmember, PROPOSAL / TEST, and “dues are separate.”
- [ ] Member Access (keys on, no sub) still trains and sees beginner Learn; Fuel / Coach stay paywalled.
- [ ] Book with Ricky stores a request. VIP/Platinum can flag an included strategy credit. Intensives stay a Platinum stub.
- [ ] Elite / VIP / Platinum show a waitlist when the pilot cap is full.
- [ ] Privacy: staff trends do not list meals. Help requests move open → seen → closed.
- [ ] Admin can verify gym membership, assign a pilot plan, and mark a credit used.
- [ ] Reminders can be turned off in one screen.

If any of those fail, do **not** expand the pilot yet.

## How we would measure the pilot (light metrics)

The app stores **counts only** (`workout_logged`, `food_logged`, `lesson_completed`, `help_requested`, `reminder_shown`). No food names, no chat text, no card numbers.

Suggested questions for a 4–8 week private pilot:

- **Weekly active use:** how many distinct members recorded at least one of those events in the last 7 days? (That is “showed up in the app,” not a shame score.)
- **Second-month renewal (TEST):** of members who got an `invoice.paid` webhook, how many got another `invoice.paid` about 30 days later vs `customer.subscription.deleted` / `past_due`? Stripe TEST is still not live money.

Do not use days-active copy as a public leaderboard.

## Database notes

- Preview: **SQLite** at `prisma/dev.db` (not committed).
- Production later: switch Prisma to PostgreSQL.

## Known limitations

- One DEMO strength program. DEMO lessons only. Not a personalized coach plan.
- Food numbers are estimates (typed or from a tiny DEMO list). No barcode database, no photo AI.
- Progress photos are stored on the server disk in this preview (not S3). Only the owner can view them. No public CDN.
- Form videos and Learn technique videos are public YouTube references, not SVG coaching films. Two DEMO strength moves and one DEMO cage-exit lesson are pending coach review.
- Coach Savage knowledge is a fillable pack in `content/coach-savage/`. Interview questions are not loaded into the model.
- Password reset email and live model replies need extra keys.
- Stripe is TEST structure only until keys + webhook forwarding are added. No live mode.
- Polar AccessLink is Phase 1. Apple Watch continuous sync is Phase 2 (HealthKit / native). Garmin OAuth is later. No medical diagnosis.
- No Gymdesk, no fight-camp weight-cut tools, no voice, no native apps.

### Later / not in this pass (backlog only)

- Full Apple Watch / Apple Health sync (native companion)
- Garmin full OAuth
- Ricky voice-note of the week
- Offline workout cards
- Native / PWA push beyond the existing reminder pattern (in-app after the preferred hour; email if SMTP)
- Fighter-week challenge badges
- Timestamped video review tool
- Full meal-prep grocery generator
- Monthly challenge engine
- Ricky weekly video CMS and coach-authored shorts CMS
- Coach Savage long-term memory with consent UI

## Source

- App code: `src/`
- Database: `prisma/`
- Coach notes: `content/coach-savage/`
- Why we chose these tools: `DECISIONS.md`
