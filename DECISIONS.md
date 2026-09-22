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
- Draft catalog lives on `/pricing` as three sections (App Plans, Online Coaching, VIP Experiences) with gym vs nonmember columns and PROPOSAL / TEST labels. $19 / $29 remain the SVG Performance gym / nonmember pair.
- Checkout is created server-side. Access becomes `subscription.status=active` only from `applyStripeEvent` after a signed webhook. The `/billing/success` page never grants access.
- Duplicate Stripe event ids are stored in `StripeEventLog` and skipped.
- Failed payment → `past_due`. Cancel / unpaid / incomplete_expired → not granted. `invoice.paid` is treated as renewal. `currentPeriodEnd` in the past is treated as expired.
- If Stripe TEST keys are missing, checkout stays disabled and nobody is faked as paid. Training (M1) still works. Nutrition / Learn / Coach stay open in this preview-without-keys mode.
- If keys are present, Nutrition / Coach Savage require a webhook-confirmed **Performance+** plan. Learn stays open on Member Access as **beginner-only**. Training / progress / shop stay open.
- Live `sk_live_` secrets are rejected.

## Milestone 2

- **Nutrition:** private manual estimates (`source=manual_estimate`). Owner can correct. No photo AI.
- **Learn:** seeded DEMO lessons + one draft. Members see published only. Admin draft/publish. Topic values are martial arts (mma, muay-thai, boxing, wrestling, jiu-jitsu, cagework). Browse defaults to Beginner.
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

## Milestone 4

- **Home UX:** Inspired by Fight Science Collective *layout ideas only* (greeting, week strip, nutrition rings, workout card, FAB). We did not copy their logo, red medical cross, colors, or assets. SVG uses black / white / `#D0FF00`, academy-first copy, and our own logo.
- **Nav:** Phone bar is **Home · Train · Fuel · Learn · Coach**. Shop is on Home plus the header so it stays reachable without crowding a sixth tab.
- **Nutrition rings:** Today’s (or selected day’s) food logs vs profile targets. New accounts start at DEMO estimates **2200 / 140 g / 220 g / 70 g** — not copied from another gym’s numbers. Always labeled estimates.
- **Progress:** Manual body metrics (`weight`, `sleepHours`, `restingHr`, `leanMass`, `bodyFat`). Sleep / LBM / body fat stay typed. Resting HR on Progress prefers `HrRestingSample` (Apple Health / Polar / manual / DEMO) and falls back to the typed body metric.
- **Wearables (Phase 1 Apple Health first):** Primary UI is Connect Apple Health with honest “web cannot pair Watch” copy plus JSON / XML / CSV import (`apple_health`, `apple_watch_import`). Polar AccessLink stays available but secondary. Manual avg/max is a backup. “Apple Watch connected” is never shown; `appleHealthKitBridge` is always false. Polar “connected” still requires env keys **and** a stored token. DEMO samples are labeled DEMO. Analysis (`/heart`) is RHR 7/30, last workout avg/max/zones, weekly zone bars, plain-language insights, always **not medical advice**. Phase 2 is a native iOS companion / HealthKit. We do not store raw HR streams in analytics events.

## Form video selection rules

Every DEMO exercise stores `formVideoUrl` (YouTube) **or** `formVideoPending=true` with an empty URL. UI copy is **Watch form** plus “Form reference (YouTube) — not an SVG-produced video.” Pending shows “Video pending coach review.”

How we pick a link:

1. Prefer well-known strength / coaching education channels (NASM, Jeff Nippard, ATHLEAN-X, Starting Strength / Rippetoe, Mark Wildman, Calisthenic Movement, MuscleWiki, Jump Rope Dudes, BJ Gaddour).
2. Prefer long-form technique videos with strong views / like engagement over entertainment fails and over random shorts.
3. Prefer official “how to / proper form” titles. We do not embed paid course media or Fight Science content.
4. If we cannot verify a high-quality video for that movement, we leave the URL empty and set pending. We do **not** guess a weak short.
5. Links open on YouTube. They are not claimed as SVG IP.

Current pending DEMO moves: squat jump / box step-up, and lateral bound / side step-over.

## Learn technique video selection rules

Every DEMO lesson stores `youtubeUrl` (YouTube watch link) **or** `videoPending=true` with an empty URL, plus written `notes` and bullet `keyDetails` (“details to watch for”). UI copy is **Watch on YouTube** plus “YouTube reference — not an SVG-produced video.” Pending shows “Video pending coach review.” Notes-only or video-only lessons are allowed; empty sections say pending.

How we pick a Learn link:

1. Prefer well-known instructional channels for that art (eBoxing Academy, Tony Jeffries, Kingdom Martial Arts Academy, TeachMeGrappling, Stephan Kesting, Henry Akins, Greg Jackson, Chess Club Jiu-Jitsu sprawl).
2. Prefer long-form technique or illustrated-detail videos with strong engagement over fight highlights and over random shorts.
3. Prefer official “how to / details” titles. We do not embed paid course libraries or claim SVG produced the film.
4. If we cannot verify a high-quality public video for that move, we leave the URL empty and set pending. We do **not** guess a weak short.
5. Links open on YouTube. They are not claimed as SVG IP.

Current pending DEMO Learn lesson: cagework fence-exit (`demo-cage-exit`). The unpublished draft is also pending.

Browse starts at **Beginner**. Intermediate samples exist so the level + martial-art chips change results. Member Access (Stripe keys on) stays beginner-only.

## Demo program

- One seeded program: `DEMO — Strength Base for Class` (3 days, sets / reps / load text / rest).
- Labeled DEMO in the UI. Not claimed as a coach-assigned fight-camp plan.
- Each exercise has a curated YouTube form link or an explicit pending flag.

## Shop

- In-app shop only links to live `https://www.svgandco.com` pages that were fetched during this build.
- No invented products, prices, or stock. The store is the source of truth.

## Brand

- Official **SVG Performance** lockup (mountain, star, SVG + PERFORMANCE bar) lives at `public/svg-performance-logo.png` and is the primary `Logo` mark (sm/md/lg). Alt text is “SVG Performance”.
- Older MMA Academy SVGs (`public/logo.svg`, `public/logo-mark.svg`) remain on disk as unused fallbacks only. The UI does not show them.
- Accent hex **`#D0FF00`** was sampled from the neon V and the PERFORMANCE bar on that official mark (replacing the old MMA Academy `#CFFF00`). Black / white / that neon only, high contrast, athletic.

## Authorization

- Workout / food / saved-meal / chat / **body metric / photo placeholder / progress photo** read / update / delete always filters by `userId`. Progress photo bytes are served only on an auth-gated route. Coaches/admins do **not** get a gallery in this milestone.
- If the row exists but belongs to someone else, the data layer throws `ForbiddenError`. Pages map that to a generic not-found so IDs are not confirmed to strangers.
- Tests cover user A vs user B ID swapping, coach vs unassigned member, and Stripe gym-plan webhooks on unverified profiles.

## Milestone 5

- **Authoritative prices** are the draft table in `PRICING_MODEL` / owner brief. We did not invent discounts or weight-cut SKUs.
- **One active monthly plan.** Higher replaces lower. Paid plans are additional to gym dues (copy on Pricing / Plan).
- **Entitlements** are code + `Subscription.plan` (catalog ids). Feature flags: training, progress, shop, learn_beginner, learn_full, nutrition, ai, conditioning, coaching.
- **Credits** (`CoachingCredit`) reset conceptually per UTC month. Admin marks used after the session. Members cannot self-spend.
- **Caps:** Elite 6, VIP 2, Platinum 1. Self-serve checkout joins waitlist when full. Admin assign/override ignores the cap so the pilot can still move seats.
- **Book with Ricky** stores a request (`preferredTimes`) — not Zoom, not a deposit. VIP/Platinum flag `usesIncludedCredit` when a strategy credit remains. Intensives are Platinum-only stubs (El Paso $1500 / travel from $4500).
- **Stripe TEST** env names exist for every paid SKU. `gym` / `standalone` webhooks still map to catalog `performance` so M2–M4 tests stay valid.
- **Coach Savage ≠ Ricky** is a shared `AI_DISCLAIMER` on Coach, Pricing coaching/VIP, Book, and Plan.
- **No live billing.** Missing keys = honest off + preview entitlements (tools stay open like M1–M4).

## Milestone 6

- **Real progress photos** live under `uploads/progress-photos/{userId}/` (or `PROGRESS_PHOTO_DIR`). Binaries are gitignored. We do not put them in `public/`.
- **Types:** jpeg / png / webp by magic bytes, 5 MB cap. Other types get a clear error.
- **Serve:** `/api/progress-photos/[id]` checks the session and ownership. Cache-Control is private, no-store.
- **S3 later:** env names only (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`). Not connected.
- **Privacy copy** on Progress: private to you; not used in analytics events. Old placeholder rows stay in the DB but the UI no longer writes them.

## First-run onboarding

- New accounts get `onboardingCompletedAt = null`. Member routes under `(member)` call `requireOnboardedUser()` and send them to `/onboarding`. Login/register also land there until the survey is saved.
- Required: display name, goal enum (+ optional note), experience, primary focus (six arts + general fitness), equipment, weekly days, units. Optional: limitations, diet, allergies, sessions/week. Adult checkbox stays on signup only.
- Personalization is honest DEMO matching: Learn default level (and art when the focus is one of the six); Home suggests an unused DEMO day (conditioning → Day 3, striking arts → Day 2, grappling/cage → Day 1). Copy says this is not custom Elite coaching.
- Nutrition targets stay the DEMO 2200 / 140 g / 220 g / 70 g estimates. We do not invent a medical calorie plan from the goal or from optional body-weight answers.
- Answers live on `Profile` and can be edited later. Completing onboarding again (if they already finished) does not clear the original timestamp.
- After required submit, `/onboarding/deeper` is optional. Skip leaves `onboardingDeepCompletedAt` null and still opens Home. Completing step 2 stores current/goal weight (display units only), session length (30/45/60), gym/home/both, competition status + optional fight date, coaching tone, and obstacles. Home shows a soft “2-minute deeper profile for better programming” prompt until step 2 is saved. Honest uses only: Coach Savage tone, session-length / location hints, competition flags for later fight-camp UI. No medical plan from weight.

## Premium feel (quotes, celebrations, difficulty, wrap, PRs)

- **Daily quote** is a curated in-app bank (`src/lib/quotes.ts`). Performance+ and higher (`daily_quote` feature) see the full line on Home. Member Access sees a short teaser + Pricing link — one free teaser, not the full bank. Preview (no Stripe keys) treats tools as open, so the full quote shows.
- Quote reminder reuses ReminderPrefs (`quoteEnabled`, `lastQuoteRemindedAt`). In-app on Home after the preferred hour; email only if SMTP is set. **True mobile push is later.**
- **Celebrations** fire after a completed workout, a newly completed lesson, a first activity of the local day (weekly-active increment), and a progress photo upload. CSS/canvas confetti in `#D0FF00` + white. `prefers-reduced-motion: reduce` skips particles and keeps the short success card.
- **Difficulty** is stored on `WorkoutSession.difficultyRating`: too_easy / just_right / hard / very_hard / extremely_difficult. Strongly prompted on the success screen after save; skip is still allowed by leaving the page. Shown in history; recent average on Home; coach/admin trends get a too-easy streak note (3+ recent too_easy). v1 does **not** auto-progress load — it only flags too-easy streaks for a human coach. No shame copy.
- **Weekly wrap** is a rolling last 7 local days (today minus 6 through today), not a Sunday-start calendar week. Counts: unique days with a completed workout, completed workouts, meal entries (count only — no food names), completed lessons in the window, and average rated difficulty when any ratings exist. Quiet weeks: “A quiet seven days. That is okay…” No shame. Home card.
- **Personal records** recalculate from existing logs (no extra table). Heaviest load per exercise name (converted to preferred units). Longest days-active streak = consecutive local days with a completed workout **or** a food log (same rule as Home days-active). Current streak is 0 if today is not active. Empty state when no load PRs and longest streak is 0. Shown on Progress.
- These features do not gate first-run onboarding.
- Still later (README backlog only): Ricky voice-note of the week, offline workout cards, native/PWA push beyond existing reminders, fighter-week challenge badges.

## Coaching experience (Today, report, paths, journal, Book)

- **Today** on Home is one card: next workout (path or DEMO day), current goal from intake, recommended Learn tutorial (level + art filters), next check-in from remaining credits / open Book request / open help / Platinum intensive stub. Beginner vs fighter copy uses experience + competition status. We never invent a fight date or a Ricky comment.
- **Weekly SVG report** (`/report`) is richer than the count wrap: strength signal from loads/PRs, conditioning note if a session mentioned it, difficulty trend, suggested next path step. Always labeled **Automated SVG summary**. Quiet weeks stay okay, not a report card.
- **Coach comment slot** is Fighter Development+ (`planHasCoachReview`). **Adjustment log** is Elite+ (`planHasEliteReview`). Empty until an assigned coach or admin writes it. Unassigned coaches are forbidden. Preview (Stripe off) treats the member as Platinum so the slot is visible and still empty.
- **Training paths** live in code (`src/lib/paths.ts`): Beginner Foundations, Build Your Gas Tank, Strength for Combat. Enrollments and completions are in the DB. Default path from onboarding. Workout / lesson / journal / rating steps can auto-complete from existing logs. Manual “mark done” can fire `?celebrate=milestone`.
- **Journal** is owner-only. Coaching tiers can receive human feedback + action items. No generated Ricky voice.
- **Book with Ricky** shows remaining credits, a prepare checklist per offer, preferred-time requests, and post-call next steps (staff-written). Booking reminders reuse ReminderPrefs (`bookingEnabled`) — in-app after the preferred hour; email if SMTP.

## Heart rate wearables (Phase 1 — Apple Health first)

- Tables: `PolarConnection`, `HrRestingSample`, `HrWorkoutSession` (zone1–5 seconds). Sources: `manual | polar | import | demo | apple_health | apple_watch_import`.
- Primary import: Health Auto Export JSON, Apple Health `export.xml` (resting `Record` + `Workout`/`WorkoutStatistics`), and CSV. Resting → `apple_health`. Workouts → `apple_watch_import`.
- Polar remains optional (OAuth + pull) and sits below Apple Health on `/heart`.
- Phase 2: native iOS companion / HealthKit for automatic Watch sync. Not faked on web.
- Garmin OAuth, medical diagnosis, and fake live streaming are out of scope.

## Out of scope

- Fight-camp weight cuts, Gymdesk, voice, native apps, live Stripe production, a real paid video library, paid-course scraping, photo food AI, claiming YouTube form or Learn videos as SVG IP, cloning Fight Science Collective brand/assets or Groups, faking Apple Watch connected on web.
