-- Progress photos: local file or private Vercel Blob. Existing rows stay local.
ALTER TABLE "ProgressPhoto" ADD COLUMN "storageKind" TEXT NOT NULL DEFAULT 'local';
