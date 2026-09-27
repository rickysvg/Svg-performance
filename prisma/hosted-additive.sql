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
