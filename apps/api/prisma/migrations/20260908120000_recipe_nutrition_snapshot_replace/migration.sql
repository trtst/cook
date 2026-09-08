-- A recipe version has one current nutrition result. Recalculation replaces
-- the row while source_version records which nutrient source produced it.
DELETE FROM "recipe_nutrition_snapshots" AS older
USING "recipe_nutrition_snapshots" AS newer
WHERE older."recipe_version_id" = newer."recipe_version_id"
  AND (
    older."calculated_at" < newer."calculated_at"
    OR (
      older."calculated_at" = newer."calculated_at"
      AND older."id" < newer."id"
    )
  );

DROP INDEX "recipe_nutrition_snapshots_recipe_version_id_source_version_key";

CREATE UNIQUE INDEX "recipe_nutrition_snapshots_recipe_version_id_key"
ON "recipe_nutrition_snapshots"("recipe_version_id");
