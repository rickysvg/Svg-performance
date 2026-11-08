-- One-time Pro access codes. Not a Stripe subscription.
CREATE TABLE "ProAccessCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "emailLock" TEXT NOT NULL DEFAULT '',
    "durationDays" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "redeemedAt" DATETIME,
    "redeemedById" TEXT,
    "expiresAt" DATETIME,
    "subscriptionId" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ProAccessCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProAccessCode_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProAccessCode_code_key" ON "ProAccessCode"("code");
CREATE INDEX "ProAccessCode_createdById_idx" ON "ProAccessCode"("createdById");
CREATE INDEX "ProAccessCode_redeemedById_idx" ON "ProAccessCode"("redeemedById");
CREATE INDEX "ProAccessCode_emailLock_idx" ON "ProAccessCode"("emailLock");

CREATE TABLE "ProAccessCodeAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ProAccessCodeAttempt_keyHash_createdAt_idx" ON "ProAccessCodeAttempt"("keyHash", "createdAt");
