-- Latest accepted move/undo sequence per session. A stale write is ignored.
ALTER TABLE "Profile" ADD COLUMN "weekPlanIntentSeqJson" TEXT NOT NULL DEFAULT '{}';
