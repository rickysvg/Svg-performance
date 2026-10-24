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

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'weightAccess'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "weightAccess" TEXT NOT NULL DEFAULT 'gym';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'trainingFocus'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "trainingFocus" TEXT NOT NULL DEFAULT 'martial_arts_sc';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'liftDaysPerWeek'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "liftDaysPerWeek" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'outsideTrainingJson'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "outsideTrainingJson" TEXT NOT NULL DEFAULT '[]';
  END IF;
END $$;

-- Ricky: 3 lift days, Wednesday class/drilling at 6 PM, Saturday sparring at 11 AM.
DO $$
BEGIN
  IF to_regclass('public."Profile"') IS NULL OR to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  UPDATE "Profile"
  SET "liftDaysPerWeek" = 3
  WHERE "liftDaysPerWeek" IS NULL
    AND "userId" IN (
      SELECT "id" FROM "User" WHERE lower("email") = 'rmaynez21@gmail.com'
    );

  UPDATE "Profile"
  SET "outsideTrainingJson" = '[{"weekday":"Wednesday","kind":"class","time":"18:00"},{"weekday":"Saturday","kind":"sparring","time":"11:00"}]'
  WHERE ("outsideTrainingJson" IS NULL OR "outsideTrainingJson" = '[]' OR "outsideTrainingJson" = '')
    AND "userId" IN (
      SELECT "id" FROM "User" WHERE lower("email") = 'rmaynez21@gmail.com'
    );
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

-- Exercise tags for the workout-complete recap. Additive, idempotent.
DO $$
BEGIN
  IF to_regclass('public."ProgramExercise"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProgramExercise'
      AND column_name = 'tags'
  ) THEN
    ALTER TABLE "ProgramExercise" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Exercise swap library. Additive. No-ops until User exists.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."ExerciseSwap"') IS NULL THEN
    CREATE TABLE "ExerciseSwap" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "programSlug" TEXT NOT NULL DEFAULT '',
      "dayNumber" INTEGER NOT NULL DEFAULT 0,
      "originalName" TEXT NOT NULL,
      "replacementName" TEXT NOT NULL,
      "scope" TEXT NOT NULL,
      "workoutSessionId" TEXT NOT NULL DEFAULT '',
      "blockKey" TEXT NOT NULL DEFAULT '',
      "sets" INTEGER NOT NULL,
      "reps" TEXT NOT NULL,
      "loadText" TEXT NOT NULL,
      "restSeconds" INTEGER NOT NULL,
      "logMode" TEXT NOT NULL,
      "notes" TEXT NOT NULL DEFAULT '',
      "retiredNamesJson" TEXT NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ExerciseSwap_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "ExerciseSwap_userId_programSlug_dayNumber_idx"
      ON "ExerciseSwap"("userId", "programSlug", "dayNumber");
    CREATE INDEX "ExerciseSwap_userId_workoutSessionId_idx"
      ON "ExerciseSwap"("userId", "workoutSessionId");
    ALTER TABLE "ExerciseSwap"
      ADD CONSTRAINT "ExerciseSwap_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AI coach portrait and coaching style. Additive, idempotent.
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
      AND column_name = 'aiCoachId'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "aiCoachId" TEXT NOT NULL DEFAULT 'skye';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'coachingStyle'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "coachingStyle" TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'coachChoiceAt'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "coachChoiceAt" TIMESTAMP(3);
  END IF;

  -- Default coach is Skye, including rows created before this rename.
  ALTER TABLE "Profile" ALTER COLUMN "aiCoachId" SET DEFAULT 'skye';
  UPDATE "Profile" SET "aiCoachId" = 'skye' WHERE "aiCoachId" IN ('lena', '');
END $$;

-- Progress photos can live in private Vercel Blob. Existing rows stay local files.
DO $$
BEGIN
  IF to_regclass('public."ProgressPhoto"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProgressPhoto'
      AND column_name = 'storageKind'
  ) THEN
    ALTER TABLE "ProgressPhoto" ADD COLUMN "storageKind" TEXT NOT NULL DEFAULT 'local';
  END IF;
END $$;

-- Session exercise removals. Additive. No-ops until User exists.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."ExerciseRemoval"') IS NULL THEN
    CREATE TABLE "ExerciseRemoval" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "programSlug" TEXT NOT NULL DEFAULT '',
      "dayNumber" INTEGER NOT NULL DEFAULT 0,
      "originalName" TEXT NOT NULL,
      "exerciseName" TEXT NOT NULL,
      "workoutSessionId" TEXT NOT NULL DEFAULT '',
      "snapshotJson" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExerciseRemoval_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "ExerciseRemoval_userId_programSlug_dayNumber_idx"
      ON "ExerciseRemoval"("userId", "programSlug", "dayNumber");
    CREATE INDEX "ExerciseRemoval_userId_workoutSessionId_idx"
      ON "ExerciseRemoval"("userId", "workoutSessionId");
    ALTER TABLE "ExerciseRemoval"
      ADD CONSTRAINT "ExerciseRemoval_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Sparring session rating, body rating, and sore spots. Additive.
DO $$
BEGIN
  IF to_regclass('public."OutsideSessionLog"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OutsideSessionLog'
      AND column_name = 'sessionRating'
  ) THEN
    ALTER TABLE "OutsideSessionLog" ADD COLUMN "sessionRating" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OutsideSessionLog'
      AND column_name = 'bodyRating'
  ) THEN
    ALTER TABLE "OutsideSessionLog" ADD COLUMN "bodyRating" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OutsideSessionLog'
      AND column_name = 'soreSpots'
  ) THEN
    ALTER TABLE "OutsideSessionLog" ADD COLUMN "soreSpots" TEXT NOT NULL DEFAULT '[]';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OutsideSessionLog'
      AND column_name = 'coachCheckIn'
  ) THEN
    ALTER TABLE "OutsideSessionLog" ADD COLUMN "coachCheckIn" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Spoken daily briefing. Additive, idempotent.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."CoachDaySummary"') IS NULL THEN
    CREATE TABLE "CoachDaySummary" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "dayKey" TEXT NOT NULL,
      "coachId" TEXT NOT NULL,
      "factsKey" TEXT NOT NULL,
      "voice" TEXT NOT NULL,
      "script" TEXT NOT NULL,
      "audio" BYTEA,
      "mimeType" TEXT NOT NULL DEFAULT 'audio/mpeg',
      "source" TEXT NOT NULL DEFAULT 'template',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CoachDaySummary_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "CoachDaySummary_userId_dayKey_coachId_factsKey_key"
      ON "CoachDaySummary"("userId", "dayKey", "coachId", "factsKey");
    CREATE INDEX "CoachDaySummary_userId_dayKey_idx"
      ON "CoachDaySummary"("userId", "dayKey");
    ALTER TABLE "CoachDaySummary"
      ADD CONSTRAINT "CoachDaySummary_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


-- Subscription.founding stays in place so existing rows are not dropped.
-- App writes do not clear the column. Access follows the current plan or price.
DO $$
BEGIN
  IF to_regclass('public."Subscription"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Subscription'
      AND column_name = 'founding'
  ) THEN
    ALTER TABLE "Subscription" ADD COLUMN "founding" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF to_regclass('public."Subscription_founding_status_idx"') IS NULL THEN
    CREATE INDEX "Subscription_founding_status_idx" ON "Subscription"("founding", "status");
  END IF;
END $$;

-- Pro tiers: member Pro month, AI usage metering, member Pro reminders. Additive, idempotent.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."Profile"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'memberProStartedAt'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "memberProStartedAt" TIMESTAMP(3);
  END IF;

  IF to_regclass('public."AiUsageEvent"') IS NULL THEN
    CREATE TABLE "AiUsageEvent" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "surface" TEXT NOT NULL DEFAULT '',
      "units" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "AiUsageEvent_userId_kind_createdAt_idx"
      ON "AiUsageEvent"("userId", "kind", "createdAt");
    ALTER TABLE "AiUsageEvent"
      ADD CONSTRAINT "AiUsageEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."MemberProReminderLog"') IS NULL THEN
    CREATE TABLE "MemberProReminderLog" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "stage" TEXT NOT NULL,
      "channel" TEXT NOT NULL DEFAULT 'push',
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MemberProReminderLog_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "MemberProReminderLog_userId_stage_key"
      ON "MemberProReminderLog"("userId", "stage");
    ALTER TABLE "MemberProReminderLog"
      ADD CONSTRAINT "MemberProReminderLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Home athlete imagery. Blank uses the male tile set. Additive, idempotent.
DO $$
BEGIN
  IF to_regclass('public."Profile"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'athleteImagery'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "athleteImagery" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Member Pro grant length. Null keeps an already-started 30-day period. Additive, idempotent.
DO $$
BEGIN
  IF to_regclass('public."Profile"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'memberProDays'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "memberProDays" INTEGER;
  END IF;
END $$;

-- Saved workouts. Additive, idempotent. No drops and no backfill.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."SavedWorkout"') IS NULL THEN
    CREATE TABLE "SavedWorkout" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "lastUsedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SavedWorkout_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "SavedWorkout_userId_updatedAt_idx" ON "SavedWorkout"("userId", "updatedAt");
    ALTER TABLE "SavedWorkout"
      ADD CONSTRAINT "SavedWorkout_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."SavedWorkoutExercise"') IS NULL THEN
    CREATE TABLE "SavedWorkoutExercise" (
      "id" TEXT NOT NULL,
      "savedWorkoutId" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL,
      "sets" INTEGER NOT NULL,
      "reps" TEXT NOT NULL,
      "loadText" TEXT NOT NULL DEFAULT '',
      "restSeconds" INTEGER NOT NULL DEFAULT 60,
      "rir" TEXT NOT NULL DEFAULT '',
      "logMode" TEXT NOT NULL DEFAULT 'load_reps',
      "notes" TEXT NOT NULL DEFAULT '',
      CONSTRAINT "SavedWorkoutExercise_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "SavedWorkoutExercise_savedWorkoutId_idx" ON "SavedWorkoutExercise"("savedWorkoutId");
    ALTER TABLE "SavedWorkoutExercise"
      ADD CONSTRAINT "SavedWorkoutExercise_savedWorkoutId_fkey"
      FOREIGN KEY ("savedWorkoutId") REFERENCES "SavedWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."DayWorkoutPlan"') IS NULL THEN
    CREATE TABLE "DayWorkoutPlan" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "dayKey" TEXT NOT NULL,
      "mode" TEXT NOT NULL,
      "savedWorkoutId" TEXT,
      "name" TEXT NOT NULL,
      "exercisesJson" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DayWorkoutPlan_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "DayWorkoutPlan_userId_dayKey_idx" ON "DayWorkoutPlan"("userId", "dayKey");
    ALTER TABLE "DayWorkoutPlan"
      ADD CONSTRAINT "DayWorkoutPlan_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "DayWorkoutPlan"
      ADD CONSTRAINT "DayWorkoutPlan_savedWorkoutId_fkey"
      FOREIGN KEY ("savedWorkoutId") REFERENCES "SavedWorkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."WorkoutSession"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'savedWorkoutId'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "savedWorkoutId" TEXT;
  END IF;

  IF to_regclass('public."WorkoutSession"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'dayPlanId'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "dayPlanId" TEXT;
  END IF;
END $$;

-- Coach template notes: weekly recap and one proactive message per day. No OpenAI required.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."CoachAutoNote"') IS NULL THEN
    CREATE TABLE "CoachAutoNote" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "dedupeKey" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CoachAutoNote_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "CoachAutoNote_userId_dedupeKey_key"
      ON "CoachAutoNote"("userId", "dedupeKey");
    CREATE INDEX "CoachAutoNote_userId_createdAt_idx"
      ON "CoachAutoNote"("userId", "createdAt");
    ALTER TABLE "CoachAutoNote"
      ADD CONSTRAINT "CoachAutoNote_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Header timer freeze. Nullable columns only; existing workouts keep their rows.
DO $$
BEGIN
  IF to_regclass('public."WorkoutSession"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'finishedAt'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "finishedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'elapsedSeconds'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "elapsedSeconds" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'timerStartedAt'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "timerStartedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'plannedSetCount'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "plannedSetCount" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'source'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "source" TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'backfilled'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "backfilled" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- VIP Coaching. Additive only: applications, checkout grants, upsell events, 72h waitlist holds.
-- Idempotent. No DROP. No-ops until User exists. Spot counts are not stored here.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."PlanWaitlist"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PlanWaitlist' AND column_name = 'holdUntil'
  ) THEN
    ALTER TABLE "PlanWaitlist" ADD COLUMN "holdUntil" TIMESTAMP(3);
  END IF;

  IF to_regclass('public."PlanWaitlist"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PlanWaitlist' AND column_name = 'offeredAt'
  ) THEN
    ALTER TABLE "PlanWaitlist" ADD COLUMN "offeredAt" TIMESTAMP(3);
  END IF;

  IF to_regclass('public."VipApplication"') IS NULL THEN
    CREATE TABLE "VipApplication" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "goals" TEXT NOT NULL,
      "experience" TEXT NOT NULL,
      "fightDate" TEXT NOT NULL DEFAULT '',
      "injuries" TEXT NOT NULL,
      "availability" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "reviewerId" TEXT NOT NULL DEFAULT '',
      "reviewedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "VipApplication_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "VipApplication_userId_createdAt_idx" ON "VipApplication"("userId", "createdAt");
    CREATE INDEX "VipApplication_status_createdAt_idx" ON "VipApplication"("status", "createdAt");
    ALTER TABLE "VipApplication"
      ADD CONSTRAINT "VipApplication_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."VipCheckoutGrant"') IS NULL THEN
    CREATE TABLE "VipCheckoutGrant" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "applicationId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'open',
      "introApplied" BOOLEAN NOT NULL DEFAULT false,
      "creditCents" INTEGER NOT NULL DEFAULT 0,
      "uncappedCents" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "consumedAt" TIMESTAMP(3),
      CONSTRAINT "VipCheckoutGrant_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "VipCheckoutGrant_applicationId_key" ON "VipCheckoutGrant"("applicationId");
    CREATE INDEX "VipCheckoutGrant_userId_status_idx" ON "VipCheckoutGrant"("userId", "status");
    ALTER TABLE "VipCheckoutGrant"
      ADD CONSTRAINT "VipCheckoutGrant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "VipCheckoutGrant"
      ADD CONSTRAINT "VipCheckoutGrant_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "VipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public."VipUpsellEvent"') IS NULL THEN
    CREATE TABLE "VipUpsellEvent" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "trigger" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VipUpsellEvent_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "VipUpsellEvent_userId_trigger_createdAt_idx" ON "VipUpsellEvent"("userId", "trigger", "createdAt");
    CREATE INDEX "VipUpsellEvent_userId_createdAt_idx" ON "VipUpsellEvent"("userId", "createdAt");
    ALTER TABLE "VipUpsellEvent"
      ADD CONSTRAINT "VipUpsellEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Assistant replies store the coach who wrote them. Old rows stay null:
-- coachChoiceAt is the first choice or a dismiss, not a switch, so the current
-- coach is not copied onto history. A null coachId shows the generic Coach label.
DO $$
BEGIN
  IF to_regclass('public."ChatMessage"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ChatMessage' AND column_name = 'coachId'
  ) THEN
    ALTER TABLE "ChatMessage" ADD COLUMN "coachId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Profile"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'aiCoachChangedAt'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "aiCoachChangedAt" TIMESTAMP(3);
  END IF;
END $$;

-- A second Resume cannot insert the same set slot.
-- Rank logged reps, load, or time first, then a tick, then notes, then the lowest id.
-- Merge the other copies onto the kept row before deleting them.
DO $$
DECLARE
  removed integer;
BEGIN
  IF to_regclass('public."WorkoutSet"') IS NULL THEN
    RETURN;
  END IF;

  WITH ranked AS (
    SELECT
      "id",
      "workoutSessionId",
      "exerciseName",
      "setNumber",
      ROW_NUMBER() OVER (
        PARTITION BY "workoutSessionId", "exerciseName", "setNumber"
        ORDER BY
          CASE
            WHEN "reps" IS NOT NULL OR "loadValue" IS NOT NULL OR COALESCE("durationSeconds", 0) > 0 THEN 1
            ELSE 0
          END DESC,
          CASE WHEN "completed" THEN 1 ELSE 0 END DESC,
          CASE WHEN btrim(COALESCE("notes", '')) <> '' THEN 1 ELSE 0 END DESC,
          "id" ASC
      ) AS keep_rank,
      COUNT(*) OVER (PARTITION BY "workoutSessionId", "exerciseName", "setNumber") AS copies
    FROM "WorkoutSet"
  ),
  keepers AS (
    SELECT "id", "workoutSessionId", "exerciseName", "setNumber"
    FROM ranked
    WHERE keep_rank = 1 AND copies > 1
  ),
  merged AS (
    SELECT
      k."id" AS keep_id,
      bool_or(s."completed") AS completed,
      COALESCE(
        (array_agg(s."reps" ORDER BY s."id") FILTER (WHERE s."id" = k."id" AND s."reps" IS NOT NULL))[1],
        (array_agg(s."reps" ORDER BY s."id") FILTER (WHERE s."reps" IS NOT NULL))[1]
      ) AS reps,
      COALESCE(
        (array_agg(s."loadValue" ORDER BY s."id") FILTER (WHERE s."id" = k."id" AND s."loadValue" IS NOT NULL))[1],
        (array_agg(s."loadValue" ORDER BY s."id") FILTER (WHERE s."loadValue" IS NOT NULL))[1]
      ) AS load_value,
      COALESCE(
        (array_agg(s."durationSeconds" ORDER BY s."id") FILTER (WHERE s."id" = k."id" AND COALESCE(s."durationSeconds", 0) > 0))[1],
        (array_agg(s."durationSeconds" ORDER BY s."id") FILTER (WHERE COALESCE(s."durationSeconds", 0) > 0))[1]
      ) AS duration_seconds,
      COALESCE((
        SELECT string_agg(n.note, E'\n' ORDER BY n.first_id)
        FROM (
          SELECT btrim(s2."notes") AS note, MIN(s2."id") AS first_id
          FROM "WorkoutSet" s2
          WHERE s2."workoutSessionId" = k."workoutSessionId"
            AND s2."exerciseName" = k."exerciseName"
            AND s2."setNumber" = k."setNumber"
            AND btrim(COALESCE(s2."notes", '')) <> ''
          GROUP BY btrim(s2."notes")
        ) n
      ), '') AS notes
    FROM keepers k
    JOIN "WorkoutSet" s
      ON s."workoutSessionId" = k."workoutSessionId"
     AND s."exerciseName" = k."exerciseName"
     AND s."setNumber" = k."setNumber"
    GROUP BY k."id", k."workoutSessionId", k."exerciseName", k."setNumber"
  )
  UPDATE "WorkoutSet" AS kept
  SET
    "completed" = merged.completed,
    "reps" = merged.reps,
    "loadValue" = merged.load_value,
    "durationSeconds" = merged.duration_seconds,
    "notes" = merged.notes
  FROM merged
  WHERE kept."id" = merged.keep_id;

  WITH ranked AS (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "workoutSessionId", "exerciseName", "setNumber"
        ORDER BY
          CASE
            WHEN "reps" IS NOT NULL OR "loadValue" IS NOT NULL OR COALESCE("durationSeconds", 0) > 0 THEN 1
            ELSE 0
          END DESC,
          CASE WHEN "completed" THEN 1 ELSE 0 END DESC,
          CASE WHEN btrim(COALESCE("notes", '')) <> '' THEN 1 ELSE 0 END DESC,
          "id" ASC
      ) AS keep_rank
    FROM "WorkoutSet"
  )
  DELETE FROM "WorkoutSet"
  WHERE "id" IN (SELECT "id" FROM ranked WHERE keep_rank > 1);
  GET DIAGNOSTICS removed = ROW_COUNT;
  RAISE NOTICE 'workout set duplicates removed: %', removed;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'WorkoutSet_workoutSessionId_exerciseName_setNumber_key'
  ) THEN
    CREATE UNIQUE INDEX "WorkoutSet_workoutSessionId_exerciseName_setNumber_key"
      ON "WorkoutSet"("workoutSessionId", "exerciseName", "setNumber");
  END IF;
END $$;

-- Past-day workout logs. This block stays as well as the WorkoutSession block above.
-- Keep it beside any other block appended here. Idempotent, so running both is safe.
-- Empty source and backfilled=false keep older sessions as live logs.
DO $$
BEGIN
  IF to_regclass('public."WorkoutSession"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'source'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "source" TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkoutSession' AND column_name = 'backfilled'
  ) THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN "backfilled" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
