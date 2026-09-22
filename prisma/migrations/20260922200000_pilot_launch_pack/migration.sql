-- AlterTable
ALTER TABLE "SavedMeal" ADD COLUMN "ingredientsJson" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "PilotInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invitedById" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" DATETIME,
    CONSTRAINT "PilotInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingClip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "memberNote" TEXT NOT NULL DEFAULT '',
    "feedbackSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingClip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClipTimestampNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clipId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "correction" TEXT NOT NULL,
    "drill" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClipTimestampNote_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "TrainingClip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClipTimestampNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SvgChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "beginnerGoalDays" INTEGER NOT NULL DEFAULT 8,
    "advancedGoalDays" INTEGER NOT NULL DEFAULT 16,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChallengeEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChallengeEnrollment_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "SvgChallenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChallengeEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroceryList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroceryList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyFocusVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "videoUrl" TEXT NOT NULL DEFAULT '',
    "storedName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "scriptNotes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "authorUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyFocusVideo_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PilotInvite_email_key" ON "PilotInvite"("email");

-- CreateIndex
CREATE INDEX "PilotInvite_status_idx" ON "PilotInvite"("status");

-- CreateIndex
CREATE INDEX "TrainingClip_userId_createdAt_idx" ON "TrainingClip"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClipTimestampNote_clipId_seconds_idx" ON "ClipTimestampNote"("clipId", "seconds");

-- CreateIndex
CREATE UNIQUE INDEX "SvgChallenge_monthKey_key" ON "SvgChallenge"("monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEnrollment_challengeId_userId_key" ON "ChallengeEnrollment"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "ChallengeEnrollment_userId_idx" ON "ChallengeEnrollment"("userId");

-- CreateIndex
CREATE INDEX "GroceryList_userId_createdAt_idx" ON "GroceryList"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WeeklyFocusVideo_weekStart_status_idx" ON "WeeklyFocusVideo"("weekStart", "status");
