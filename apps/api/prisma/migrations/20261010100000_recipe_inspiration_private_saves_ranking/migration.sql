CREATE TYPE "RecipeRecommendationRank" AS ENUM (
  'NORMAL',
  'DOWNRANK',
  'STRONG_DOWNRANK'
);

ALTER TABLE "recipes"
  ADD COLUMN "inspiration_published_at" TIMESTAMPTZ(3),
  ADD COLUMN "recommendation_rank" "RecipeRecommendationRank" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "recommendation_rank_reason" VARCHAR(255);

UPDATE "recipes"
SET "inspiration_published_at" = "created_at"
WHERE "is_inspiration" = TRUE
  AND "inspiration_category_id" IS NOT NULL
  AND "inspiration_published_at" IS NULL;

WITH collector_counts AS (
  SELECT "source_recipe_id", COUNT(DISTINCT "user_id")::INTEGER AS "collect_count"
  FROM "recipe_collections"
  GROUP BY "source_recipe_id"
)
UPDATE "recipes" recipe
SET "collect_count" = COALESCE(collector_counts."collect_count", 0)
FROM collector_counts
WHERE recipe."id" = collector_counts."source_recipe_id"
  AND recipe."collect_count" <> collector_counts."collect_count";

UPDATE "recipes" recipe
SET "collect_count" = 0
WHERE recipe."collect_count" <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM "recipe_collections" collection
    WHERE collection."source_recipe_id" = recipe."id"
  );

CREATE INDEX "recipe_collections_source_created_user_idx"
  ON "recipe_collections"("source_recipe_id", "created_at", "user_id");

CREATE INDEX "meal_plan_dishes_recipe_created_idx"
  ON "meal_plan_dishes"("recipe_id", "created_at", "id");

CREATE INDEX "recipes_inspiration_publication_idx"
  ON "recipes"("inspiration_category_id", "status", "inspiration_published_at" DESC, "id" DESC)
  WHERE "is_inspiration" = TRUE;
