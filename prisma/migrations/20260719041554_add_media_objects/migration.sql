-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'PARTIAL', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('PENDING', 'UPLOADING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_media_id" UUID;

-- AlterTable
ALTER TABLE "ad_images" ADD COLUMN     "media_id" UUID,
ADD COLUMN     "object_key" TEXT;

-- CreateTable
CREATE TABLE "media_objects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploaded_by" UUID NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "object_key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'aswaq-media',
    "mime_type" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "blur_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_id" UUID NOT NULL,
    "variant_key" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "status" "VariantStatus" NOT NULL DEFAULT 'PENDING',
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "uploaded_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_objects_uploaded_by_idx" ON "media_objects"("uploaded_by");

-- CreateIndex
CREATE INDEX "media_objects_status_idx" ON "media_objects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_media_id_variant_key_key" ON "media_variants"("media_id", "variant_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_avatar_media_id_key" ON "users"("avatar_media_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_images" ADD CONSTRAINT "ad_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

