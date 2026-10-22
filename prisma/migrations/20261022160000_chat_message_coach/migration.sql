-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "coachId" TEXT NOT NULL DEFAULT '';

-- Existing assistant replies keep the coach the member had when this ships.
UPDATE "ChatMessage"
SET "coachId" = COALESCE((
  SELECT "Profile"."aiCoachId"
  FROM "ChatThread"
  JOIN "Profile" ON "Profile"."userId" = "ChatThread"."userId"
  WHERE "ChatThread"."id" = "ChatMessage"."threadId"
), '')
WHERE "role" = 'assistant' AND "coachId" = '';
