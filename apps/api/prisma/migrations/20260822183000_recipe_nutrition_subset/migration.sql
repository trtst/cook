CREATE TYPE "IngredientNutrientMappingStatus" AS ENUM ('CONFIRMED', 'CANDIDATE', 'UNMAPPED');
CREATE TYPE "RecipeNutritionStatus" AS ENUM ('COMPLETE', 'ESTIMATED', 'INSUFFICIENT', 'NONE');

CREATE TABLE "nutrient_source_batches" (
  "id" SERIAL NOT NULL,
  "source_repo" VARCHAR(128) NOT NULL,
  "source_version" VARCHAR(64) NOT NULL,
  "source_path" VARCHAR(255) NOT NULL,
  "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrient_source_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrient_source_foods" (
  "id" SERIAL NOT NULL,
  "batch_id" INTEGER NOT NULL,
  "source_food_code" VARCHAR(32) NOT NULL,
  "source_name" VARCHAR(128) NOT NULL,
  "raw_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrient_source_foods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrient_foods" (
  "id" SERIAL NOT NULL,
  "source_food_code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(128) NOT NULL,
  "edible_rate" DOUBLE PRECISION,
  "calories" DOUBLE PRECISION,
  "protein" DOUBLE PRECISION,
  "fat" DOUBLE PRECISION,
  "carbohydrate" DOUBLE PRECISION,
  "source_version" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrient_foods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ingredient_nutrient_mappings" (
  "id" SERIAL NOT NULL,
  "ingredient_id" INTEGER NOT NULL,
  "nutrient_food_id" INTEGER,
  "status" "IngredientNutrientMappingStatus" NOT NULL,
  "match_type" VARCHAR(32) NOT NULL,
  "confidence" DOUBLE PRECISION,
  "source_version" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingredient_nutrient_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ingredient_unit_nutrient_conversions" (
  "id" SERIAL NOT NULL,
  "ingredient_id" INTEGER NOT NULL,
  "unit_id" INTEGER NOT NULL,
  "grams_per_unit" DOUBLE PRECISION NOT NULL,
  "source_version" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingredient_unit_nutrient_conversions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_nutrition_snapshots" (
  "id" SERIAL NOT NULL,
  "recipe_version_id" INTEGER NOT NULL,
  "status" "RecipeNutritionStatus" NOT NULL,
  "quality_label" VARCHAR(32),
  "per_serving_json" JSONB,
  "per_recipe_json" JSONB,
  "coverage_rate" DOUBLE PRECISION,
  "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source_version" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_nutrition_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nutrient_source_batches_source_repo_source_version_source_path_key"
ON "nutrient_source_batches"("source_repo", "source_version", "source_path");

CREATE INDEX "nutrient_source_batches_source_version_imported_at_idx"
ON "nutrient_source_batches"("source_version", "imported_at");

CREATE UNIQUE INDEX "nutrient_source_foods_batch_id_source_food_code_key"
ON "nutrient_source_foods"("batch_id", "source_food_code");

CREATE INDEX "nutrient_source_foods_source_name_idx"
ON "nutrient_source_foods"("source_name");

CREATE UNIQUE INDEX "nutrient_foods_source_version_source_food_code_key"
ON "nutrient_foods"("source_version", "source_food_code");

CREATE INDEX "nutrient_foods_source_version_name_idx"
ON "nutrient_foods"("source_version", "name");

CREATE UNIQUE INDEX "ingredient_nutrient_mappings_ingredient_id_source_version_key"
ON "ingredient_nutrient_mappings"("ingredient_id", "source_version");

CREATE INDEX "ingredient_nutrient_mappings_source_version_status_idx"
ON "ingredient_nutrient_mappings"("source_version", "status");

CREATE UNIQUE INDEX "ingredient_unit_nutrient_conversions_ingredient_id_unit_id_source_key"
ON "ingredient_unit_nutrient_conversions"("ingredient_id", "unit_id", "source_version");

CREATE INDEX "ingredient_unit_nutrient_conversions_source_version_idx"
ON "ingredient_unit_nutrient_conversions"("source_version");

CREATE UNIQUE INDEX "recipe_nutrition_snapshots_recipe_version_id_source_version_key"
ON "recipe_nutrition_snapshots"("recipe_version_id", "source_version");

CREATE INDEX "recipe_nutrition_snapshots_source_version_status_idx"
ON "recipe_nutrition_snapshots"("source_version", "status");

ALTER TABLE "nutrient_source_foods"
ADD CONSTRAINT "nutrient_source_foods_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "nutrient_source_batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingredient_nutrient_mappings"
ADD CONSTRAINT "ingredient_nutrient_mappings_ingredient_id_fkey"
FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingredient_nutrient_mappings"
ADD CONSTRAINT "ingredient_nutrient_mappings_nutrient_food_id_fkey"
FOREIGN KEY ("nutrient_food_id") REFERENCES "nutrient_foods"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ingredient_unit_nutrient_conversions"
ADD CONSTRAINT "ingredient_unit_nutrient_conversions_ingredient_id_fkey"
FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingredient_unit_nutrient_conversions"
ADD CONSTRAINT "ingredient_unit_nutrient_conversions_unit_id_fkey"
FOREIGN KEY ("unit_id") REFERENCES "units"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_nutrition_snapshots"
ADD CONSTRAINT "recipe_nutrition_snapshots_recipe_version_id_fkey"
FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingredient_unit_nutrient_conversions"
ADD CONSTRAINT "ingredient_unit_nutrient_conversions_grams_per_unit_check"
CHECK ("grams_per_unit" > 0);

ALTER TABLE "recipe_nutrition_snapshots"
ADD CONSTRAINT "recipe_nutrition_snapshots_coverage_rate_check"
CHECK ("coverage_rate" IS NULL OR ("coverage_rate" >= 0 AND "coverage_rate" <= 1));
