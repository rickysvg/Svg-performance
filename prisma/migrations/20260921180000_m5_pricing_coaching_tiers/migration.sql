-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'webhook';

-- CreateTable
CREATE TABLE "CoachingCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "allotted" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachingCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanWaitlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "preferredTimes" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "usesIncludedCredit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachingCredit_userId_kind_periodStart_key" ON "CoachingCredit"("userId", "kind", "periodStart");

-- CreateIndex
CREATE INDEX "CoachingCredit_userId_idx" ON "CoachingCredit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanWaitlist_userId_plan_key" ON "PlanWaitlist"("userId", "plan");

-- CreateIndex
CREATE INDEX "PlanWaitlist_plan_status_idx" ON "PlanWaitlist"("plan", "status");

-- CreateIndex
CREATE INDEX "BookingRequest_userId_idx" ON "BookingRequest"("userId");

-- CreateIndex
CREATE INDEX "BookingRequest_status_idx" ON "BookingRequest"("status");
