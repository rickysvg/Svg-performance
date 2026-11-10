-- Columns that already exist on the hosted database.
-- SQLite tests need the same shape so db push does not try to drop them.
ALTER TABLE "Subscription" ADD COLUMN "billingSku" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Subscription" ADD COLUMN "cancelAt" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "trialStart" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "trialEnd" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "trialWillEnd" BOOLEAN NOT NULL DEFAULT false;
