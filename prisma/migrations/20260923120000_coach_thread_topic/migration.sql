-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN "topic" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChatThread" ADD COLUMN "art" TEXT NOT NULL DEFAULT '';
CREATE INDEX "ChatThread_userId_topic_art_idx" ON "ChatThread"("userId", "topic", "art");
