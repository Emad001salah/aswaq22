-- AlterTable: Add R2 pipeline columns to ad_images
ALTER TABLE "ad_images"
  ADD COLUMN IF NOT EXISTS "thumb_key"   TEXT,
  ADD COLUMN IF NOT EXISTS "card_key"    TEXT,
  ADD COLUMN IF NOT EXISTS "detail_key"  TEXT,
  ADD COLUMN IF NOT EXISTS "mime_type"   TEXT,
  ADD COLUMN IF NOT EXISTS "size_bytes"  INTEGER,
  ADD COLUMN IF NOT EXISTS "is_primary"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status"      TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "uploaded_by" UUID,
  ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Make url nullable for presigned R2 images
ALTER TABLE "ad_images" ALTER COLUMN "url" DROP NOT NULL;

-- CreateTable: pending_uploads for presigned uploads tracking
CREATE TABLE IF NOT EXISTS "pending_uploads" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "object_key"  TEXT NOT NULL UNIQUE,
  "mime_type"   TEXT NOT NULL,
  "size_bytes"  INTEGER NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "ad_image_id" UUID,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_pending_uploads_user_id" ON "pending_uploads"("user_id");
CREATE INDEX IF NOT EXISTS "idx_pending_uploads_expires_at" ON "pending_uploads"("expires_at");
CREATE INDEX IF NOT EXISTS "idx_ad_images_uploaded_by" ON "ad_images"("uploaded_by");

-- Partial Unique Index for single primary image per ad
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ad_images_one_primary" ON "ad_images"("ad_id") WHERE is_primary = true;
