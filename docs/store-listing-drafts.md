# Store listing drafts: SVG Performance (DRAFT, not submitted)

Status: drafts for Ricky to review. Nothing has been submitted to Apple or Google.
Rules: no prices, no launch dates, no store badges.
Publisher: SVG & CO. COMBAT SPORTS & FITNESS, LLC. Support: support@svgperformance.app.
Privacy policy: https://svgperformance.app/privacy. Terms: https://svgperformance.app/terms.

## Shared copy

**App name:** SVG Performance
**Subtitle (App Store, 30 max):** Strength & fight conditioning (29)
**Short description (Play, 80 max):** Strength, conditioning and fight training for combat athletes, set by set. (74)

**Full description (Play, 4000 max; App Store description, same text):**

> Train like a fighter between classes.
>
> SVG Performance is the training app from SVG MMA Academy in El Paso. It gives combat
> athletes and everyday members a structured strength and conditioning plan built around
> their class schedule, tracked set by set.
>
> WHAT YOU GET
> • A weekly plan that fits the days you train, with strength, conditioning and mobility
> • A fast workout logger: weights in lbs, reps, rest timer with a buzz when rest is up
> • Round and interval timers for bag work, bike and conditioning
> • Mobility routines for hips, shoulders and recovery
> • Progress history, personal records and badges
> • Weekly check-ins and reminders to stay on track
> • An AI coach to answer training questions (optional)
> • Progress photos and form-check clips that stay private to you
>
> BUILT FOR COMBAT ATHLETES
> Whether you're a fight-team athlete or a regular class member getting in shape, the plan
> works around your classes, not against them.
>
> SVG Academy members: sign in with the email on your academy account to match your
> membership.
>
> SVG Performance is a fitness log, not a medical service. Talk to a doctor before
> starting a new training program.

**Keywords (App Store, 100 max):** mma,workout,strength,conditioning,boxing,bjj,muay thai,fighter,gym log,timer,mobility (85)
**Category:** Health & Fitness (both stores). Secondary (Apple): Sports.
**Promotional text (App Store, 170 max):** Your SVG training plan in your pocket: log sets, time your rest and rounds, and track progress between classes.

## Apple App Store: App Privacy ("nutrition label") draft

Data linked to the user, none used for tracking (no ad SDKs, no cross-app tracking):
| Data type | Collected | Purpose |
|---|---|---|
| Contact info: email address | Yes | App functionality, account |
| Contact info: phone number (optional) | Yes | App functionality (academy membership match, hashed) |
| Health & fitness: fitness (workouts, sets, check-ins) | Yes | App functionality |
| User content: photos or videos (progress photos, form clips) | Yes | App functionality |
| User content: other (notes, coach chat messages) | Yes | App functionality |
| Purchases (subscription status, from Stripe; later App Store) | Yes | App functionality |
| Identifiers: user ID | Yes | App functionality |
| Usage data: product interaction / first-touch source (UTM) | Confirm with Dex | Analytics |
| Diagnostics | No (no crash SDK yet) | |

- **Account deletion:** in the app at Profile → Delete account (guideline 5.1.1(v)). ✔
- **AI coach (guideline 5.1.2(i)):** coach chat is sent to a third-party AI provider. Apple requires clear disclosure and consent before personal data goes to third-party AI. **The privacy policy doesn't name this yet. Update it before submission.** Add "Report this reply" on coach messages (Apple 4.7 / Google AI-generated content policy).
- **Encryption:** standard HTTPS only. `ITSAppUsesNonExemptEncryption = NO` is set.
- **Age rating:** answer the new questionnaire honestly. Combat-sports video and an AI chat likely give 13+ or higher. Sign-up already requires 18+.
- **Sign in:** email/password only (no third-party login), so Sign in with Apple isn't required.
- **Review notes:** give Apple a demo account (a dedicated reviewer test member, never a real member). Explain the native features: haptics on rest timer and set complete, push reminders, offline screen, camera for progress photos.

## Google Play: Data safety draft

- Data is encrypted in transit: **Yes**. Users can request deletion: **Yes** (in app + support email).
- Collected (not shared, not sold): email (account management), phone number (optional, app functionality), fitness info (app functionality), photos/videos (app functionality), in-app messages / AI chat (app functionality), purchase history (app functionality), user IDs (account management).
- Shared: none for advertising. Processors (Stripe, hosting, AI provider) count as service providers. Confirm the AI-provider wording against Google's "shared" definition.
- **Health apps declaration:** fitness tracking, not medical.
- **Account deletion URL** (required): https://svgperformance.app/profile (in-app delete). A public web page that explains deletion without logging in may be required. Draft one if Google asks.
- **Target audience:** 18+.
- **Ads:** No ads.
- **Organization account:** skips Google's 12-tester / 14-day closed test.

## Required screenshots and graphics

Capture on real content with a dedicated test member, never a real member. No prices are visible in any shot.

**App Store (iPhone only build):**
- 6.9" iPhone (1320 × 2868 or 1290 × 2796), 3–10 screenshots. Apple scales these down for smaller iPhones.
- No iPad screenshots needed: the build is iPhone-only (`TARGETED_DEVICE_FAMILY = 1`).
- App icon 1024 × 1024 comes from the build (`mobile/assets/icon-only.png`).
- Optional: 15–30s app preview video.

**Google Play:**
- Phone screenshots: 2–8, 16:9 or 9:16, min 1080 px per side recommended (e.g. 1080 × 1920).
- Feature graphic: 1024 × 500 (black bg, neon-lime glow logo, tagline "Stay ready."). Needs to be made.
- Hi-res icon: 512 × 512 PNG (resize `mobile/assets/icon-only.png`).

**Suggested 6-shot story (both stores):**
1. Home / Today: "Your plan, built around your classes"
2. Workout logger mid-set with rest timer: "Log every set. Feel the buzz when rest is up."
3. Round / interval timer: "Rounds, intervals, bag work"
4. Mobility routine: "Mobility for hips and shoulders"
5. Progress and badges: "See the work add up"
6. Coach chat: "Ask your coach anytime" (only after the report button exists)

## Open items before any submission

1. In-app purchase decision (RevenueCat + Apple IAP + Play Billing). The app currently hides Stripe checkout inside the store apps. On iOS, Pro must be buyable via IAP or Apple may reject (3.1.1 / 3.1.3(b)).
2. Update the privacy policy for the AI provider, app push notifications and the store apps.
3. Add a report button on AI coach replies.
4. Hide or rework in-app copy that mentions prices or "subscribe" (paywall text still names web prices in about 20 places).
5. The public landing page says "native apps later / no download needed". The app starts at /home, so reviewers mostly won't see it, but update it at store launch.
