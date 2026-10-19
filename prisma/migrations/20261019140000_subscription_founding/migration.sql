-- Founding seat flag on a subscription ($59/yr, first 100 members).
ALTER TABLE "Subscription" ADD COLUMN "founding" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Subscription_founding_status_idx" ON "Subscription"("founding", "status");
