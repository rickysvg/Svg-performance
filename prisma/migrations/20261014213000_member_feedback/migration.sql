-- CreateTable
CREATE TABLE "MemberFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "route" TEXT NOT NULL DEFAULT '',
    "workoutId" TEXT NOT NULL DEFAULT '',
    "appVersion" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "storageKey" TEXT NOT NULL DEFAULT '',
    "storageKind" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MemberFeedback_userId_createdAt_idx" ON "MemberFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberFeedback_status_createdAt_idx" ON "MemberFeedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MemberFeedback_type_createdAt_idx" ON "MemberFeedback"("type", "createdAt");
