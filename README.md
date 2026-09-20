# SVG Performance

Private-preview web app for **SVG MMA Academy** (Ricky Maynez, El Paso).

This is a member companion you can run on a laptop. A new person can create an account, follow one labeled **DEMO** strength program, save a workout, log a meal estimate, open a DEMO lesson, and talk to Coach Savage AI (offline if no API key).

It does **not** charge live cards, talk to Gymdesk, or claim Ricky types each AI reply.

## What you can do in this preview

1. Create an account, log in, log out, and reset a password.
2. Save a short adult profile (goal, experience, equipment, available days, lb or kg, food preferences).
3. Use Home to answer: *What am I working toward? What should I do today? What progress am I making?*
4. Open the one **DEMO** strength & conditioning program (sets, reps, load, rest).
5. Log a session, see it in history, and fix a mistaken number.
6. See a simple progress view built from those logs.
7. Log meals by hand (calories/macros are **manual estimates**). Correct them later.
8. Browse a small **DEMO** Learn library. Bookmark or mark complete. Admins can draft/publish.
9. Chat with Coach Savage AI. Safety rails refuse pain, medical, weight-cut, and other-member record requests. No API key = honest offline/DEMO answers.
10. Open the real [SVG & CO shop](https://www.svgandco.com) (we do not invent products or prices).
11. See draft $19 / $29 TEST prices. Checkout only runs if Stripe TEST keys are set. Access is granted only by webhook, not by the success page.
12. Admins can verify gym members. Checking “I train at SVG” still grants nothing.

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

Or set `ADMIN_BOOTSTRAP_EMAIL` to that email and run `npm run db:seed` again.

### Environment variable names

See `.env.example`. Names only — put real values in your private `.env`:

| Name | What it is for |
| --- | --- |
| `DATABASE_URL` | Database location. Preview default: `file:./dev.db` |
| `AUTH_SECRET` | Long random string used to hash session and reset tokens |
| `APP_URL` | Public address (`http://localhost:3000` locally) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Optional mail. Empty = on-screen PREVIEW reset link |
| `ADMIN_BOOTSTRAP_EMAIL` | Optional. Seed promotes this existing account to admin |
| `OPENAI_API_KEY` `OPENAI_MODEL` | Optional. Empty = Coach Savage stays offline/DEMO |
| `STRIPE_SECRET_KEY` | Optional. Stripe **TEST** secret only (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Optional. Needed to verify webhooks |
| `STRIPE_PRICE_GYM` | Optional. TEST price id for $19 gym plan |
| `STRIPE_PRICE_STANDALONE` | Optional. TEST price id for $29 plan |

Never put a live `sk_live_` key in this preview. Live keys are rejected.

If Stripe keys are missing: checkout buttons stay off and nobody is marked paid. Training still works.

If OpenAI is missing: Coach Savage still refuses unsafe asks and answers common questions from DEMO notes.

## Tests

```bash
npm test
```

Coverage includes:

- Auth, password reset, and workout ownership (Milestone 1)
- Nutrition ownership (user B cannot edit user A’s food log)
- Draft lessons stay hidden until an admin publishes
- Coach Savage refusals: pain, weight-cut, cross-account
- Gym checkbox does not verify; only an admin can
- Stripe webhook signature check; gym plan webhook refused if unverified

See `EVALS.md` for the Coach Savage evaluation set.

## Preview walkthrough

1. `npm install && npm run setup && npm run dev`
2. Create an account (18+ required)
3. Training → start **DEMO — Day 1** → save a workout → refresh History
4. Fuel → log a meal estimate → open it and correct a number
5. Learn → open a DEMO lesson → bookmark / complete
6. More → Coach Savage AI → ask about a missed class; also try a weight-cut question and watch the refusal
7. Pricing → confirm checkout is off unless TEST keys exist
8. Promote an admin, verify a gym member, confirm the $19 price is still TEST-only

## Database notes

- Preview: **SQLite** at `prisma/dev.db` (not committed).
- Production later: switch Prisma to PostgreSQL.

## Known limitations

- One DEMO strength program. DEMO lessons only. Not a personalized coach plan.
- Food numbers are whatever the member types. No barcode database, no photo AI.
- Coach Savage knowledge base is a small DEMO stub in `content/coach-savage/`.
- Password reset email and live model replies need extra keys.
- Stripe is TEST structure only until keys + webhook forwarding are added.
- No Gymdesk, no fight-camp weight-cut tools, no native apps.

## Proposed Milestone 3

- Approved coaching files uploaded into the knowledge base
- Stripe TEST end-to-end on a hosted preview with webhook forwarding
- Admin publish for strength programs (not only lessons)
- Coach role: assigned members only
- Optional Postgres move

## Rough cost notes (assumptions, not invoices)

- This preview without keys: **$0** beyond the computer it runs on.
- Hosted Next.js + Postgres later: often about **$0–$25/month** on a starter host.
- Stripe TEST: no live charges. Live card fees only after production billing exists.
- OpenAI: only if `OPENAI_API_KEY` is set (budget a few dollars per active member per month until you measure).

## Source

- App code: `src/`
- Database: `prisma/`
- Coach DEMO notes: `content/coach-savage/`
- Why we chose these tools: `DECISIONS.md`
