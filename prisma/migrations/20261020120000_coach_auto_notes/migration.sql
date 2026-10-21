-- CreateTable
CREATE TABLE "CoachAutoNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachAutoNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachAutoNote_userId_dedupeKey_key" ON "CoachAutoNote"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "CoachAutoNote_userId_createdAt_idx" ON "CoachAutoNote"("userId", "createdAt");
