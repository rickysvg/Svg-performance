-- CreateTable
CREATE TABLE "FightCamp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fightDateKey" TEXT NOT NULL,
    "weightClass" TEXT NOT NULL DEFAULT '',
    "discipline" TEXT NOT NULL DEFAULT '',
    "templateWeeks" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FightCamp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FightCamp_userId_key" ON "FightCamp"("userId");

-- CreateTable
CREATE TABLE "FormCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "movement" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "storageKey" TEXT NOT NULL,
    "storageKind" TEXT NOT NULL DEFAULT 'local',
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL DEFAULT '',
    "reviewerUserId" TEXT NOT NULL DEFAULT '',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "feedbackSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FormCheck_userId_submittedAt_idx" ON "FormCheck"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "FormCheck_status_submittedAt_idx" ON "FormCheck"("status", "submittedAt");
