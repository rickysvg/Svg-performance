# SVG Performance — v1 release audit

Audited **19 October 2026** on commit `4e29892` (main). Live site: https://svg-performance.vercel.app. Product code was not changed. This is a readiness report for a first release to martial artists and other performance athletes who are mostly on iPhone and careful about data cost.

Two pieces of work are already in flight. Do not rebuild them from this report:

- **[PR #101](https://github.com/rickysvg/Svg-performance/pull/101)** (draft) — weekly coaching check-ins, coach dashboard, and iPhone web-push reminders (Add to Home Screen is required before iOS will deliver those pushes).
- **[PR #79](https://github.com/rickysvg/Svg-performance/pull/79)** (open) — live Stripe checkout, renewals, failed invoices, and the billing portal. Main still refuses live keys and shows **Coming soon**.

A separate “simplified pricing + sparring ratings” pull request was not on the open list at audit time. Sparring *logs* (rounds, minutes, easy/moderate/hard) already shipped in #93. Leave ratings and pricing copy to that in-flight work.

Stale drafts still open and unrelated to this audit: #84 (avatars, already merged via #85) and #52 (older QA). Close them when someone has a minute so the board stays honest.

---

## For the owner (plain language)

The app is in good shape as a private preview. People can sign up, train, log sets, and talk to the coach. The phone screens that were measured are visually stable and respond quickly **once the files are already on the phone**. It is not ready to hand to a gym full of athletes until a short list of launch gaps is closed.

**What would embarrass you in week one**

1. **A phone on gym Wi-Fi or cellular downloads about 4.4 MB of celebration graphics on every signed-in screen**, including the workout logger. That is the single biggest speed and data-cost problem. The graphics are for badge fireworks. They should load only when a badge actually unlocks.
2. **The AI voice and the logger notepad can run up an OpenAI bill.** Any signed-in account can ask the server to read arbitrary text out loud, with no daily cap. The exercise notepad in the logger calls the same model without checking that the account is on a trial or paid plan. Coach chat is limited to people on a trial or paid plan, but those people can also send unlimited messages. Put one daily cap on chat, notes, and voice before the link gets shared.
3. **There is no privacy policy, terms, or fitness disclaimer page.** The coach and heart-rate screens say “not medical advice” inside the product. A public page, linked from signup, is what you want before strangers train with an AI coach.
4. **You cannot see crashes.** Nothing like Sentry is installed. If an iPhone hits a bug in the logger, you will hear about it from a text, not from a dashboard.
5. **Do not flip on real card charges from this branch.** Buy buttons are Coming soon on purpose, and the code rejects a live Stripe secret. Finish and test PR #79, then turn billing on.
6. **Confirm password-reset email works on the live site.** The code only sends mail when SMTP is configured. This audit could not see Vercel’s secret settings. If mail is off, someone who forgets a password is stuck, and member-feedback notes never reach you.

**What is already solid**

- Public pages score 97–99 on a mobile Lighthouse run. Layout does not jump around.
- Workouts, photos, clips, food logs, and chats are checked against the signed-in person. Admin screens require an admin. A sample of “open someone else’s record” paths was closed.
- Download-my-data and delete-account exist on Profile. Delete removes the account, photos, form-check clips, and feedback screenshots. The download covers workouts, food, chat, and form checks, and leaves out the in-app feedback messages (bugs and ideas).
- The logger keeps a copy of the sets on the phone, so a refresh in the middle of a workout puts the numbers back. It is not a full offline app: with no signal, the page itself will not open.
- Age 18+ is a required checkbox at signup.

**iPhone, without pretending it is an App Store app**

Athletes can use it in Safari today. There is no home-screen icon manifest, no Apple splash images, and no “this is an app” install banner. Safe-area padding is written in CSS, but the viewport tag does not turn those insets on, so a home-screen version would sit under the iPhone home indicator. Web push does not exist on main; PR #101 adds it for check-ins only, and iOS still requires Add to Home Screen. A native App Store wrapper is a later project (the README already calls HealthKit “Phase 2”). Ship v1 as a website people can save to the home screen, and say that plainly.

---

## Prioritized checklist

Effort is **S** (a focused change), **M** (a few files and a test pass), **L** (cross-cutting or needs a vendor/legal decision).

### P0 — before you call it v1

| Item | Why it matters | Effort |
| --- | --- | --- |
| Stop preloading all four celebration sprite sheets on every signed-in page | ~4.4 MB on Home, Train, the logger, Calendar, Progress, Shop, Coach, and Today’s Summary. Cold cellular load, not the Lighthouse score (those runs were already cached). | S |
| Cap coach chat, the exercise notepad, and text-to-speech per account per day | `/api/coach/speak` has no plan check and no rate limit. Chat requires a trial or paid plan and has no rate limit. `POST /api/coach/stream` with `kind: "note"` skips that plan check and still calls the model (logger notepad). Today’s summary has no rate limit. | S |
| Privacy policy, terms, and a fitness / medical disclaimer, linked from signup and the coach | No `/privacy` or `/terms` route exists. AI and heart copy is in-product only. | M (writing the pages is S; a lawyer reading them is the real step) |
| Error monitoring (Sentry or Vercel’s equivalent) | No Sentry, PostHog, or analytics SDK in the repo. Internal `metricEvent` rows count workouts and meals only. | S |
| Confirm production SMTP, SPF/DKIM, and a real From address | Password reset, reminder email, and feedback-to-admin all no-op when `SMTP_HOST` is empty. | S to verify; M if mail is not set up |
| Leave live charges off until PR #79 is merged and a test-mode checkout plus webhook has been watched end to end | Main rejects `sk_live_` and checkout throws “Paid plans coming soon.” | Process, not a new feature |

### P1 — soon after the first athletes are on it

| Item | Why it matters | Effort |
| --- | --- | --- |
| Minimal PWA: manifest, Apple touch icon, `viewport-fit=cover`, theme color | Add to Home Screen is incomplete. Safe-area CSS is present and currently ineffective. | S |
| Do not preload the splash still on later visits; keep the intro video for the first open only | First visit downloads a 1.1 MB WebM. Every later visit still downloads the 68 KB still because it is in the first HTML. | S |
| Security headers: CSP, `X-Content-Type-Options`, `Referrer-Policy`, drop `X-Powered-By` | Production sends HSTS (good) and `x-powered-by: Next.js`. No CSP. | M |
| Cap Progress and Calendar so they do not load every workout and every set | `listWorkoutSessionsForUser` has no `take`. Progress calls it twice. Calendar calls it once. Fine for a pilot, slow after months of logging. | M |
| Find and remove the Node crypto polyfill from the member JavaScript | Signed-in pages ship ~1.1 MB of JS uncompressed. 438 KB of that is `crypto-browserify` plus Buffer/stream polyfills. The public homepage does not load this chunk. | M |
| Put training-clip and focus-video uploads on Vercel Blob | Form checks and progress photos already use Blob when `BLOB_READ_WRITE_TOKEN` is set. Clips and focus videos write to local disk, which disappears on Vercel. | M |
| Share card for iMessage: Open Graph title, description, and a 1200×630 image | Metadata is a single title and “private preview” description. No `og:image`. `/robots.txt` and `/sitemap.xml` 404. | S |
| Show “not saved yet” when the logger’s background sync fails | Numbers survive on that phone. The server copy can lag, and the failure is swallowed. | S |
| Include in-app feedback in Download my data | `MemberFeedback` (bug and idea messages, plus screenshot metadata) is omitted from `/api/account/export`. Delete still removes those rows and the files. | S |
| Compress or drop the duplicate badge FX files (sheet plus animated WebP, ~8.4 MB in `public/fx`) | Only matters once the preload bug is fixed; the win screen should fetch one clip, not eight files. | S |

### P2 — later

| Item | Why it matters | Effort |
| --- | --- | --- |
| Native App Store / HealthKit wrapper | README already scopes this as Phase 2. A PWA is the right v1. | L |
| Index the things you want Google to see, and noindex the logged-in app | No robots file today, so the marketing page and login can both be indexed. | S |
| Move the in-memory account-export cap (5 per 15 minutes) into the database | Password-reset and feedback caps already use the database. Export’s cap resets on every serverless instance. | S |
| Stop accepting the Gymdesk and cron secrets in the query string | Both also accept a header. Query secrets land in logs. | S |
| Shrink `icon.png` (65 KB) and stop serving it as a full download next to the badge | It is linked as the favicon on every page. | S |
| Close stale PRs #84 and #52 | They clutter the board. | S |
| Root `error.tsx` for logged-out pages | Only the member area has an error boundary. | S |
| Registration says “that email already exists” | Password reset is already neutral. Signup can be used to probe emails. Low risk for this product. | S |

---

## 1. Performance

### How it was measured

- **Lighthouse 12.8.2**, mobile, simulated throttling, Chrome headless.
- **Production, cold (first open, splash plays):** `/`, `/login`, `/pricing`, `/register` on https://svg-performance.vercel.app.
- **Production, return visit:** same URLs after `sessionStorage.svg_splash_seen = 1`.
- **Signed-in pages:** local `next build` + `next start` against SQLite, logged in as a throwaway trial athlete, splash skipped. Lighthouse reused the browser cache (`disableStorageReset`), so the scores below do **not** include the 4.4 MB sprite download. Byte sizes are the uncompressed `resourceSize` of what the page requests.
- Authenticated production URLs such as `/home` 307 to `/login`, so they were not scored on the live site.

### Lighthouse

| Page | Where | LCP | TBT | CLS | Score | What LCP was |
| --- | --- | --- | --- | --- | --- | --- |
| `/` first open | Production | 2.4 s | 40 ms | 0 | 98 | Splash `<video>` |
| `/login` first open | Production | 2.5 s | 20 ms | 0 | 98 | Splash video |
| `/pricing` first open | Production | 2.6 s | 30 ms | 0 | 97 | Splash video |
| `/register` first open | Production | 2.6 s | 20 ms | 0 | 97 | Splash video |
| `/` return | Production | 2.2 s | 10 ms | 0 | 99 | Badge image |
| `/login` return | Production | 2.2 s | 20 ms | 0 | 99 | Intro paragraph |
| `/pricing` return | Production | 2.0 s | 20 ms | 0 | 99 | Pricing copy |
| `/register` return | Production | 2.2 s | 20 ms | 0 | 99 | Intro paragraph |
| Home | Local, cached | 1.8 s | 60 ms | 0 | 100 | — |
| Train | Local, cached | 1.2 s | 60 ms | 0 | 100 | — |
| Logger | Local, cached | 0.9 s | 80 ms | 0 | 100 | — |
| Calendar | Local, cached | 1.2 s | 130 ms | 0 | 99 | — |
| Progress | Local, cached | 1.1 s | 140 ms | 0 | 99 | — |
| Shop | Local, cached | 0.8 s | 40 ms | 0 | 100 | — |
| Coach | Local, cached | 0.9 s | 90 ms | 0 | 100 | — |
| Today’s Summary | Local, cached | 0.9 s | 50 ms | 0 | 100 | — |

CLS is 0 everywhere that was measured. TBT stays under 150 ms. The public site is already in the “good” Lighthouse band. The athlete-facing problem is bytes, not layout shift.

### Bundles and chunks

Production homepage, cold, transferred about **1,497 KiB**. Return visit about **371 KiB**.

Largest cold transfers on `/`:

| Bytes (transferred) | File |
| --- | --- |
| 1,126,613 | `/svg-performance-splash.webm` |
| 73,398 | largest JS chunk (`0i8x5xhk7ubtp.js`, ~229 KB uncompressed) |
| 68,751 | `/svg-performance-splash-still.webp` |
| 65,308 | `/icon.png` |
| 34,766 | second JS chunk |
| 29,568 | Anton/Geist woff2 |
| 28,315 | badge image via `next/image` at 640w |
| 26,870 | `/svg-performance-splash.m4a` |

Signed-in pages request about **1.1 MB of JavaScript** uncompressed (logger about **1.2 MB**) plus **60 KB CSS** and **40 KB of fonts**. The largest single chunk is **438 KB**: Next’s `crypto-browserify`, `buffer`, and `stream-browserify` polyfills (`.next/static/chunks/0u5nz-70kbx0k.js`). It is on member routes and absent from the public homepage’s top scripts.

### Images, audio, video

| Asset | Size on disk | When it loads |
| --- | --- | --- |
| `public/fx/*.webp` (4 sheets + 4 animated copies) | **8.4 MB** | All four **sheets** (~4.4 MB) are requested from every signed-in page |
| `public/badges/*.webp` | 7.0 MB | Individual heroes, not the first paint |
| Splash WebM / MP4 | 1.1 MB / 1.6 MB | First visit only (Safari is pinned to the MP4 in `applySplashVideoSources`) |
| Splash still | 68 KB | In the initial HTML of `AppSplash`, so every document requests it |
| Splash audio | 27 KB | With the first-visit video |
| Badge mark PNG | 108 KB | Header logo; `next/image` serves a smaller width |
| SFX mp3s | 572 KB total | Badge unlock, not first paint |
| Coach portraits | 216 KB | Coach UI |

The preload is unconditional:

```65:67:src/components/progress/BadgeUnlockOverlay.tsx
  useEffect(() => {
    void preloadFxSheets();
  }, []);
```

`preloadFxSheets` maps every clip in `src/lib/fx-clips.ts` (`star_flash`, `ember_burst`, `ring_comet`, `ember_drift`). `BadgeUnlockOverlay` is mounted from the member layout, so the logger pays for fireworks the athlete has not earned.

**Fixes, by impact**

1. Call `preloadFxSheets` only when an unlock or win screen is actually showing, and only for the clip that will play. (S, highest impact.)
2. Remove the splash `<img>` from the server HTML once `svg_splash_seen` is set, or gate the preload. The inline boot script already sets `data-splash=done`, but the image request still goes out. (S.)
3. Trace the import that pulls `crypto-browserify` into the member client graph and keep that module on the server. (M.)
4. Serve a smaller `icon.png`. (S.)

### Slow routes and queries

Hot pages do too much work per view, even though indexes exist for the common filters (`userId + performedAt` on workouts, `userId + eatenAt` on food, chat `threadId`, and so on). Schema review did not show a missing index on those hot filters. The problem is unbounded reads:

- `listWorkoutSessionsForUser` in `src/lib/workouts.ts` loads **every** session and **every** set, with the program day included. No `take`.
- Progress calls that twice (`getPersonalRecordsForUser` and `getCompanionProgress`) and also loads the latest 40 sessions.
- Calendar’s `getCalendarSchedule` calls it once to mark completed days.
- Home’s `getHomeToday` is bounded (recent sessions, draft sessions) but also loads **every published lesson** and may send a reminder email on the way in (`processDueRemindersForUser`).
- Coach `getOrCreateThread` includes **every message** in the thread. The model only uses the last 8 (`HISTORY_LIMIT` in `src/lib/coach/llm.ts`), so the page and the database still grow without a cap.
- Account export loads most of the account in one request (workouts, food, chat, form checks, and the rest of the export object). It omits in-app feedback submissions. That is still a heavy read and should stay rare (it already tries to cap repeats).

No classic N+1 loop (query inside `for` against Prisma) stood out on these pages. The pattern is “one query that returns the athlete’s whole history.”

**Fixes:** add `take` or select only `performedAt`, `programDayId`, and `status` for calendar dots; compute personal records from an aggregate or a capped window; paginate coach messages in the UI. (M.)

Coach and TTS slowness is upstream of the database: chat timeout defaults to 20s (`COACH_LLM_TIMEOUT_MS`), TTS to 12–25s. Today’s summary caches audio per day/coach/facts in `CoachDaySummary`, which is the right shape. `/api/coach/speak` does not cache.

---

## 2. Reliability and bugs

### Tests, types, lint

| Check | Result |
| --- | --- |
| `npm test` (Vitest) | **603 passed, 1 failed, 1 skipped.** 106 files passed, 1 failed. Duration ~6.2 min. |
| `next build` (includes TypeScript) | **Passed** (Next.js 16.3.5, Turbopack, ~8s compile). |
| `npx tsc --noEmit` before a build | **Failed** on `LayoutProps` in `src/app/layout.tsx`. That name comes from Next’s generated `.next/types`, which exist only after a Next build. The production build typecheck is the one that matches Vercel. |
| `npm run lint` | **0 errors, 13 warnings** (unused vars and one unused eslint-disable). |

The failing test is `tests/badge-ladders.test.ts`: it reads `/tmp/badge-pack-v2/badge-app-pack-v2/manifest.json`, which is not in this environment. The assertions that the badge WebPs exist under `public/badges/` never ran. Treat this as a test that depends on a machine-local pack, not as missing art in the app. The WebPs are in `public/badges/`.

### Console errors, broken links, dead routes

Lighthouse was run with the performance category only, so it is not a console-error sweep. A manual pass of client `console.error` / `console.warn` found the expected ones: home section failures (`[home] … failed` in `homeLoad`, which then shows a fallback) and YouTube embed warnings in the seminar player.

Member routes have `src/app/(member)/error.tsx` (“This page hit a snag”). Logged-out pages use the default not-found screen. There is no root `error.tsx`.

Links that look easy to break were checked against the mobility catalog: `/mobility/daily-warmup/play` and `/mobility/cooldown/play` resolve to real routines (`DAILY_WARMUP_ID`, `COOLDOWN_ID` in `src/lib/mobility.ts`). Shop links go to svgandco.com on purpose.

`/robots.txt` and `/sitemap.xml` are real 404s (the app’s own “Page not found”), not empty files.

Feature flag in code: `COACH_WORKOUT_MOTIVATION_ENABLED = false` in `src/lib/coach/config.ts` (PR #100). In-workout spoken cues stay off. Coach chat, today’s summary, and rest-timer sounds do not read that flag. No `TODO` / `FIXME` comments in application code; the coach prompt mentions a TODO only as instructions about `COACHING_GUIDE.md`.

### Offline, poor network, crash resume

There is **no service worker** and no offline cache. Airplane mode cannot open Home or the logger.

The logger does resume a crashed or refreshed tab on the **same phone**:

- `writeLoggerDraft` stores sets and the rest timer in `localStorage` under `svg-logger-draft:<sessionId>` (`src/lib/logger-draft.ts`).
- Hydration merges that draft back onto the server rows.
- A debounced `syncWorkoutDraftAction` also posts to the server. Failures are `.catch(() => undefined)` — the screen keeps the numbers and does not say the server missed them.
- `pagehide` discards an empty draft (keepalive `POST /api/workouts/discard-empty`) and will not discard a draft that has a typed set.
- Rest end time is also stored on the workout row (`restEndsAt`), so a rest countdown can resume from the server.

Coach chat falls back to the offline bank when `OPENAI_API_KEY` is missing or the call fails. That is a canned answer, not a queued message.

**Fix (S):** if the background sync fails, keep a “Saved on this phone” line until a later sync succeeds, so a second phone or a replaced browser does not look like the sets vanished.

---

## 3. Security and privacy

### Authorization

API routes under `src/app/api` that serve private bytes check the session and then an owner or staff rule:

| Route | Gate |
| --- | --- |
| `GET /api/account/export` | Session, then export for that user |
| `GET /api/progress-photos/[photoId]` | Session + `readProgressPhotoFileForUser` |
| `GET /api/form-checks/[checkId]` | Session + `readFormCheckForActor` |
| `GET /api/training-clips/[clipId]` | Session + `readTrainingClipFileForActor` |
| `GET /api/feedback/[feedbackId]` | Session + `readFeedbackImageForActor` |
| `GET /api/focus-videos/[videoId]` | Session + Performance+ (or equivalent) + published rows only |
| `POST /api/workouts/discard-empty` | Session + `discardEmptyWorkoutDraft(user.id, …)` |
| `POST /api/coach/stream` | Session + `canUseMemberTools` when `kind` is chat. `kind: "note"` checks the session only, saves the exercise note, then calls the model |
| `POST /api/coach/speak` | Session only |
| `GET /api/coach/today-summary` | Session only |
| `POST /api/coach/motivation` | Flag off, returns muted |
| `POST /api/session/touch` | Extends the current cookie; no body |
| `POST /api/stripe/webhook` | Stripe signature |
| `POST/GET /api/gymdesk/webhook/[event]` | Shared secret when sync is enabled; otherwise `{ ok: true, disabled: true }` |
| `GET/POST /api/cron/gymdesk` | `CRON_SECRET`, timing-safe compare |
| Polar connect | Session, then OAuth |

Admin pages call `requireAdmin`, except feedback (`isFeedbackAdmin`) and form-check review (`isFormCheckReviewer`), which also allow addresses in `ADMIN_EMAILS`. Staff pages call `requireStaff`. Coaching writes go through `assertCanViewMemberTrend`, so a coach is limited to assigned athletes.

Server actions sampled (journal, nutrition, workouts, clips, session summary) pass `user.id` into helpers that throw `ForbiddenError` on a mismatched owner. This was a code read and the existing ownership tests, not a live attack against production.

Next.js 16 runs `src/proxy.ts` before the matched pages (this version’s replacement for `middleware.ts`). It redirects to `/login` when the `svg_session` cookie is missing. It does not look up the session, so a junk cookie still reaches the page, and `requireUser` / `requireOnboardedUser` is what rejects it. The matcher covers Home, Train, Progress, Profile, nutrition, Learn, Coach, admin, staff, Shop, Book, and a few others. It does not list `/mobility`, `/clips`, `/challenges`, `/timer`, or `/feedback`. Those pages still live under the member layout, so they stay signed-in-only; they skip the early redirect.

Focus videos: any entitled member who knows a **published** id can fetch that file, not only “this week’s” video. Drafts are rejected. Acceptable if every published focus video is meant for members.

### Rate limits and OpenAI cost

| Endpoint | Limit today |
| --- | --- |
| Password reset | Database, 5 per email and 20 per IP per window |
| Feedback | Database, 5 per window |
| Account export | In-memory map, 5 per 15 minutes, **per server instance** |
| Gymdesk webhook | Database-backed, 60/min/IP |
| `/api/coach/stream` chat | Plan/trial required (`canUseMemberTools` inside `runCoachChatStream`). **No rate limit.** History sent to the model is capped at 8 turns. |
| `/api/coach/stream` note | Session only (`runCoachNoteStream`). **No plan check, no rate limit.** Message sliced to 2,000 characters. This is the logger exercise notepad: `handleCoachStreamRequest` sends `kind: "note"` there before the chat path. |
| `/api/coach/speak` | Any signed-in user, text sliced to 3,500 characters, **no plan check, no rate limit, no cache.** `CoachSpeakButton` only appears in coach chat, but the route does not care. |
| `/api/coach/today-summary` | Cached per day and facts. Changing coach or style busts the cache and calls TTS again. |
| `/api/coach/motivation` | Hard-off while the flag is false, so it cannot spend money right now. |

A small script with one signed-in account can call speak, and the notepad path, until the OpenAI budget is gone. A trial account can do the same with chat. Cap all three (for example a few dozen speaks, notes, and chats per user per day, stored like the password-reset counter). Also require `canUseMemberTools` on speak and on note streams.

### Secrets, validation, uploads

- No `NEXT_PUBLIC_` environment variables. Stripe, OpenAI, SMTP, Polar, and Blob tokens are read on the server.
- `getStripe()` throws if the key starts with `sk_live_`.
- Session cookie: `httpOnly`, `sameSite: lax`, `secure` in production (`src/lib/session.ts`). 30 days.
- Passwords: bcrypt, 12 rounds, minimum 8 characters. Signup requires the 18+ checkbox. Reset tokens are hashed.
- Uploads: progress photos 5 MB (jpeg/png/webp, magic-byte check), feedback screenshots 5 MB, form checks 24 MB and 60 seconds, training clips and focus videos 25 MB (mp4/webm). Next server actions allow a **32 MB** body (`next.config.ts`), so a client can still push a large body before the app-level check. Worth tightening to the largest real limit.
- Polar tokens are **not** included in the data export (id, timestamps, and last error only). Password hashes are not exported. `MemberFeedback` rows are also absent: the athlete’s bug and idea messages, the page they were sent from, and screenshot metadata. Delete still removes those rows (`onDelete: Cascade`) and the screenshot files (`deleteFeedbackMediaForUser`).
- Account delete cancels Stripe subscriptions best-effort, deletes photo / form-check / feedback media, then deletes the user. Prisma relations use `onDelete: Cascade`. Training-clip files are removed from the local directory only; on Vercel those files were never durable (see P1).

### Headers (measured on production `/`)

Present: `strict-transport-security` (2 years, includeSubDomains, preload).

Absent on the HTML response: `content-security-policy`, `x-frame-options`, `x-content-type-options`, `referrer-policy`, `permissions-policy`. `x-powered-by: Next.js` is set. A few download routes set `X-Content-Type-Options: nosniff` themselves.

---

## 4. iPhone and PWA

| Piece | Status |
| --- | --- |
| Web manifest | **None.** No `manifest.ts` / `site.webmanifest`. |
| Icons | `src/app/icon.png` (65 KB) becomes the favicon. No `apple-icon`. |
| Apple web-app meta | Viewport is `width=device-width, initial-scale=1`. No `viewport-fit=cover`, `apple-mobile-web-app-capable`, or `theme-color`. |
| Splash screens for home screen | The in-app intro video is not an Apple startup image. |
| Safe areas | `env(safe-area-inset-*)` is used on the dock, logger, and sheets. Those values stay 0 until `viewport-fit=cover` is set. |
| Audio unlock | `PrimeCoachAudio` unlocks one `AudioContext` on the same tap as Start, Coach, and “Read it to me” (`src/lib/coach/spoken-audio.ts`). Splash video starts muted so iOS will play it. Rest and finish cues already went through a dedicated pass (#76, #99). |
| Service worker | None. |
| Web push | None on main. PR #101 adds it for weekly check-ins and tells iPhone users to use Add to Home Screen first. |

Add to Home Screen today would bookmark a Safari-style page with the favicon, no standalone display, and no safe-area padding. That is a weekend of manifest + icon + viewport work (S), not a blocker for “open the link in Safari.”

---

## 5. Launch essentials

| Need | What exists |
| --- | --- |
| Privacy policy | No page. Profile has Download my data and Delete account (`YourDataSection`, `/api/account/export`, `/profile/delete`). |
| Terms | No page. |
| Medical / fitness disclaimer | Coach: `AI_DISCLAIMER` in `src/lib/plans.ts` (“For injuries or pain, talk to a coach or doctor”). Heart analysis: “This is training data, not medical advice.” Signup: 18+ checkbox. No standalone disclaimer the athlete accepts. |
| Support | In-app feedback (rate-limited, optional 5 MB screenshot). Email goes to `ADMIN_EMAILS` only when SMTP works. No public support address on the marketing page. |
| Stripe | Coming soon. `assertCanCheckoutPlan` throws if Stripe is not configured or the SKU has `checkoutEnabled: false`. Prepaid / founding stubs are disabled. Live secrets are rejected. PR #79 is the path to real charges. |
| Analytics / errors | `recordMetric` writes names like workout logged and food logged into Postgres. No third-party product analytics and no error tracker. |
| Onboarding | Required intake (goal, experience, art, equipment, days, units) then a plan choice (free vs trial). Deeper screen (weight, session length, tone) can be skipped. Home stays behind that gate (`requireOnboardedUser`). A one-time coach-choice prompt can cover Home until dismissed; the audit user set `coachChoiceAt` so it was not in the way. |
| Email | Nodemailer. Password reset HTML is branded. Reminder emails use the production badge PNG. Gym-member email codes are a separate verify step for academy pricing, not a login wall. Deliverability (SPF, DKIM, a domain you control) is outside the repo and was not verified. |
| SEO | Title “SVG Performance” and a “private preview” description in `src/app/layout.tsx`. No Open Graph or Twitter card. Marketing copy still says “preview account.” |
| App Store | No Capacitor/React Native project. README: Phase 2 native iOS for HealthKit. v1 should stay a website. |

Trials: 14 days if gym-verified, 7 days otherwise (`src/lib/trial.ts`). That window is also the window of unlimited coach chat. The exercise notepad can call the model outside that window.

---

## 6. What this audit did not do

- No production database, Vercel env, Stripe dashboard, OpenAI usage, or DNS/SPF inspection. SMTP and Blob may already be set; the code paths above are what happens when they are not.
- No signed-in Lighthouse against production (those URLs redirect to login). Local scores used a warm cache.
- No penetration test and no load test. Authorization findings are from reading routes and the ownership tests that already exist.
- Product code was not changed. The throwaway SQLite user and `scripts/_audit_user.mjs` used for local Lighthouse are local-only and are not part of the app.
