-- Workout coach cues: member toggle (default on) and a shared TTS cache.
ALTER TABLE "Profile" ADD COLUMN "coachMotivation" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CoachCueCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "cueKey" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "audio" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CoachCueCache_coachId_style_cueKey_key" ON "CoachCueCache"("coachId", "style", "cueKey");
