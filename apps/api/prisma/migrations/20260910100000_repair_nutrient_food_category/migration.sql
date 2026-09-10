WITH latest_source_food AS (
  SELECT DISTINCT ON (batch."source_version", source_food."source_food_code")
    batch."source_version",
    source_food."source_food_code",
    source_food."raw_json"
  FROM "nutrient_source_batches" AS batch
  INNER JOIN "nutrient_source_foods" AS source_food
    ON source_food."batch_id" = batch."id"
  ORDER BY batch."source_version", source_food."source_food_code", batch."imported_at" DESC, batch."id" DESC
)
UPDATE "nutrient_foods" AS food
SET "category" = NULLIF(BTRIM(latest_source_food."raw_json" ->> 'category'), '')
FROM latest_source_food
WHERE food."source_version" = latest_source_food."source_version"
  AND food."source_food_code" = latest_source_food."source_food_code";
