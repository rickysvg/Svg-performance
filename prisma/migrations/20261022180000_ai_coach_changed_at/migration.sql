-- Old replies stay unlabeled. coachChoiceAt is the first choice or a dismiss, not a
-- switch, so the current coach is not copied onto them. Empty coachId becomes
-- null and the thread shows the generic Coach label. A switch from now on is
-- aiCoachChangedAt. New replies store coachId themselves.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coachId" TEXT,
    "refused" BOOLEAN NOT NULL DEFAULT false,
    "refusalCode" TEXT NOT NULL DEFAULT '',
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("coachId", "content", "createdAt", "id", "offline", "refused", "refusalCode", "role", "threadId")
SELECT NULLIF("coachId", ''), "content", "createdAt", "id", "offline", "refused", "refusalCode", "role", "threadId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_threadId_idx" ON "ChatMessage"("threadId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

ALTER TABLE "Profile" ADD COLUMN "aiCoachChangedAt" DATETIME;
