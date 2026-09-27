-- Additive hosted columns from PR #46. Safe on existing Profile rows.
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
