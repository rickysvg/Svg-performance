-- Beta tester invite codes. Full Pro until Nov 16, 2026, no card.
ALTER TABLE "Profile" ADD COLUMN "tester" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN "testerRedeemedAt" DATETIME;

CREATE TABLE "TesterInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TesterInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TesterInvite_code_key" ON "TesterInvite"("code");
CREATE INDEX "TesterInvite_createdById_idx" ON "TesterInvite"("createdById");

CREATE TABLE "TesterRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TesterRedemption_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "TesterInvite" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TesterRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TesterRedemption_userId_key" ON "TesterRedemption"("userId");
CREATE INDEX "TesterRedemption_inviteId_idx" ON "TesterRedemption"("inviteId");
