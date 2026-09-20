# SVG Performance

Private-preview web app for **SVG MMA Academy** (Ricky Maynez, El Paso).

This is a member companion you can run on a laptop. A new person can create an account, follow one labeled **DEMO** strength program, save a workout, refresh the page, and still see that workout.

It does **not** charge cards, talk to Gymdesk, or claim to be a finished Coach Savage AI.

## What you can do in this preview

1. Create an account, log in, log out, and reset a password.
2. Save a short adult profile (goal, experience, equipment, available days, lb or kg).
3. Use Home to answer: *What am I working toward? What should I do today? What progress am I making?*
4. Open the one **DEMO** strength & conditioning program (sets, reps, load, rest).
5. Log a session, see it in history, and fix a mistaken number.
6. See a simple progress view built from those logs.
7. Open the real [SVG & CO shop](https://www.svgandco.com) (we do not invent products or prices).

Checking **“I train at SVG MMA Academy”** does **not** give a discount or extra access. Membership has to be verified later by an admin. That switch is not in this preview.

Draft prices on `/pricing` ($19 gym / $29 standalone) are a **proposal only**. No live Stripe charges.

## What you need on your computer

- Node.js 20 or newer
- npm (comes with Node)

No Postgres install is required for this preview. The app uses a local SQLite file so it runs without a separate database server.

## First-time setup

From this folder:

```bash
npm install
npm run setup
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

`npm run setup` will:

- create a local `.env` if you do not already have one
- create the database tables
- load the DEMO program

### Environment variable names

See `.env.example`. Names only — put real values in your private `.env`:

| Name | What it is for |
| --- | --- |
| `DATABASE_URL` | Database location. Preview default: `file:./prisma/dev.db` |
| `AUTH_SECRET` | Long random string used to hash session and reset tokens |
| `APP_URL` | Public address of the app, used in reset links (`http://localhost:3000` locally) |
| `SMTP_HOST` | Optional mail server. Leave empty in preview. |
| `SMTP_PORT` | Optional |
| `SMTP_USER` | Optional |
| `SMTP_PASS` | Optional |
| `SMTP_FROM` | Optional |

If SMTP is empty, “Forgot password” shows a one-time **PREVIEW ONLY** link on the screen instead of sending email.

## Tests

```bash
npm test
```

These tests create two users and prove that user B cannot read, change, or delete user A’s workout by guessing an ID. They also cover signup, login, password reset, and the gym-member checkbox **not** verifying membership.

Last run during this build: see the pull request notes after `npm test`.

## Preview walkthrough (for handoff)

1. `npm install && npm run setup && npm run dev`
2. Open the site → **Create a preview account** (18+ checkbox required)
3. Optionally check “I train at SVG…” and notice it does not unlock pricing
4. Home → finish the profile if prompted
5. Training → start **DEMO — Day 1** → enter a few reps/loads → **Save completed workout**
6. Refresh the page — the session is still there under History
7. Open Progress — volume uses your saved numbers
8. Shop → links leave this app and open svgandco.com

## Database notes

- Preview: **SQLite** file at `prisma/dev.db` (created by setup, not committed).
- Tables live in `prisma/schema.prisma`. Migrations live in `prisma/migrations`.
- Production later: switch Prisma to PostgreSQL and set `DATABASE_URL` to the hosted database. Do not copy the SQLite file into production.

## Known limitations

- One DEMO program only. Not a personalized coach plan.
- Password reset email is not sent unless someone later wires SMTP.
- Nutrition, Learn, and Coach Savage AI are labeled placeholders.
- No live billing, no Gymdesk, no fight-camp weight-cut tools.
- Shop does not show prices or inventory on purpose.
- SQLite is fine for a private preview, not for many users at once.

## Proposed Milestone 2

- Manual nutrition / food log
- Small tutorial library with draft/publish
- Coach Savage AI text chat with safety rails and an empty knowledge-base folder
- Stripe Checkout **TEST** mode for the draft $19 / $29 plans, plus webhooks
- Admin screen to verify gym members and publish programs

## Rough cost notes (assumptions, not invoices)

- This preview: **$0** beyond the computer it runs on (SQLite, no paid auth).
- A small hosted Next.js app + managed Postgres later: often about **$0–$25/month** on a starter host, more if traffic grows.
- Stripe: no platform fee until charges are actually turned on. Card fees apply only after live payments exist.
- Coach Savage AI later: model API cost depends on usage (budget a few dollars per active member per month until you measure).

## Source

- App code: `src/`
- Database: `prisma/`
- Why we chose these tools: `DECISIONS.md`
