ALTER TYPE "RecipeImportSourceType" ADD VALUE IF NOT EXISTS 'JSON';

ALTER TABLE "recipe_content_versions"
ADD COLUMN "tools_json" JSONB NOT NULL DEFAULT '[]';
