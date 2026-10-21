-- AlterTable
ALTER TABLE "PlanWaitlist" ADD COLUMN "holdUntil" DATETIME;
ALTER TABLE "PlanWaitlist" ADD COLUMN "offeredAt" DATETIME;

-- CreateTable
CREATE TABLE "VipApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "fightDate" TEXT NOT NULL DEFAULT '',
    "injuries" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerId" TEXT NOT NULL DEFAULT '',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VipApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VipApplication_userId_createdAt_idx" ON "VipApplication"("userId", "createdAt");
CREATE INDEX "VipApplication_status_createdAt_idx" ON "VipApplication"("status", "createdAt");

-- CreateTable
CREATE TABLE "VipCheckoutGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "introApplied" BOOLEAN NOT NULL DEFAULT false,
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "uncappedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME,
    CONSTRAINT "VipCheckoutGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VipCheckoutGrant_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "VipApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VipCheckoutGrant_applicationId_key" ON "VipCheckoutGrant"("applicationId");
CREATE INDEX "VipCheckoutGrant_userId_status_idx" ON "VipCheckoutGrant"("userId", "status");

-- CreateTable
CREATE TABLE "VipUpsellEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VipUpsellEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VipUpsellEvent_userId_trigger_createdAt_idx" ON "VipUpsellEvent"("userId", "trigger", "createdAt");
CREATE INDEX "VipUpsellEvent_userId_createdAt_idx" ON "VipUpsellEvent"("userId", "createdAt");
