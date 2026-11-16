-- One-shot "We're live" email stamp. Nullable. Existing rows stay null.
-- No drops, no type changes, no NOT NULL.

ALTER TABLE "waitlist_signups" ADD COLUMN "live_email_sent_at" DATETIME;
