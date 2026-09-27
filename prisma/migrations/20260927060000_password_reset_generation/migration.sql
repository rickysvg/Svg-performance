-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "PasswordResetAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PasswordResetAttempt_keyHash_createdAt_idx" ON "PasswordResetAttempt"("keyHash", "createdAt");

-- Invalidate every reset link issued before generation 2.
DELETE FROM "PasswordResetToken" WHERE "generation" < 2;
