# SVG Performance store apps (Capacitor shell)

One Capacitor 8 project builds both the iOS (App Store) and Android (Google Play)
apps. The app is a native shell that loads the live site,
https://svgperformance.app, plus native features. The Next.js app and its
Vercel build don't depend on this folder (`.vercelignore`, `tsconfig.json`
and `eslint.config.mjs` all skip `mobile/`).

| | |
|---|---|
| App ID / bundle ID / package | `app.svgperformance` (reverse of the svgperformance.app domain we own) |
| Name | SVG Performance |
| Loads | `server.url` = `https://svgperformance.app` |
| In-app navigation | svgperformance.app and www.svgperformance.app only. Every other link (Stripe, YouTube, Instagram, mail) opens in the system browser. |
| User agent | Adds `SVGPerformanceApp/1 (ios)` or `SVGPerformanceApp/1 (android)`. The website uses this marker to switch app-only behavior on (see `src/lib/native-app.ts`). |
| iOS | iPhone only, portrait, iOS 15+ |
| Android | minSdk 24, target/compile SDK 36 |

## Native features

| Feature | Status |
|---|---|
| Splash screen + app icons | Done. Built from `assets/source/svg-performance-lockup.png` by `scripts/make_brand_assets.py` (black background, glowing neon-lime ring), then `@capacitor/assets`. |
| Status bar | Done. Black bar, light icons, content kept below it. |
| Offline fallback | Done. `www/offline.html` (`server.errorPath`) shows a branded "You're offline" screen with Try again; it auto-reloads when the connection returns. |
| Haptics | Done. Uses the web `vibratePattern()` chokepoint (`src/lib/media-output.ts`) to call the native Haptics plugin: rest-timer 3-2-1 warning and end, round timer, bike intervals. Plus a tap when a set is checked off. iPhones now buzz, which Safari can't do. |
| Deep links | Done in the app. Android App Links intent filter + iOS Associated Domains (`applinks:svgperformance.app`). The site serves `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` only after `ANDROID_SHA256_CERT_FINGERPRINTS` / `APPLE_TEAM_ID` are set in Vercel (404 until then). |
| Push notifications | Scaffolded. Plugin installed, iOS AppDelegate forwards APNs tokens, push entitlement added. **Not switched on:** this needs Firebase files from Ricky plus a server token table and sender (see below). The web never calls `register()` yet, because Android crashes on register without `google-services.json`. |
| Camera / photos | The web `<input type="file">` uploads open the camera or library. Usage strings are in Info.plist, and CAMERA is declared on Android. |
| Store billing | Stripe Checkout and the Stripe billing portal are hidden and blocked server-side inside the app on both platforms (see "Payments"). |

## Payments (store rules)

Inside the apps, the website's Stripe upgrade buttons become a neutral note:
"Subscriptions aren't available in the app yet. Your current plan works here as usual."
- `startCheckoutAction`, `startVipCheckoutAction` and `POST /api/stripe/portal` refuse requests carrying the app user agent.
- `/pricing` redirects to `/plan` and `/vip/checkout` redirects to `/vip` inside the app.
- The website is unchanged.

**Decision for Ricky (before iOS submission):** Apple guideline 3.1.1 requires in-app
purchase for digital subscriptions sold in the app. 3.1.3(b) lets web subscribers sign in
and keep access only if the subscription is also offered through IAP. Without IAP,
Apple will likely reject an app that locks Pro features. The approved plan (Nov 6) is
Apple IAP + Google Play Billing through RevenueCat. That isn't implemented here.
- US-only option: Apple currently allows a "subscribe on our website" link on the US storefront (0% Apple fee for now; in litigation, with a Supreme Court date of Jan 11, 2027). The Nov 6 plan says not at launch.
- Android: Google Play also requires Play Billing for digital subscriptions unless the developer enrolls in its external-offers or alternative-billing programs. That's why Android is gated too.
- To loosen either platform later, change `storeBillingBlocksWebCheckout()` in `src/lib/native-app.ts`.

## Build

Needs Node 22+ and JDK 21. Android also needs the Android SDK (platform 36, build-tools 36).

```bash
cd mobile
npm ci
npx cap sync
# Android debug APK -> android/app/build/outputs/apk/debug/app-debug.apk
cd android && ./gradlew assembleDebug
# Android release bundle for Play -> android/app/build/outputs/bundle/release/app-release.aab
./gradlew bundleRelease
```

Release signing reads a properties file **outside the repo**. Set
`SVG_ANDROID_SIGNING`, or by default it reads `/workspace/mobile-secrets/upload-keystore.properties`.
The file has `storeFile`, `storePassword`, `keyAlias` and `keyPassword`. Without it,
`bundleRelease` still builds, unsigned. Never commit keystores. `.gitignore` blocks them.

To regenerate icons and splash after a brand change: `npm run icons`.

iOS builds need macOS + Xcode 26. `.github/workflows/mobile.yml` compiles an unsigned
simulator build on GitHub's free macOS runners (this repo is public) for every PR that
touches `mobile/`. Signed App Store builds need Apple signing secrets (see below).

## What's needed from Ricky

1. **Firebase project** (free) for push. Add an Android app `app.svgperformance` and an iOS app `app.svgperformance`. Download `google-services.json` (goes to `android/app/`) and `GoogleService-Info.plist` (goes to `ios/App/App/`). Both are git-ignored, so hand them over privately.
2. **APNs auth key (.p8)** from the Apple Developer portal: Certificates, IDs & Profiles → Keys → "+" → Apple Push Notifications service. Note the Key ID. Upload it to Firebase → Project settings → Cloud Messaging.
3. **Apple Team ID**, set in Vercel as `APPLE_TEAM_ID` for universal links. Register the bundle ID `app.svgperformance` with the Push Notifications and Associated Domains capabilities.
4. **App Store Connect API key** (Users and Access → Integrations → Keys, App Manager role) for CI signing and TestFlight uploads.
5. **Play App Signing SHA-256**: after creating the app in Play Console, copy it from Setup → App signing. Set `ANDROID_SHA256_CERT_FINGERPRINTS` in Vercel to the upload key fingerprint plus that one.
6. **IAP / RevenueCat go-ahead** (see Payments).

## Push: remaining server work (phase 2)

- Add a `NativePushToken` table (userId, platform, token, updatedAt). Add `POST /api/push/native` to save tokens. In `NativeAppBridge`, request permission, call `register()`, and post the token.
- Send through FCM HTTP v1 (Android + iOS via APNs key in Firebase). Reuse the weekly check-in and reminder triggers that use web-push today.
