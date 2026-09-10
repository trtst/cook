ALTER TYPE "RecipeVersionTagCode" ADD VALUE IF NOT EXISTS 'CUISINE';
ALTER TYPE "RecipeVersionTagCode" ADD VALUE IF NOT EXISTS 'DISH_STYLE';

ALTER TABLE "recipe_content_versions"
  ADD COLUMN IF NOT EXISTS "keywords_json" JSONB NOT NULL DEFAULT '[]'::jsonb;
