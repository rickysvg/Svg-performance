-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "coachId" TEXT;

-- Stamp a reply only when the member had already chosen that coach.
-- Older replies stay null so a later switch cannot relabel them.
UPDATE "ChatMessage"
SET "coachId" = (
  SELECT "Profile"."aiCoachId"
  FROM "ChatThread"
  JOIN "Profile" ON "Profile"."userId" = "ChatThread"."userId"
  WHERE "ChatThread"."id" = "ChatMessage"."threadId"
    AND "Profile"."coachChoiceAt" IS NOT NULL
    AND "ChatMessage"."createdAt" >= "Profile"."coachChoiceAt"
    AND "Profile"."aiCoachId" <> ''
)
WHERE "role" = 'assistant'
  AND "coachId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "ChatThread"
    JOIN "Profile" ON "Profile"."userId" = "ChatThread"."userId"
    WHERE "ChatThread"."id" = "ChatMessage"."threadId"
      AND "Profile"."coachChoiceAt" IS NOT NULL
      AND "ChatMessage"."createdAt" >= "Profile"."coachChoiceAt"
      AND "Profile"."aiCoachId" <> ''
  );
