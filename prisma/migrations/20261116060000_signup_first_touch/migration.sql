-- First-touch attribution. Nullable columns only. Existing rows stay null.
-- No drops, no type changes, no NOT NULL.

ALTER TABLE "Profile" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "Profile" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "Profile" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "Profile" ADD COLUMN "utmContent" TEXT;
ALTER TABLE "Profile" ADD COLUMN "utmTerm" TEXT;
ALTER TABLE "Profile" ADD COLUMN "referrer" TEXT;
ALTER TABLE "Profile" ADD COLUMN "landingPath" TEXT;
ALTER TABLE "Profile" ADD COLUMN "firstTouchAt" DATETIME;

ALTER TABLE "waitlist_signups" ADD COLUMN "utm_source" TEXT;
ALTER TABLE "waitlist_signups" ADD COLUMN "utm_medium" TEXT;
ALTER TABLE "waitlist_signups" ADD COLUMN "utm_campaign" TEXT;
ALTER TABLE "waitlist_signups" ADD COLUMN "utm_content" TEXT;
ALTER TABLE "waitlist_signups" ADD COLUMN "utm_term" TEXT;
ALTER TABLE "waitlist_signups" ADD COLUMN "referrer" TEXT;
ALTER TABLE "waitlist_signups" ADD COLUMN "landing_path" TEXT;
ALTER TABLE "waitlist_signups" ADD COLUMN "first_touch_at" DATETIME;
