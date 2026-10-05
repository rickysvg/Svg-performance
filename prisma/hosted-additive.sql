-- Additive hosted columns. Safe on existing Profile rows.
-- No DROP / no type changes. Idempotent. No-ops on an empty Neon (no Profile table yet).
DO $$
BEGIN
  IF to_regclass('public."Profile"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'leaderboardOptIn'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'seenBadgeUnlocksJson'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "seenBadgeUnlocksJson" TEXT NOT NULL DEFAULT '[]';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'trainingEmphasis'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "trainingEmphasis" TEXT NOT NULL DEFAULT 'balanced';
  END IF;
END $$;

-- Password-reset leak fix. Additive only: new column defaulting to 1, new
-- rate-limit table, then delete links issued before generation 2.
-- No-ops until PasswordResetToken exists (empty Neon is created by db push).
DO $$
BEGIN
  IF to_regclass('public."PasswordResetToken"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PasswordResetToken'
      AND column_name = 'generation'
  ) THEN
    ALTER TABLE "PasswordResetToken" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1;
  END IF;

  DELETE FROM "PasswordResetToken" WHERE "generation" < 2;

  IF to_regclass('public."PasswordResetAttempt"') IS NULL THEN
    CREATE TABLE "PasswordResetAttempt" (
      "id" TEXT NOT NULL,
      "keyHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PasswordResetAttempt_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "PasswordResetAttempt_keyHash_createdAt_idx"
      ON "PasswordResetAttempt"("keyHash", "createdAt");
  END IF;
END $$;

-- Gymdesk member verify (additive). Profile columns + new tables.
DO $$
BEGIN
  IF to_regclass('public."Profile"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'phoneE164'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "phoneE164" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'emailVerifiedAt'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'gymdeskMemberId'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "gymdeskMemberId" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'gymMembershipSource'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "gymMembershipSource" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'gymdeskStatus'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "gymdeskStatus" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'gymdeskCheckedAt'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "gymdeskCheckedAt" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'gymMembershipGraceUntil'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "gymMembershipGraceUntil" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'gymMembershipOverride'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "gymMembershipOverride" TEXT NOT NULL DEFAULT 'none';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'gymMembershipOverrideNote'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "gymMembershipOverrideNote" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'gymMembershipOverrideBy'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "gymMembershipOverrideBy" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."GymdeskMember"') IS NULL THEN
    CREATE TABLE "GymdeskMember" (
      "id" TEXT NOT NULL,
      "gymdeskId" TEXT NOT NULL,
      "emailHash" TEXT NOT NULL DEFAULT '',
      "email2Hash" TEXT NOT NULL DEFAULT '',
      "phoneHash" TEXT NOT NULL DEFAULT '',
      "phone2Hash" TEXT NOT NULL DEFAULT '',
      "nameKey" TEXT NOT NULL DEFAULT '',
      "displayLabel" TEXT NOT NULL DEFAULT '',
      "membershipLabel" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'pending',
      "statusChangedAt" TIMESTAMP(3),
      "frozenSince" TIMESTAMP(3),
      "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "source" TEXT NOT NULL DEFAULT 'webhook',
      "linkedUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "GymdeskMember_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "GymdeskMember_gymdeskId_key" ON "GymdeskMember"("gymdeskId");
    CREATE INDEX "GymdeskMember_emailHash_idx" ON "GymdeskMember"("emailHash");
    CREATE INDEX "GymdeskMember_email2Hash_idx" ON "GymdeskMember"("email2Hash");
    CREATE INDEX "GymdeskMember_phoneHash_idx" ON "GymdeskMember"("phoneHash");
    CREATE INDEX "GymdeskMember_phone2Hash_idx" ON "GymdeskMember"("phone2Hash");
    CREATE INDEX "GymdeskMember_nameKey_idx" ON "GymdeskMember"("nameKey");
    CREATE INDEX "GymdeskMember_status_idx" ON "GymdeskMember"("status");
    CREATE INDEX "GymdeskMember_linkedUserId_idx" ON "GymdeskMember"("linkedUserId");
    ALTER TABLE "GymdeskMember"
      ADD CONSTRAINT "GymdeskMember_linkedUserId_fkey"
      FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."GymMembershipEvent"') IS NULL THEN
    CREATE TABLE "GymMembershipEvent" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "from" TEXT NOT NULL DEFAULT '',
      "to" TEXT NOT NULL DEFAULT '',
      "reason" TEXT NOT NULL DEFAULT '',
      "source" TEXT NOT NULL DEFAULT '',
      "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "GymMembershipEvent_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "GymMembershipEvent_userId_at_idx" ON "GymMembershipEvent"("userId", "at");
    ALTER TABLE "GymMembershipEvent"
      ADD CONSTRAINT "GymMembershipEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."EmailVerificationCode"') IS NULL THEN
    CREATE TABLE "EmailVerificationCode" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "codeHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "EmailVerificationCode_userId_createdAt_idx"
      ON "EmailVerificationCode"("userId", "createdAt");
    ALTER TABLE "EmailVerificationCode"
      ADD CONSTRAINT "EmailVerificationCode_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."GymdeskMatchQueue"') IS NULL THEN
    CREATE TABLE "GymdeskMatchQueue" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "gymdeskMemberId" TEXT NOT NULL DEFAULT '',
      "kind" TEXT NOT NULL,
      "reason" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'open',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" TIMESTAMP(3),
      "resolvedBy" TEXT NOT NULL DEFAULT '',
      CONSTRAINT "GymdeskMatchQueue_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "GymdeskMatchQueue_status_createdAt_idx"
      ON "GymdeskMatchQueue"("status", "createdAt");
    CREATE INDEX "GymdeskMatchQueue_userId_idx" ON "GymdeskMatchQueue"("userId");
    ALTER TABLE "GymdeskMatchQueue"
      ADD CONSTRAINT "GymdeskMatchQueue_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."GymdeskSyncMeta"') IS NULL THEN
    CREATE TABLE "GymdeskSyncMeta" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL DEFAULT '',
      "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "GymdeskSyncMeta_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "GymdeskSyncMeta_key_key" ON "GymdeskSyncMeta"("key");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'weekPlanSwapsJson'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "weekPlanSwapsJson" TEXT NOT NULL DEFAULT '[]';
  END IF;

  IF to_regclass('public."GymdeskRateLimit"') IS NULL THEN
    CREATE TABLE "GymdeskRateLimit" (
      "id" TEXT NOT NULL,
      "keyHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "GymdeskRateLimit_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "GymdeskRateLimit_keyHash_createdAt_idx"
      ON "GymdeskRateLimit"("keyHash", "createdAt");
  END IF;
END $$;

