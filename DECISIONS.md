# Decision log — SVG Performance Milestone 1

Written for later agents and for Ricky. Short reasons, not a novel.

## Stack

- **Next.js App Router + TypeScript + Tailwind v4.** Matches the requested preview stack and stays one repo.
- **Prisma 6 + SQLite file database.** Postgres is the better production home, but this cloud preview VM does not provide a managed Postgres box. SQLite lets register / login / workout logs work on a laptop with no extra service (`DATABASE_URL=file:./dev.db` → `prisma/dev.db`). Switching later means changing `provider` and `DATABASE_URL`, then running a new migration.
- **Custom email/password auth (not Clerk, not Auth.js).** No paid account. Sessions are random tokens stored hashed in the database and sent as an httpOnly cookie (`svg_session`). Easier to test ownership than a hosted auth product.
- **Vitest** for auth and ownership tests against a separate `prisma/test.db`.

## Auth choices

- Password recovery is included. There is **no SMTP** in this preview, so “Forgot password” shows a one-time **PREVIEW ONLY** reset link on the page. If `SMTP_HOST` is later set, the code already has a branch; it still does not send mail until someone wires a mailer.
- Passwords are hashed with bcrypt (12 rounds). Reset tokens are hashed with `sha256(AUTH_SECRET + token)`.
- Adult confirmation is required at signup. The app is an adult pilot.

## Gym membership vs payment

- `claimsGymMembership` is a self-report checkbox.
- `gymMembershipVerified` defaults to `false` and **cannot** be set from the profile form or register action.
- Draft prices $19 / $29 live on `/pricing` as a proposal. There is no Stripe key usage and no charge.

## Demo program

- One seeded program: `DEMO — Strength Base for Class` (3 days, sets / reps / load text / rest).
- Labeled DEMO in the UI. Not claimed as a coach-assigned fight-camp plan.

## Shop

- In-app shop only links to live `https://www.svgandco.com` pages that were fetched during this build.
- No invented products, prices, or stock. The store is the source of truth.

## Brand

- Attached logo files were shown in the request but were not persisted as PNG/JPG on disk in this workspace.
- The UI uses a reconstructed SVG wordmark (`public/logo.svg`) matching the mountain + SVG + “MMA ACADEMY” layout.
- Accent hex **`#CFFF00`** was sampled from the neon V in the attached logo (bright lime-yellow). Black / white / that accent only.

## Authorization

- Workout read / update / delete always filters by `userId`.
- If the row exists but belongs to someone else, the data layer throws `ForbiddenError`. Pages map that to a generic not-found so IDs are not confirmed to strangers.
- Tests cover user A vs user B ID swapping.

## Out of scope (visible stubs only)

- Nutrition log, Learn library, Coach Savage AI chat, live billing, Gymdesk, fight-camp weight cuts, native apps.
