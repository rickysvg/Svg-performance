-- Store billing, native push tokens, AI coach consent, and AI reply reports.
-- Additive only. Existing subscription rows default to store = stripe.
-- No drops, no type changes, no data rewrites.

ALTER TABLE "Profile" ADD COLUMN "aiCoachConsentAt" DATETIME;

ALTER TABLE "Subscription" ADD COLUMN "store" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "Subscription" ADD COLUMN "storeProductId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Subscription" ADD COLUMN "storeOriginalTransactionId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Subscription" ADD COLUMN "revenueCatAppUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Subscription" ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'production';

CREATE INDEX "Subscription_store_storeOriginalTransactionId_idx" ON "Subscription"("store", "storeOriginalTransactionId");

CREATE TABLE "RevenueCatEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL DEFAULT '',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

CREATE INDEX "RevenueCatEvent_appUserId_idx" ON "RevenueCatEvent"("appUserId");

CREATE TABLE "NativePushToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL DEFAULT '',
    "environment" TEXT NOT NULL DEFAULT 'production',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastError" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "NativePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NativePushToken_token_key" ON "NativePushToken"("token");
CREATE INDEX "NativePushToken_userId_idx" ON "NativePushToken"("userId");

CREATE TABLE "CoachReplyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    CONSTRAINT "CoachReplyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CoachReplyReport_userId_messageId_key" ON "CoachReplyReport"("userId", "messageId");
CREATE INDEX "CoachReplyReport_status_createdAt_idx" ON "CoachReplyReport"("status", "createdAt");
