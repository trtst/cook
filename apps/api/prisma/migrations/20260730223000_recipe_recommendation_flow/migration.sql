CREATE TYPE "RecipeRecommendationStatus" AS ENUM ('PENDING', 'REJECTED', 'ADOPTED', 'WITHDRAWN');

ALTER TABLE "recipes"
ADD COLUMN "curated_by_name" VARCHAR(64);

CREATE TABLE "recipe_recommendations" (
  "id" SERIAL NOT NULL,
  "recipe_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "source_version_id" INTEGER NOT NULL,
  "suggested_category_id" INTEGER NOT NULL,
  "status" "RecipeRecommendationStatus" NOT NULL DEFAULT 'PENDING',
  "recipe_title" VARCHAR(120) NOT NULL,
  "curated_by_name" VARCHAR(64) NOT NULL,
  "suggested_category_name" VARCHAR(20) NOT NULL,
  "review_note" VARCHAR(255),
  "adopted_recipe_id" INTEGER,
  "reviewed_at" TIMESTAMPTZ(3),
  "withdrawn_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_recommendations_adopted_recipe_id_key" ON "recipe_recommendations"("adopted_recipe_id");
CREATE INDEX "recipe_recommendations_user_id_created_at_idx" ON "recipe_recommendations"("user_id", "created_at");
CREATE INDEX "recipe_recommendations_recipe_id_created_at_idx" ON "recipe_recommendations"("recipe_id", "created_at");
CREATE INDEX "recipe_recommendations_status_created_at_idx" ON "recipe_recommendations"("status", "created_at");
CREATE INDEX "recipe_recommendations_suggested_category_id_created_at_idx" ON "recipe_recommendations"("suggested_category_id", "created_at");
CREATE UNIQUE INDEX "recipe_recommendations_pending_recipe_idx"
ON "recipe_recommendations" ("recipe_id")
WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "recipe_recommendations_adopted_version_idx"
ON "recipe_recommendations" ("recipe_id", "source_version_id")
WHERE "status" = 'ADOPTED';

ALTER TABLE "recipe_recommendations"
ADD CONSTRAINT "recipe_recommendations_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_recommendations"
ADD CONSTRAINT "recipe_recommendations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_recommendations"
ADD CONSTRAINT "recipe_recommendations_source_version_id_fkey"
FOREIGN KEY ("source_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_recommendations"
ADD CONSTRAINT "recipe_recommendations_suggested_category_id_fkey"
FOREIGN KEY ("suggested_category_id") REFERENCES "inspiration_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recipe_recommendations"
ADD CONSTRAINT "recipe_recommendations_adopted_recipe_id_fkey"
FOREIGN KEY ("adopted_recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
