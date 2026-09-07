CREATE TYPE "RecipeVersionTagStatus" AS ENUM (
  'CONFIRMED',
  'CANDIDATE',
  'UNMAPPED',
  'NEEDS_REVIEW'
);

ALTER TABLE "recipe_version_tags"
ADD COLUMN "status" "RecipeVersionTagStatus" NOT NULL DEFAULT 'CANDIDATE';
