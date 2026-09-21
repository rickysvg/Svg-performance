# SVG Performance

Private-preview web app for **SVG MMA Academy** (Ricky Maynez, El Paso).

This is a member companion you can run on a laptop. A new person can create an account, follow one labeled **DEMO** strength program, save a workout, tap **Watch form** for a YouTube technique video, log a meal estimate, open a DEMO lesson, talk to Coach Savage AI, and use a Home screen with a greeting, week strip, nutrition rings, and a + button.

It does **not** charge live cards, talk to Gymdesk, connect wearables, or claim Ricky types each AI reply.

## What you can do in this preview

1. Create an account, log in, log out, and reset a password.
2. Save a short adult profile (goal, experience, equipment, available days, lb or kg, food preferences).
3. Use Home for: greeting, a **week strip**, nutrition goal rings (estimates), today’s DEMO workout card, days active this week (no shame copy), unfinished lesson, coach help status, and shop.
4. Open the one **DEMO** strength & conditioning program (sets, reps, load, rest). Tap **Watch form** for a YouTube proper-form reference (or see “Video pending coach review”).
5. Log a session, see it in history, and fix a mistaken number.
6. See **My Progress**: type body weight / sleep / resting HR / lean mass / body fat yourself, see calories from food logs, **upload private progress photos** (jpeg/png/webp), plus workout charts. No fake watch sync.
7. Log meals by hand. Search a small **DEMO** food list or your saved meals. Calories/macros are **manual estimates**. Correct them later.
8. Browse a small **DEMO** Learn library. Bookmark or mark complete. Admins can draft/publish.
9. Chat with Coach Savage AI. Safety rails refuse pain, medical, weight-cut, and other-member record requests. Knowledge prefers `COACHING_GUIDE.md` + DEMO seeds. No API key = honest offline/DEMO answers.
10. Request human coach help from Home (status: open / seen / closed — not a 24/7 promise).
11. Open the real [SVG & CO shop](https://www.svgandco.com) (we do not invent products or prices).
12. See draft **App Plans / Online Coaching / VIP Experiences** on Pricing (gym vs nonmember, PROPOSAL / TEST). Checkout only runs if Stripe TEST keys are set. Access is granted only by webhook, not by the success page.
13. See **My plan** for the current catalog plan and this month’s coaching credits. Admins can assign/override a plan for the pilot and mark a credit used.
14. **Book with Ricky**: Fighter Mindset $75/30, Entrepreneur Strategy $125/45, plus Platinum intensive request stubs. Not a live calendar. Coach Savage is not Ricky.
15. Admins can verify gym members. Checking “I train at SVG” still grants nothing.
16. Coaches/admins can see assigned-member **trends** (workouts, lessons, AI handoff flags, last active) — not private food diaries.

Bottom navigation (phone): **Home · Train · Fuel · Learn · Coach**. Shop and **Book** are in the header (and on Home). The + button is a quick add for workout, food, or a body metric. Profile is in the header. Paid app plans are **additional to gym dues**.

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
| `S3_BUCKET` `S3_REGION` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` `S3_ENDPOINT` | Names only for a later cloud disk. **Not wired** in this preview |

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
2. Create an account (18+ required)
3. Training → start **DEMO — Day 1** → tap **Watch form** (YouTube) → save a workout → refresh History
4. Fuel → search “chicken” in the DEMO list or save a meal → log an estimate → correct a number
5. Learn → open a DEMO lesson → bookmark / complete
6. Coach → ask about a missed class; also try a weight-cut question and watch the refusal
7. Home → greeting, week strip, nutrition rings, today’s workout card, + button, days active this week, optional reminder after your hour
8. Progress → type a body weight; leave sleep empty and read the “no fake device sync” note; upload a jpeg/png/webp photo (private to you)
9. Profile → turn a reminder off; optional nutrition targets
10. Pricing → three sections, gym vs nonmember, checkout off unless TEST keys exist
11. Plan → see current plan + credits; Book → send a mindset request (not a calendar slot)
12. Promote an admin, verify a gym member, assign a plan on Admin → Plans & credits
13. Promote a coach, assign a member, open Staff → trends (no food names)

## Pilot go / no-go checklist

Use this before inviting ~15–20 adults. Check a box only if you actually tried it.

- [ ] Signup works (18+ confirmation). Logout / login / password reset behave.
- [ ] Gym checkbox does **not** unlock $19 or paid tools by itself.
- [ ] Home shows a greeting, week strip, nutrition rings (estimates), a today workout card, and a + quick-add.
- [ ] Days-active copy never shames a quiet week.
- [ ] Train: DEMO program opens; **Watch form** opens a YouTube technique video (or shows pending); a logged workout survives refresh; a wrong number can be corrected.
- [ ] Fuel: DEMO search or saved meal fills the form; estimates stay labeled; owner can correct; another account cannot open that log.
- [ ] Learn: members see published DEMO lessons only; bookmark / complete stick.
- [ ] Coach Savage: missed-class answer is usable; pain / weight-cut / other-member asks are refused; offline still works without an OpenAI key.
- [ ] Progress: a typed body weight saves; sleep/HR can stay empty with “no fake device sync”; a jpeg/png/webp photo uploads, shows, and deletes; another account cannot open that URL.
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
- Form videos are public YouTube references, not SVG coaching films. Two DEMO moves are pending coach review.
- Coach Savage knowledge is a fillable pack in `content/coach-savage/`. Interview questions are not loaded into the model.
- Password reset email and live model replies need extra keys.
- Stripe is TEST structure only until keys + webhook forwarding are added. No live mode.
- No Gymdesk, no fight-camp weight-cut tools, no wearables, no voice, no native apps.

## Source

- App code: `src/`
- Database: `prisma/`
- Coach notes: `content/coach-savage/`
- Why we chose these tools: `DECISIONS.md`
