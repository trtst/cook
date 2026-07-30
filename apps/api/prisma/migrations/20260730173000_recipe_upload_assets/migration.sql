-- CreateEnum
CREATE TYPE "UploadAssetType" AS ENUM ('RECIPE');

-- CreateEnum
CREATE TYPE "UploadAssetScene" AS ENUM ('RECIPE_COVER', 'RECIPE_STEP');

-- CreateEnum
CREATE TYPE "UploadAssetStatus" AS ENUM ('TEMP', 'BOUND', 'DELETED');

-- CreateTable
CREATE TABLE "upload_assets" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(36) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "draft_id" INTEGER,
    "recipe_version_id" INTEGER,
    "type" "UploadAssetType" NOT NULL,
    "scene" "UploadAssetScene" NOT NULL,
    "slot_key" VARCHAR(64) NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "content_type" VARCHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "source_hash" VARCHAR(64) NOT NULL,
    "status" "UploadAssetStatus" NOT NULL DEFAULT 'TEMP',
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "upload_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_assets_public_id_key" ON "upload_assets"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_assets_draft_id_scene_slot_key_key" ON "upload_assets"("draft_id", "scene", "slot_key");

-- CreateIndex
CREATE INDEX "upload_assets_user_id_status_updated_at_idx" ON "upload_assets"("user_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "upload_assets_draft_id_status_updated_at_idx" ON "upload_assets"("draft_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "upload_assets_recipe_version_id_idx" ON "upload_assets"("recipe_version_id");

-- AddForeignKey
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_assets_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "recipe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_assets_recipe_version_id_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
