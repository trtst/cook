ALTER TABLE "nutrient_foods"
ADD COLUMN "category" VARCHAR(128);

WITH latest_batch AS (
  SELECT DISTINCT ON (batch."source_version")
    batch."id",
    batch."source_version"
  FROM "nutrient_source_batches" AS batch
  ORDER BY batch."source_version", batch."imported_at" DESC, batch."id" DESC
)
UPDATE "nutrient_foods" AS food
SET "category" = NULLIF(BTRIM(source_food."raw_json" ->> 'category'), '')
FROM "nutrient_source_foods" AS source_food
INNER JOIN latest_batch AS batch
  ON batch."id" = source_food."batch_id"
WHERE food."source_version" = batch."source_version"
  AND food."source_food_code" = source_food."source_food_code";

DROP INDEX IF EXISTS "nutrient_foods_source_version_name_idx";
CREATE INDEX "nutrient_foods_source_version_category_name_id_idx"
ON "nutrient_foods"("source_version", "category", "name", "id");
