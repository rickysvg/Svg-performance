-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "weeklyCheckInOverride" TEXT NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "WeeklyCheckInPrefs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL DEFAULT 0,
    "minuteOfDay" INTEGER NOT NULL DEFAULT 1080,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyCheckInPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCheckInPrefs_userId_key" ON "WeeklyCheckInPrefs"("userId");

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateTable
CREATE TABLE "WeeklyCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "bodyweightLb" REAL,
    "sleepQuality" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL,
    "sorenessRegionsJson" TEXT NOT NULL DEFAULT '[]',
    "sorenessNotes" TEXT NOT NULL DEFAULT '',
    "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "sessionsPlanned" INTEGER NOT NULL DEFAULT 0,
    "sparringSummary" TEXT NOT NULL DEFAULT '',
    "wins" TEXT NOT NULL DEFAULT '',
    "struggles" TEXT NOT NULL DEFAULT '',
    "videoStorageKey" TEXT NOT NULL DEFAULT '',
    "videoStorageKind" TEXT NOT NULL DEFAULT '',
    "videoMimeType" TEXT NOT NULL DEFAULT '',
    "videoByteSize" INTEGER NOT NULL DEFAULT 0,
    "videoDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "aiSummary" TEXT NOT NULL DEFAULT '',
    "aiFlagsJson" TEXT NOT NULL DEFAULT '[]',
    "aiReply" TEXT NOT NULL DEFAULT '',
    "aiTweaks" TEXT NOT NULL DEFAULT '',
    "aiSource" TEXT NOT NULL DEFAULT 'fallback',
    "coachStatus" TEXT NOT NULL DEFAULT 'pending',
    "coachReply" TEXT NOT NULL DEFAULT '',
    "reviewerUserId" TEXT NOT NULL DEFAULT '',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "sentAt" DATETIME,
    "replySeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCheckIn_userId_weekKey_key" ON "WeeklyCheckIn"("userId", "weekKey");

-- CreateIndex
CREATE INDEX "WeeklyCheckIn_coachStatus_submittedAt_idx" ON "WeeklyCheckIn"("coachStatus", "submittedAt");

-- CreateIndex
CREATE INDEX "WeeklyCheckIn_userId_submittedAt_idx" ON "WeeklyCheckIn"("userId", "submittedAt");

-- CreateTable
CREATE TABLE "CheckInReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'push',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckInReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckInReminderLog_userId_weekKey_kind_key" ON "CheckInReminderLog"("userId", "weekKey", "kind");

-- CreateIndex
CREATE INDEX "CheckInReminderLog_userId_weekKey_idx" ON "CheckInReminderLog"("userId", "weekKey");
