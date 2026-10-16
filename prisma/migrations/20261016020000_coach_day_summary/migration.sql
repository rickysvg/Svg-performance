-- Spoken daily briefing cache. One row per member, local day, coach, and plan facts.
CREATE TABLE "CoachDaySummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "factsKey" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "audio" BLOB,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "source" TEXT NOT NULL DEFAULT 'template',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachDaySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CoachDaySummary_userId_dayKey_coachId_factsKey_key" ON "CoachDaySummary"("userId", "dayKey", "coachId", "factsKey");
CREATE INDEX "CoachDaySummary_userId_dayKey_idx" ON "CoachDaySummary"("userId", "dayKey");
