# SVG Performance

Private-preview web app for **SVG MMA Academy** (Ricky Maynez, El Paso).

This is a member companion you can run on a laptop. A new person can create an account, follow one labeled **DEMO** strength program, save a workout, log a meal estimate, open a DEMO lesson, talk to Coach Savage AI, and (in this milestone) get Home reminders, a no-shame weekly activity count, and coach trend reports.

It does **not** charge live cards, talk to Gymdesk, or claim Ricky types each AI reply.

## What you can do in this preview

1. Create an account, log in, log out, and reset a password.
2. Save a short adult profile (goal, experience, equipment, available days, lb or kg, food preferences).
3. Use Home for: goal, **today** (suggested workout, food nudge, unfinished lesson), progress, and **days active this week** (no shame copy).
4. Open the one **DEMO** strength & conditioning program (sets, reps, load, rest).
5. Log a session, see it in history, and fix a mistaken number.
6. See a simple progress view built from those logs.
7. Log meals by hand. Search a small **DEMO** food list or your saved meals. Calories/macros are **manual estimates**. Correct them later.
8. Browse a small **DEMO** Learn library. Bookmark or mark complete. Admins can draft/publish.
9. Chat with Coach Savage AI. Safety rails refuse pain, medical, weight-cut, and other-member record requests. Knowledge prefers `COACHING_GUIDE.md` + DEMO seeds. No API key = honest offline/DEMO answers.
10. Request human coach help from Home (status: open / seen / closed — not a 24/7 promise).
11. Open the real [SVG & CO shop](https://www.svgandco.com) (we do not invent products or prices).
12. See draft $19 / $29 TEST prices. Checkout only runs if Stripe TEST keys are set. Access is granted only by webhook, not by the success page.
13. Admins can verify gym members. Checking “I train at SVG” still grants nothing.
14. Coaches/admins can see assigned-member **trends** (workouts, lessons, AI handoff flags, last active) — not private food diaries.

Bottom navigation (phone): **Train · Fuel · Learn · Coach · Shop**. The logo goes to Home. Profile is in the header.

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
| `STRIPE_PRICE_GYM` | Optional. TEST price id for $19 gym plan |
| `STRIPE_PRICE_STANDALONE` | Optional. TEST price id for $29 plan |

Never put a live `sk_live_` key in this preview. Live keys are rejected.

If Stripe keys are missing: checkout buttons stay off and nobody is marked paid. Training still works.

If OpenAI is missing: Coach Savage still refuses unsafe asks and answers common questions from DEMO notes.

If SMTP is missing: reminders still appear on Home once per day after your preferred hour. No email is sent. Turn them off under Profile → Reminders.

## Stripe TEST (beginner walkthrough)

Do this only with **test** keys. Do not turn on live billing.

1. Create a Stripe account and stay in **Test mode** (toggle in the Stripe dashboard).
2. Copy the **secret key** that starts with `sk_test_` into `STRIPE_SECRET_KEY`.
3. In Stripe, create two recurring prices (monthly). Put the price ids in `STRIPE_PRICE_GYM` ($19 idea) and `STRIPE_PRICE_STANDALONE` ($29 idea).
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

See `EVALS.md` for the Coach Savage evaluation set.

## Preview walkthrough

1. `npm install && npm run setup && npm run dev`
2. Create an account (18+ required)
3. Training → start **DEMO — Day 1** → save a workout → refresh History
4. Fuel → search “chicken” in the DEMO list or save a meal → log an estimate → correct a number
5. Learn → open a DEMO lesson → bookmark / complete
6. Coach → ask about a missed class; also try a weight-cut question and watch the refusal
7. Home → see today (workout / food / lesson), days active this week, optional reminder after your hour
8. Profile → turn a reminder off
9. Pricing → confirm checkout is off unless TEST keys exist
10. Promote an admin, verify a gym member, confirm the $19 price is still TEST-only
11. Promote a coach, assign a member, open Staff → trends (no food names)

## Pilot go / no-go checklist

Use this before inviting ~15–20 adults. Check a box only if you actually tried it.

- [ ] Signup works (18+ confirmation). Logout / login / password reset behave.
- [ ] Gym checkbox does **not** unlock $19 or paid tools by itself.
- [ ] Home shows a goal, a today workout, a food nudge or today’s fuel, and an unfinished lesson when one exists.
- [ ] Days-active copy never shames a quiet week.
- [ ] Train: DEMO program opens; a logged workout survives refresh; a wrong number can be corrected.
- [ ] Fuel: DEMO search or saved meal fills the form; estimates stay labeled; owner can correct; another account cannot open that log.
- [ ] Learn: members see published DEMO lessons only; bookmark / complete stick.
- [ ] Coach Savage: missed-class answer is usable; pain / weight-cut / other-member asks are refused; offline still works without an OpenAI key.
- [ ] Shop links open live svgandco.com pages (names only, no invented prices).
- [ ] Subscription TEST: without keys, checkout stays off. With TEST keys + webhook forward, access flips only after the webhook. Cancel / failed payment do not leave someone “paid.”
- [ ] Privacy: staff trends do not list meals. Help requests move open → seen → closed.
- [ ] Admin can verify gym membership and assign a coach.
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
- Coach Savage knowledge is a fillable pack in `content/coach-savage/`. Interview questions are not loaded into the model.
- Password reset email and live model replies need extra keys.
- Stripe is TEST structure only until keys + webhook forwarding are added. No live mode.
- No Gymdesk, no fight-camp weight-cut tools, no wearables, no voice, no native apps.

## Source

- App code: `src/`
- Database: `prisma/`
- Coach notes: `content/coach-savage/`
- Why we chose these tools: `DECISIONS.md`
