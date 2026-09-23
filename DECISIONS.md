# Decision log — SVG Performance

Written for later agents and for Ricky. Short reasons, not a novel.

## Stack

- **Next.js App Router + TypeScript + Tailwind v4.** Matches the requested preview stack and stays one repo.
- **Prisma 6 + SQLite on the laptop, Postgres on a host.** `prisma/schema.prisma` stays `provider = "sqlite"` so `npm run setup` / `npm run dev` / `npm test` keep using `file:./dev.db`. Hosted preview (Vercel + Neon or Vercel Postgres) sets `DATABASE_URL=postgresql://…`. `scripts/prisma-prepare.mjs` writes `schema.postgres.prisma` and runs `prisma db push` (SQLite migration SQL is not replayed on Postgres). Vercel builds fail if `DATABASE_URL` is missing or still a `file:` URL. No secrets in the repo. No live URL is claimed.
- **Custom email/password auth (not Clerk, not Auth.js).** No paid account. Sessions are random tokens stored hashed in the database and sent as an httpOnly cookie (`svg_session`). Easier to test ownership than a hosted auth product.
- **Vitest** for auth and ownership tests against a separate `prisma/test.db`.

## Auth choices

- Password recovery is included. There is **no SMTP** in this preview by default, so “Forgot password” shows a one-time **PREVIEW ONLY** reset link on the page.
- If `SMTP_HOST` is set, reminder emails can send. Password reset still uses the preview-link path unless a later change wires it to the same mailer.
- Passwords are hashed with bcrypt (12 rounds). Reset tokens are hashed with `sha256(AUTH_SECRET + token)`.
- Adult confirmation is required at signup. The app is an adult pilot.

## Home resilience

- Hosted Vercel runs `prisma db push` on empty Neon. It does **not** run the laptop seed. `getDemoProgram()` used to throw `NotFoundError` (“run npm run db:setup”), which took down `/home` via `getHomeToday` and `getTodayGuide` → `autoCompleteHints`. Home now treats a missing DEMO program as an empty CTA. Optional Home widgets are caught so one missing table/seed cannot replace the page with the error boundary.

## Audience

- SVG Performance is **not** SVG-members-only. It is for anybody who wants to improve performance — especially combat sports athletes, and also people getting in shape. SVG MMA Academy members are a welcome segment (admin gym-verify + member rates), not the only audience. El Paso / SVG is origin, not a gate.

## Gym membership vs payment

- `claimsGymMembership` is a self-report checkbox.
- `gymMembershipVerified` defaults to `false` and **cannot** be set from the profile form or register action.
- Only `role=admin` can flip verification (`setGymMembershipVerified`).
- Draft catalog lives on `/pricing` as three sections (App Plans, Online Coaching, VIP Experiences) with gym vs nonmember columns and PROPOSAL / TEST labels. $19 / $29 remain the SVG Performance gym / nonmember pair.
- Checkout is created server-side. Access becomes `subscription.status=active` only from `applyStripeEvent` after a signed webhook. The `/billing/success` page never grants access.
- Duplicate Stripe event ids are stored in `StripeEventLog` and skipped.
- Failed payment → `past_due`. Cancel / unpaid / incomplete_expired → not granted. `invoice.paid` is treated as renewal. `currentPeriodEnd` in the past is treated as expired.
- If Stripe TEST keys are missing, checkout stays disabled and nobody is faked as paid (including Affirm/Klarna). Training (M1) still works. Nutrition / Learn / Coach stay open in this preview-without-keys mode.
- If keys are present, Nutrition / SVG Coach require a webhook-confirmed **Performance+** plan. Learn stays open on Member Access as **beginner-only**. Training / progress / shop stay open.
- Live `sk_live_` secrets are rejected.

## Milestone 2

- **Nutrition:** private manual estimates (`source=manual_estimate`). Owner can correct. No photo AI.
- **Learn:** seeded DEMO lessons + one draft. Members see published only. Admin draft/publish. Topic values are martial arts (mma, muay-thai, boxing, wrestling, jiu-jitsu, cagework). Browse defaults to Beginner.
- **SVG Coach (AI):** member-facing name. Internal routes stay `/coach`. Safety classifier runs before any model call. Offline templates if `OPENAI_API_KEY` is empty. Members pick a topic first (Martial art + art, Conditioning, or Mental). Each topic/art pair is its own thread so switching lanes does not mix history. Topic + art are injected into the system/offline context. Knowledge pack folder remains `content/coach-savage/` (staff interview files).
- **Roles:** `member` (default), `coach`, `admin`. Promote with `npm run admin:promote` or `npm run staff:promote -- email coach`.
- **Stripe package** is used for TEST Checkout + webhook signature helpers. No raw cards or BNPL loan records stored.

## Milestone 3

- **Nav:** Primary destinations **Home · Train · Fuel · Learn · Coach** sit on a sticky **top** bar with a lime (`text-accent`) selected state. Logo, Book, Shop, Profile, and Log out sit on the **bottom** account bar. That keeps the easy five without crowding a sixth primary tab.
- **Home today:** suggested DEMO workout (or draft), food nudge if nothing logged, unfinished published lesson, plus days active this week. Copy never calls a quiet week a failure.
- **Reminders:** on/off + preferred local hour. Due once per local day on Home. Email only if SMTP is configured. Disabled types stay silent. Already-logged types stay silent.
- **Reports:** coaches see assigned members only. Admins see all members. Payload is counts + last-active timestamp. There was no existing “share food diary” permission, so lists stay trends-only on purpose.
- **Help requests:** real statuses `open | seen | closed`. Copy says this is not 24/7.
- **Food search:** tiny DEMO commons list + per-user saved meals. Still manual estimates.
- **Knowledge pack:** `INTERVIEW.md` is a worksheet and is **excluded** from runtime KB so raw questions are not answered as if they were policy. `COACHING_GUIDE.md` + `DEMO-seeds.md` load first.
- **Metrics:** event **names** only (`workout_logged`, etc.). No sensitive payloads.

## Milestone 4

- **Home UX:** Phase-1 visual refresh takes *layout energy* from Chuze Fitness (lime welcome wash, big tap tiles, VIEW ALL headers, merch color-block) and keeps SVG brand only: white shell, black ink, neon lime `#CBF805`. We did not copy Chuze blue/yellow logos, merch photos, or class booking. Today’s workout, quote, and nutrition stay. Shop promo links live svgandco.com (names only).
- **Nav:** Phone primary bar is **Home · Train · Fuel · Learn · Coach** at the **top**. Active tab is a lime pill with black text on the white shell. Shop is on Home (merch block) plus the bottom account bar. The official mountain mark sits on a black chip so the white outline stays visible.
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

Current pending DEMO moves: lateral bound / side step-over (no catalog-quality long-form we would stand behind yet). Squat jump / box step-up uses NASM’s squat-jump technique video.

List thumbs prefer the YouTube form still (`i.ytimg.com/vi/<id>/hqdefault.jpg`, then mq / img.youtube.com) with a lime play mark. They open the same Watch-form URL. Pending / invalid URLs keep the local silhouette. Copy stays “Form reference (YouTube) — not an SVG-produced video.”

## Learn technique video selection rules

Every DEMO lesson stores `youtubeUrl` (YouTube watch link) **or** `videoPending=true` with an empty URL, plus `summary` and `technicalDescription` in the catalog and on `Lesson`. UI copy is **Watch on YouTube** plus “YouTube reference — not an SVG-produced video.” Pending shows “Video pending coach review.”

How we pick a Learn link:

1. Prefer well-known instructional channels for that art (eBoxing Academy, Tony Jeffries, fightTIPS, Kingdom Martial Arts Academy, Sean Fagan, Paul Banasiak, TeachMeGrappling, Stephan Kesting, Henry Akins, Chewjitsu, Chess Club Jiu-Jitsu, Greg Jackson, Ben Askren).
2. Prefer long-form technique or illustrated-detail videos with strong engagement over fight highlights and over random shorts.
3. Prefer official “how to / details” titles. We do not embed paid course libraries or claim SVG produced the film.
4. If we cannot verify a high-quality public video for that move, we leave the URL empty and set pending. We do **not** guess a weak short.
5. Links open on YouTube. They are not claimed as SVG IP.

Source of truth is `src/lib/learn-catalog.ts`. Seed upserts from that list. Cards show thumb, channel, art + level, summary, and technical write-up. Preview (no Stripe keys) opens the full library on All / All; Member Access stays beginner-only.

Current pending DEMO Learn lesson: cagework fence-exit (`demo-cage-exit`). The unpublished draft is also pending.

## Demo program

- One seeded program: `DEMO — Strength Base for Class` (3 days, sets / reps / load text / rest).
- Labeled DEMO in the UI. Not claimed as a coach-assigned fight-camp plan.
- Each exercise has a curated YouTube form link or an explicit pending flag.

## Workout logger layout

- Day overview + active logging copy the **information architecture** of Strong-like apps (equipment chips, square movement thumbs, Start Now, Previous / Reps / Lbs table, rest timer, Add set, Insert exercise, Save). Palette stays SVG: black / white / neon lime (`#D0FF00` / `#CBF805`). We did not copy the white + red reference screens.
- Between-set rest is a tap-to-start pill (`90s`) under each exercise. One timer at a time. While running, the logger header shows a large lime `mm:ss` countdown (session elapsed clock stays) and that exercise’s pill becomes **Stop**. Stop or 0 clears. Optional web vibrate/beep. Does not auto-start when a set is checked.
- Exercise rows show the YouTube form-video still when a valid catalog / day URL exists (lime play mark; tap opens YouTube). `public/exercise-thumbs/` silhouettes are fallback only. Not claimed as SVG coaching film. YouTube **Watch form** text links stay.
- Day overview top is a short meta stack (type, **est.** minutes from sets+rest, **N Exercises**), then equipment, then the list. Start Now / Continue stays lime — we did not add a red “Mark as Complete.” App header chips hide on the day and logger screens so the brief stays the focus.
- Home is greeting + quote + today’s workout + one nutrition card. Paths, journal teases, week strip, wrap, challenge, shop, and the help form are demoted off the first screen so Today is the hero.
- Previous column reads the member’s last **completed** session for that exercise name. First-time moves stay empty. Save still delete+recreates `WorkoutSet` rows.

## Calendar list

- `/training/calendar` is a vertical **Today / Tomorrow / weekday** list (Fight Science Collective *layout only*). Palette stays SVG black / white / lime. We did not copy their logo, red, or four-icon nav. Existing Home / Train / Fuel / Learn / Coach bar and + FAB stay.
- Cards come from DEMO program days laid onto the member’s weekly availability (default Mon / Wed / Fri). Empty days are a heading + divider. Sunday can show the weekly SVG report; an enrolled monthly challenge can sit on Saturday.
- Workout cards open `/training/[dayId]` (day overview → Start Now). Copy says this is a DEMO week, not a live coach calendar, Watch sync, or Gymdesk.

## Shop

- In-app shop only links to live `https://www.svgandco.com` pages that were fetched during this build.
- No invented products, prices, or stock. The store is the source of truth.

## Brand

- Official **SVG Performance** identity is Ricky’s circular neon-badge artwork (Sep 2026): lime ring, silver mountains + star, white **S**, lime **V**, white **G**, lime **PERFORMANCE** bar on black. Primary files:
  - `public/svg-performance-badge.webp` (1024, splash + landing) via `Logo variant="badge"` / `lockup`.
  - `public/svg-performance-badge-mark.png` (256, header / account-bar chrome) via `variant="mark"`. Same circular art, not the old mountain-only crop.
  - `src/app/icon.png` is a 192 crop of that badge (favicon).
- Older mountain/star lockup PNGs and MMA Academy SVGs stay in `public/` as unused archives. They are not the app identity.
- App-open splash (`AppSplash` in the root layout) plays Ricky’s official badge video (`public/svg-performance-splash.mp4`) on first visit: square 960 clip, trimmed to the moment the neon streak closes the ring (~8.15s). The audio is the intended punch (engine/whoosh at ring-close), not background music. We try unmuted autoplay first; if the browser blocks it we play muted immediately — no tap-to-start chrome. Dismisses when the clip ends and the app is ready, then writes `sessionStorage.svg_splash_seen`. `prefers-reduced-motion` shows the closed-ring still (`svg-performance-splash-still.webp`) with a short fade — not the video. White shell + `#CBF805` + black from the Chuze refresh stay. Header chrome still uses the official circular badge from #17.
- Accent neon is the official lime (`#CBF805` / `#D0FF00`). Black / white / that neon only.

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
- **Affirm / Klarna / similar BNPL** are TEST Checkout payment methods, not a second billing stack. Checkout sends `payment_method_types` (card + Klarna/Afterpay/Affirm when the USD amount allows), then Dashboard `automatic_payment_methods` if Stripe rejects a type (common for Affirm on `mode: subscription`), then card-only. No extra secrets. Approval is Affirm’s/Klarna’s. We do not store loan details on `Subscription`. Missing keys = coming-soon copy, checkout off, never a fake BNPL success. Webhooks still grant access the same way regardless of card vs BNPL. Intensives stay Book stubs.
- **SVG Coach ≠ Ricky** is a shared `AI_DISCLAIMER` on Coach, Pricing coaching/VIP, Book, and Plan.
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
- After required submit, `/onboarding/deeper` is optional. Skip leaves `onboardingDeepCompletedAt` null and still opens Home. Completing step 2 stores current/goal weight (display units only), session length (30/45/60), gym/home/both, competition status + optional fight date, coaching tone, and obstacles. Home shows a soft “2-minute deeper profile for better programming” prompt until step 2 is saved. Honest uses only: SVG Coach tone, session-length / location hints, competition flags for later fight-camp UI. No medical plan from weight.

## Premium feel (quotes, celebrations, difficulty, wrap, PRs)

- **Daily quote** is a curated in-app bank (`src/lib/quotes.ts`): even mix of UFC legends/champions, well-known high achievers, and short Bible verses. No invented SVG lines. Performance+ and higher (`daily_quote` feature) see the full line + attribution on Home. Member Access sees a short teaser + Pricing link. Preview (no Stripe keys) treats tools as open, so the full quote shows. Rotation is still one line per local day.
- Quote reminder reuses ReminderPrefs (`quoteEnabled`, `lastQuoteRemindedAt`). In-app on Home after the preferred hour; email only if SMTP is set. **True mobile push is later.**
- **Celebrations** fire after a completed workout, a newly completed lesson, a first activity of the local day (weekly-active increment), and a progress photo upload. CSS/canvas confetti in `#D0FF00` + white. `prefers-reduced-motion: reduce` skips particles and keeps the short success card.
- **Difficulty** is stored on `WorkoutSession.difficultyRating`: too_easy / just_right / hard / very_hard / extremely_difficult. Strongly prompted on the success screen after save; skip is still allowed by leaving the page. Shown in history; recent average on Home; coach/admin trends get a too-easy streak note (3+ recent too_easy). v1 does **not** auto-progress load — it only flags too-easy streaks for a human coach. No shame copy.
- **Weekly wrap** is a rolling last 7 local days (today minus 6 through today), not a Sunday-start calendar week. Counts: unique days with a completed workout, completed workouts, meal entries (count only — no food names), completed lessons in the window, and average rated difficulty when any ratings exist. Quiet weeks: “A quiet seven days. That is okay…” No shame. Home card.
- **Personal records** recalculate from existing logs (no extra table). Heaviest load per exercise name (converted to preferred units). Longest days-active streak = consecutive local days with a completed workout **or** a food log (same rule as Home days-active). Current streak is 0 if today is not active. Empty state when no load PRs and longest streak is 0. Shown on Progress.
- These features do not gate first-run onboarding.
- Still later (README backlog only): Ricky voice-note of the week, offline workout cards, native/PWA push beyond existing reminders, fighter-week challenge badges.

## Coaching experience (Today, report, paths, journal, Book)

- **Today** on Home is the workout hero: DEMO day title, type / est. minutes / exercise count, one CTA. Goal can sit under the greeting. Path, tutorial, and Book check-in still exist as data (`getTodayGuide`) and on their own screens — they are not stacked on Home. We never invent a fight date or a Ricky comment.
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

## Pilot launch pack

- **Admin toolkit** on `/admin`: invite list (invited/joined), fast plan assign + gym verify + credit use/restore, queues (weekly comments, journal, Book, waitlist, clips), counts only (signups, weekly actives).
- **Timestamped clips** are Fighter Development+. Local `uploads/training-clips`. Owner + assigned coach + admin. mm:ss + correction + drill. First notes can celebrate. Not a live stream. S3 env names already documented, still not wired.
- **Monthly challenge** scores days with a workout and/or food log. Beginner vs advanced day goals. Opt-in. DEMO seed for the current month.
- **Meal-prep** scales saved-meal ingredients, optional simple swaps, grocery list, allergy verify reminder. Still estimates.
- **Weekly focus video** is draft/published. Today for Performance+ (`daily_quote` feature). YouTube/Vimeo or local upload. Labeled DEMO when seeded.
- **Hosted preview:** Dockerfile + vercel.json + Neon/Vercel Postgres. `vercel.json` build is `prisma-prepare --deploy && next build`. No public URL is claimed until Ricky deploys from his account. SQLite stays laptop-only.

## Out of scope

- Fight-camp weight cuts, Gymdesk, voice, native apps, live Stripe production, a real paid video library, paid-course scraping, photo food AI, claiming YouTube form or Learn videos as SVG IP, cloning Fight Science Collective brand/assets or Groups, faking Apple Watch connected on web, faking a successful Affirm/Klarna purchase.
