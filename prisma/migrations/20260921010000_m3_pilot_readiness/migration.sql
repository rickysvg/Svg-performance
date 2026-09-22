-- CreateTable
CREATE TABLE "ReminderPrefs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workoutEnabled" BOOLEAN NOT NULL DEFAULT true,
    "foodEnabled" BOOLEAN NOT NULL DEFAULT true,
    "preferredHour" INTEGER NOT NULL DEFAULT 18,
    "timezoneOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastWorkoutRemindedAt" DATETIME,
    "lastFoodRemindedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoachAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachUserId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachAssignment_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachAssignment_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberUserId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HelpRequest_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StripeEventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MetricEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderPrefs_userId_key" ON "ReminderPrefs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachAssignment_coachUserId_memberUserId_key" ON "CoachAssignment"("coachUserId", "memberUserId");

-- CreateIndex
CREATE INDEX "CoachAssignment_memberUserId_idx" ON "CoachAssignment"("memberUserId");

-- CreateIndex
CREATE INDEX "HelpRequest_memberUserId_idx" ON "HelpRequest"("memberUserId");

-- CreateIndex
CREATE INDEX "HelpRequest_status_idx" ON "HelpRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StripeEventLog_stripeEventId_key" ON "StripeEventLog"("stripeEventId");

-- CreateIndex
CREATE INDEX "MetricEvent_name_createdAt_idx" ON "MetricEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "MetricEvent_userId_idx" ON "MetricEvent"("userId");
