-- Days granted when a verified member's free Pro period started.
-- Null on existing rows keeps the original 30-day grant.
ALTER TABLE "Profile" ADD COLUMN "memberProDays" INTEGER;
