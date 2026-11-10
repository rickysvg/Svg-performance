-- Public pre-launch waitlist backup. Email is unique and stored lowercase.
CREATE TABLE "waitlist_signups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "train" TEXT NOT NULL DEFAULT '',
    "member" TEXT NOT NULL DEFAULT 'No',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'waitlist'
);

CREATE UNIQUE INDEX "waitlist_signups_email_key" ON "waitlist_signups"("email");

CREATE INDEX "waitlist_signups_created_at_idx" ON "waitlist_signups"("created_at");
