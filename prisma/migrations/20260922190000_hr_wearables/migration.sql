-- CreateTable
CREATE TABLE "PolarConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "polarUserId" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresAt" DATETIME,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME,
    "lastError" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PolarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HrRestingSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bpm" INTEGER NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HrRestingSample_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HrWorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workoutSessionId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "avgBpm" INTEGER NOT NULL,
    "maxBpm" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL DEFAULT '',
    "zone1Seconds" INTEGER NOT NULL DEFAULT 0,
    "zone2Seconds" INTEGER NOT NULL DEFAULT 0,
    "zone3Seconds" INTEGER NOT NULL DEFAULT 0,
    "zone4Seconds" INTEGER NOT NULL DEFAULT 0,
    "zone5Seconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HrWorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HrWorkoutSession_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PolarConnection_userId_key" ON "PolarConnection"("userId");

-- CreateIndex
CREATE INDEX "HrRestingSample_userId_recordedAt_idx" ON "HrRestingSample"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "HrWorkoutSession_userId_startedAt_idx" ON "HrWorkoutSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "HrWorkoutSession_userId_source_externalId_idx" ON "HrWorkoutSession"("userId", "source", "externalId");
