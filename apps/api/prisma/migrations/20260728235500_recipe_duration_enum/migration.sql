CREATE TYPE "RecipeDuration" AS ENUM ('WITHIN_15', 'BETWEEN_15_30', 'BETWEEN_30_60', 'OVER_60');

ALTER TABLE "recipe_content_versions"
  DROP CONSTRAINT IF EXISTS "ck_recipe_content_versions_duration";

ALTER TABLE "recipe_content_versions"
  ADD COLUMN "duration" "RecipeDuration";

UPDATE "recipe_content_versions"
SET "duration" = CASE
  WHEN "duration_minutes" IS NULL THEN NULL
  WHEN "duration_minutes" <= 0 THEN NULL
  WHEN "duration_minutes" <= 15 THEN 'WITHIN_15'::"RecipeDuration"
  WHEN "duration_minutes" <= 30 THEN 'BETWEEN_15_30'::"RecipeDuration"
  WHEN "duration_minutes" <= 60 THEN 'BETWEEN_30_60'::"RecipeDuration"
  ELSE 'OVER_60'::"RecipeDuration"
END;

ALTER TABLE "recipe_content_versions"
  DROP COLUMN "duration_minutes";
