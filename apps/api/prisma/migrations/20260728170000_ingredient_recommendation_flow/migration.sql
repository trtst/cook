CREATE TYPE "IngredientStatus" AS ENUM ('ACTIVE', 'MERGED');

CREATE TYPE "IngredientRecommendationStatus" AS ENUM ('PENDING', 'REJECTED', 'ADOPTED', 'MERGED');

ALTER TABLE "ingredients"
ADD COLUMN "merged_to_id" UUID,
ADD COLUMN "status" "IngredientStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "ingredients"
ADD CONSTRAINT "ingredients_merged_to_id_fkey"
FOREIGN KEY ("merged_to_id") REFERENCES "ingredients"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ingredients_owner_id_category_id_system_sort_order_id_idx";
DROP INDEX IF EXISTS "ingredients_owner_id_category_id_search_key_id_idx";

CREATE INDEX "ingredients_owner_id_status_category_id_system_sort_order_id_idx"
ON "ingredients"("owner_id", "status", "category_id", "system_sort_order", "id");

CREATE INDEX "ingredients_owner_id_status_category_id_search_key_id_idx"
ON "ingredients"("owner_id", "status", "category_id", "search_key", "id");

CREATE TABLE "ingredient_recommendations" (
  "id" UUID NOT NULL,
  "ingredient_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "IngredientRecommendationStatus" NOT NULL DEFAULT 'PENDING',
  "ingredient_name" VARCHAR(64) NOT NULL,
  "category_id" UUID NOT NULL,
  "category_name" VARCHAR(20) NOT NULL,
  "default_unit_id" UUID NOT NULL,
  "default_unit_name" VARCHAR(16) NOT NULL,
  "review_note" VARCHAR(255),
  "target_ingredient_id" UUID,
  "reviewed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ingredient_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingredient_recommendations_user_id_created_at_idx"
ON "ingredient_recommendations"("user_id", "created_at");

CREATE INDEX "ingredient_recommendations_ingredient_id_created_at_idx"
ON "ingredient_recommendations"("ingredient_id", "created_at");

CREATE INDEX "ingredient_recommendations_status_created_at_idx"
ON "ingredient_recommendations"("status", "created_at");

CREATE UNIQUE INDEX "ingredient_recommendations_pending_key"
ON "ingredient_recommendations"("ingredient_id")
WHERE "status" = 'PENDING';

ALTER TABLE "ingredient_recommendations"
ADD CONSTRAINT "ingredient_recommendations_ingredient_id_fkey"
FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ingredient_recommendations"
ADD CONSTRAINT "ingredient_recommendations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ingredient_recommendations"
ADD CONSTRAINT "ingredient_recommendations_target_ingredient_id_fkey"
FOREIGN KEY ("target_ingredient_id") REFERENCES "ingredients"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
