CREATE TYPE "AdminImageGenerationProvider" AS ENUM ('ARK_SEEDREAM', 'VOLCENGINE_CV');

ALTER TABLE "admin_image_generation_settings"
  ADD COLUMN "provider" "AdminImageGenerationProvider" NOT NULL DEFAULT 'ARK_SEEDREAM',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "admin_image_generation_settings"
  ADD CONSTRAINT "admin_image_generation_settings_version_check" CHECK ("version" > 0);
