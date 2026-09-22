-- AlterTable
ALTER TABLE "ReminderPrefs" ADD COLUMN "bookingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ReminderPrefs" ADD COLUMN "lastBookingRemindedAt" DATETIME;

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN "nextSteps" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PathEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pathSlug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PathEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PathStepCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pathSlug" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PathStepCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionItems" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalFeedback_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyCoachComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekStartKey" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyCoachComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoachingAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachingAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PathEnrollment_userId_pathSlug_key" ON "PathEnrollment"("userId", "pathSlug");

-- CreateIndex
CREATE INDEX "PathEnrollment_userId_idx" ON "PathEnrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PathStepCompletion_userId_pathSlug_stepKey_key" ON "PathStepCompletion"("userId", "pathSlug", "stepKey");

-- CreateIndex
CREATE INDEX "PathStepCompletion_userId_idx" ON "PathStepCompletion"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_createdAt_idx" ON "JournalEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalFeedback_entryId_idx" ON "JournalFeedback"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCoachComment_userId_weekStartKey_key" ON "WeeklyCoachComment"("userId", "weekStartKey");

-- CreateIndex
CREATE INDEX "WeeklyCoachComment_userId_idx" ON "WeeklyCoachComment"("userId");

-- CreateIndex
CREATE INDEX "CoachingAdjustment_userId_createdAt_idx" ON "CoachingAdjustment"("userId", "createdAt");
