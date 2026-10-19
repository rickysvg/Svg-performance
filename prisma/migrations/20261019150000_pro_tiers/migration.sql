-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "memberProStartedAt" DATETIME;

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "surface" TEXT NOT NULL DEFAULT '',
    "units" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberProReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'push',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberProReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiUsageEvent_userId_kind_createdAt_idx" ON "AiUsageEvent"("userId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProReminderLog_userId_stage_key" ON "MemberProReminderLog"("userId", "stage");
