# Decision log — SVG Performance

Written for later agents and for Ricky. Short reasons, not a novel.

## Stack

- **Next.js App Router + TypeScript + Tailwind v4.** Matches the requested preview stack and stays one repo.
- **Prisma 6 + SQLite file database.** Postgres is the better production home, but this cloud preview VM does not provide a managed Postgres box. SQLite lets register / login / workout logs work on a laptop with no extra service (`DATABASE_URL=file:./dev.db` → `prisma/dev.db`). Switching later means changing `provider` and `DATABASE_URL`, then running a new migration.
- **Custom email/password auth (not Clerk, not Auth.js).** No paid account. Sessions are random tokens stored hashed in the database and sent as an httpOnly cookie (`svg_session`). Easier to test ownership than a hosted auth product.
- **Vitest** for auth and ownership tests against a separate `prisma/test.db`.

## Auth choices

- Password recovery is included. There is **no SMTP** in this preview by default, so “Forgot password” shows a one-time **PREVIEW ONLY** reset link on the page.
- If `SMTP_HOST` is set, reminder emails can send. Password reset still uses the preview-link path unless a later change wires it to the same mailer.
- Passwords are hashed with bcrypt (12 rounds). Reset tokens are hashed with `sha256(AUTH_SECRET + token)`.
- Adult confirmation is required at signup. The app is an adult pilot.

## Gym membership vs payment

- `claimsGymMembership` is a self-report checkbox.
- `gymMembershipVerified` defaults to `false` and **cannot** be set from the profile form or register action.
- Only `role=admin` can flip verification (`setGymMembershipVerified`).
- Draft prices $19 / $29 live on `/pricing` as PROPOSAL / Stripe TEST.
- Checkout is created server-side. Access becomes `subscription.status=active` only from `applyStripeEvent` after a signed webhook. The `/billing/success` page never grants access.
- Duplicate Stripe event ids are stored in `StripeEventLog` and skipped.
- Failed payment → `past_due`. Cancel / unpaid / incomplete_expired → not granted. `invoice.paid` is treated as renewal. `currentPeriodEnd` in the past is treated as expired.
- If Stripe TEST keys are missing, checkout stays disabled and nobody is faked as paid. Training (M1) still works. Nutrition / Learn / Coach stay open in this preview-without-keys mode.
- If keys are present, Nutrition / Learn / Coach require a webhook-confirmed active subscription.
- Live `sk_live_` secrets are rejected.

## Milestone 2

- **Nutrition:** private manual estimates (`source=manual_estimate`). Owner can correct. No photo AI.
- **Learn:** seeded DEMO lessons + one draft. Members see published only. Admin draft/publish.
- **Coach Savage AI:** safety classifier runs before any model call. Offline templates if `OPENAI_API_KEY` is empty.
- **Roles:** `member` (default), `coach`, `admin`. Promote with `npm run admin:promote` or `npm run staff:promote -- email coach`.
- **Stripe package** is used for TEST Checkout + webhook signature helpers. No raw cards stored.

## Milestone 3

- **Nav:** Train / Fuel / Learn / Coach / Shop on the phone bar. Logo → Home. Profile in the header. That matches the “easy five” without crowding six tabs.
- **Home today:** suggested DEMO workout (or draft), food nudge if nothing logged, unfinished published lesson, plus days active this week. Copy never calls a quiet week a failure.
- **Reminders:** on/off + preferred local hour. Due once per local day on Home. Email only if SMTP is configured. Disabled types stay silent. Already-logged types stay silent.
- **Reports:** coaches see assigned members only. Admins see all members. Payload is counts + last-active timestamp. There was no existing “share food diary” permission, so lists stay trends-only on purpose.
- **Help requests:** real statuses `open | seen | closed`. Copy says this is not 24/7.
- **Food search:** tiny DEMO commons list + per-user saved meals. Still manual estimates.
- **Knowledge pack:** `INTERVIEW.md` is a worksheet and is **excluded** from runtime KB so raw questions are not answered as if they were policy. `COACHING_GUIDE.md` + `DEMO-seeds.md` load first.
- **Metrics:** event **names** only (`workout_logged`, etc.). No sensitive payloads.

## Demo program

- One seeded program: `DEMO — Strength Base for Class` (3 days, sets / reps / load text / rest).
- Labeled DEMO in the UI. Not claimed as a coach-assigned fight-camp plan.

## Shop

- In-app shop only links to live `https://www.svgandco.com` pages that were fetched during this build.
- No invented products, prices, or stock. The store is the source of truth.

## Brand

- Official **SVG Performance** lockup (mountain, star, SVG + PERFORMANCE bar) lives at `public/svg-performance-logo.png` and is the primary `Logo` mark (sm/md/lg). Alt text is “SVG Performance”.
- Older MMA Academy SVGs (`public/logo.svg`, `public/logo-mark.svg`) remain on disk as unused fallbacks only. The UI does not show them.
- Accent hex **`#D0FF00`** was sampled from the neon V and the PERFORMANCE bar on that official mark (replacing the old MMA Academy `#CFFF00`). Black / white / that neon only, high contrast, athletic.

## Authorization

- Workout / food / saved-meal / chat read / update / delete always filters by `userId`.
- If the row exists but belongs to someone else, the data layer throws `ForbiddenError`. Pages map that to a generic not-found so IDs are not confirmed to strangers.
- Tests cover user A vs user B ID swapping, coach vs unassigned member, and Stripe gym-plan webhooks on unverified profiles.

## Out of scope

- Fight-camp weight cuts, Gymdesk, wearables, voice, native apps, live Stripe production, a real paid video library, photo food AI.
