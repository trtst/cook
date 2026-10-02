ALTER TABLE "admin_image_generation_settings"
  ADD COLUMN "recipe_cover_keywords" VARCHAR(1000) NOT NULL DEFAULT '',
  ADD COLUMN "recipe_step_keywords" VARCHAR(1000) NOT NULL DEFAULT '';

UPDATE "admin_image_generation_settings"
SET "recipe_cover_keywords" = "recipe_keywords";

ALTER TABLE "admin_image_generation_settings"
  DROP COLUMN "recipe_keywords";
