CREATE TYPE "AdminImageGenerationAssetType" AS ENUM ('INGREDIENT', 'RECIPE');
CREATE TYPE "AdminImageGenerationTargetType" AS ENUM ('INGREDIENT', 'RECIPE_COVER', 'RECIPE_STEP', 'WIKI_STEP');

CREATE TABLE "admin_image_generation_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "ingredient_keywords" VARCHAR(1000) NOT NULL DEFAULT '',
  "recipe_keywords" VARCHAR(1000) NOT NULL DEFAULT '',
  "updated_by_admin_id" INTEGER,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_image_generation_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_image_generation_settings_singleton_check" CHECK ("id" = 1)
);
ALTER TABLE "admin_image_generation_settings" ADD CONSTRAINT "admin_image_generation_settings_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "admin_image_generation_settings" ("id") VALUES (1);

CREATE TABLE "admin_image_generation_candidates" (
  "id" SERIAL NOT NULL,
  "asset_type" "AdminImageGenerationAssetType" NOT NULL,
  "target_type" "AdminImageGenerationTargetType" NOT NULL,
  "target_id" INTEGER NOT NULL,
  "content_version_id" INTEGER NOT NULL DEFAULT 0,
  "step_order" INTEGER NOT NULL DEFAULT 0,
  "temp_key" VARCHAR(80) NOT NULL,
  "prompt" VARCHAR(2000) NOT NULL,
  "created_by_admin_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_image_generation_candidates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_image_generation_candidates_asset_target_check" CHECK (("asset_type" = 'INGREDIENT' AND "target_type" = 'INGREDIENT') OR ("asset_type" = 'RECIPE' AND "target_type" <> 'INGREDIENT')),
  CONSTRAINT "admin_image_generation_candidates_step_order_check" CHECK (("target_type" IN ('RECIPE_COVER', 'INGREDIENT') AND "step_order" = 0) OR ("target_type" IN ('RECIPE_STEP', 'WIKI_STEP') AND "step_order" > 0)),
  CONSTRAINT "admin_image_generation_candidates_content_version_check" CHECK (("asset_type" = 'INGREDIENT' AND "content_version_id" = 0) OR ("asset_type" = 'RECIPE' AND "content_version_id" > 0))
);

CREATE UNIQUE INDEX "admin_image_generation_candidates_temp_key_key" ON "admin_image_generation_candidates"("temp_key");
CREATE UNIQUE INDEX "admin_image_generation_candidates_target_key" ON "admin_image_generation_candidates"("target_type", "target_id", "content_version_id", "step_order");
CREATE INDEX "admin_image_generation_candidates_asset_target_created_idx" ON "admin_image_generation_candidates"("asset_type", "target_id", "created_at");
ALTER TABLE "admin_image_generation_candidates" ADD CONSTRAINT "admin_image_generation_candidates_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
