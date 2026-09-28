-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "phoneE164" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "Profile" ADD COLUMN "gymdeskMemberId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "gymMembershipSource" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "gymdeskStatus" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "gymdeskCheckedAt" DATETIME;
ALTER TABLE "Profile" ADD COLUMN "gymMembershipGraceUntil" DATETIME;
ALTER TABLE "Profile" ADD COLUMN "gymMembershipOverride" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Profile" ADD COLUMN "gymMembershipOverrideNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "gymMembershipOverrideBy" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "GymdeskMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gymdeskId" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL DEFAULT '',
    "email2Hash" TEXT NOT NULL DEFAULT '',
    "phoneHash" TEXT NOT NULL DEFAULT '',
    "phone2Hash" TEXT NOT NULL DEFAULT '',
    "nameKey" TEXT NOT NULL DEFAULT '',
    "displayLabel" TEXT NOT NULL DEFAULT '',
    "membershipLabel" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusChangedAt" DATETIME,
    "frozenSince" DATETIME,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'webhook',
    "linkedUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GymdeskMember_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GymdeskMember_gymdeskId_key" ON "GymdeskMember"("gymdeskId");
CREATE INDEX "GymdeskMember_emailHash_idx" ON "GymdeskMember"("emailHash");
CREATE INDEX "GymdeskMember_email2Hash_idx" ON "GymdeskMember"("email2Hash");
CREATE INDEX "GymdeskMember_phoneHash_idx" ON "GymdeskMember"("phoneHash");
CREATE INDEX "GymdeskMember_phone2Hash_idx" ON "GymdeskMember"("phone2Hash");
CREATE INDEX "GymdeskMember_nameKey_idx" ON "GymdeskMember"("nameKey");
CREATE INDEX "GymdeskMember_status_idx" ON "GymdeskMember"("status");
CREATE INDEX "GymdeskMember_linkedUserId_idx" ON "GymdeskMember"("linkedUserId");

-- CreateTable
CREATE TABLE "GymMembershipEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "from" TEXT NOT NULL DEFAULT '',
    "to" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymMembershipEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GymMembershipEvent_userId_at_idx" ON "GymMembershipEvent"("userId", "at");

-- CreateTable
CREATE TABLE "EmailVerificationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EmailVerificationCode_userId_createdAt_idx" ON "EmailVerificationCode"("userId", "createdAt");

-- CreateTable
CREATE TABLE "GymdeskMatchQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gymdeskMemberId" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "GymdeskMatchQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GymdeskMatchQueue_status_createdAt_idx" ON "GymdeskMatchQueue"("status", "createdAt");
CREATE INDEX "GymdeskMatchQueue_userId_idx" ON "GymdeskMatchQueue"("userId");

-- CreateTable
CREATE TABLE "GymdeskSyncMeta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "GymdeskSyncMeta_key_key" ON "GymdeskSyncMeta"("key");

-- CreateTable
CREATE TABLE "GymdeskRateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GymdeskRateLimit_keyHash_createdAt_idx" ON "GymdeskRateLimit"("keyHash", "createdAt");
