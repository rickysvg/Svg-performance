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
- Only `role=admin` can flip verification (`setGymMembershipVerified`).
- Draft prices $19 / $29 live on `/pricing` as PROPOSAL / Stripe TEST.
- Checkout is created server-side. Access becomes `subscription.status=active` only from `applyStripeEvent` after a signed webhook. The `/billing/success` page never grants access.
- If Stripe TEST keys are missing, checkout stays disabled and nobody is faked as paid. Training (M1) still works. Nutrition / Learn / Coach stay open in this preview-without-keys mode.
- If keys are present, Nutrition / Learn / Coach require a webhook-confirmed active subscription.
- Live `sk_live_` secrets are rejected.

## Milestone 2

- **Nutrition:** private manual estimates (`source=manual_estimate`). Owner can correct. No photo AI.
- **Learn:** seeded DEMO lessons + one draft. Members see published only. Admin draft/publish.
- **Coach Savage AI:** safety classifier runs before any model call. Offline templates if `OPENAI_API_KEY` is empty. Knowledge stubs live in `content/coach-savage/` for later file upload.
- **Roles:** `member` (default), `coach` (reserved), `admin`. Promote with `npm run admin:promote`.
- **Stripe package** is used for TEST Checkout + webhook signature helpers. No raw cards stored.

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

## Out of scope

- Fight-camp weight cuts, Gymdesk, wearables, voice, native apps, live Stripe production, a real paid video library.
