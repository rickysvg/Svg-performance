-- One Pro trial per person, raw Stripe trial dates, billing history, card fingerprints.
ALTER TABLE "Profile" ADD COLUMN "proTrialUsedAt" DATETIME;

ALTER TABLE "Subscription" ADD COLUMN "billingSku" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Subscription" ADD COLUMN "trialStart" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "trialEnd" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "trialWillEnd" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "stripeCustomerId" TEXT NOT NULL DEFAULT '',
    "stripeSubscriptionId" TEXT NOT NULL DEFAULT '',
    "stripePriceId" TEXT NOT NULL DEFAULT '',
    "billingSku" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT '',
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" DATETIME NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");
CREATE INDEX "BillingEvent_userId_idx" ON "BillingEvent"("userId");
CREATE INDEX "BillingEvent_eventType_occurredAt_idx" ON "BillingEvent"("eventType", "occurredAt");
CREATE INDEX "BillingEvent_stripeSubscriptionId_idx" ON "BillingEvent"("stripeSubscriptionId");

CREATE TABLE "CardFingerprint" (
    "fingerprint" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "CardFingerprint_userId_idx" ON "CardFingerprint"("userId");
