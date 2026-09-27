-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "trainingEmphasis" TEXT NOT NULL DEFAULT 'balanced';

-- CreateTable
CREATE TABLE "MobilitySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "performedAt" DATETIME NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "painFlag" BOOLEAN NOT NULL DEFAULT false,
    "effort" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'complete',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobilitySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MobilitySet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exerciseKey" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT '',
    "setNumber" INTEGER NOT NULL DEFAULT 1,
    "holdSeconds" INTEGER,
    "reps" INTEGER,
    "sets" INTEGER,
    "depthValue" REAL,
    "depthUnit" TEXT NOT NULL DEFAULT '',
    "heightMark" TEXT NOT NULL DEFAULT '',
    "painFlag" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MobilitySet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MobilitySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MobilityCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "performedAt" DATETIME NOT NULL,
    "sitReachValue" REAL,
    "sitReachUnit" TEXT NOT NULL DEFAULT '',
    "sitReachLevel" TEXT NOT NULL DEFAULT '',
    "frontSplitLeft" REAL,
    "frontSplitRight" REAL,
    "sideSplit" REAL,
    "lengthUnit" TEXT NOT NULL DEFAULT 'cm',
    "hipLeft" INTEGER,
    "hipRight" INTEGER,
    "ankleLeft" REAL,
    "ankleRight" REAL,
    "kickFrontLeft" TEXT NOT NULL DEFAULT '',
    "kickFrontRight" TEXT NOT NULL DEFAULT '',
    "kickSideLeft" TEXT NOT NULL DEFAULT '',
    "kickSideRight" TEXT NOT NULL DEFAULT '',
    "shoulderGap" REAL,
    "painFlag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobilityCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "sleep" INTEGER NOT NULL,
    "soreness" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "restingHr" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadinessCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestingResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "performedAt" DATETIME NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "broadJumpValue" REAL,
    "broadJumpUnit" TEXT NOT NULL DEFAULT '',
    "strengthExercise" TEXT NOT NULL DEFAULT '',
    "strengthLoad" REAL,
    "strengthReps" INTEGER,
    "strengthUnit" TEXT NOT NULL DEFAULT 'lb',
    "strengthEstimate" REAL,
    "bikeSprintValue" REAL,
    "bikeSprintUnit" TEXT NOT NULL DEFAULT '',
    "bikeFiveMinValue" REAL,
    "bikeFiveMinUnit" TEXT NOT NULL DEFAULT '',
    "restingHr" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestingResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MobilitySession_userId_performedAt_idx" ON "MobilitySession"("userId", "performedAt");

-- CreateIndex
CREATE INDEX "MobilitySession_userId_routineId_idx" ON "MobilitySession"("userId", "routineId");

-- CreateIndex
CREATE INDEX "MobilitySet_sessionId_idx" ON "MobilitySet"("sessionId");

-- CreateIndex
CREATE INDEX "MobilityCheckIn_userId_performedAt_idx" ON "MobilityCheckIn"("userId", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessCheckIn_userId_dayKey_key" ON "ReadinessCheckIn"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "TestingResult_userId_performedAt_idx" ON "TestingResult"("userId", "performedAt");
