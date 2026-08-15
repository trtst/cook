ALTER TABLE "shopping_items"
  DROP CONSTRAINT IF EXISTS "ck_shopping_items_recipe_source";

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "ck_shopping_items_recipe_source" CHECK (
    (
      "source_type" IN ('RECIPE', 'PLAN')
      AND "source_recipe_id" IS NOT NULL
      AND "source_recipe_version_id" IS NOT NULL
      AND "source_recipe_title" IS NOT NULL
      AND "source_base_servings" IS NOT NULL
      AND "source_batch_key" IS NOT NULL
      AND "source_ingredient_sort" IS NOT NULL
      AND "ingredient_id" IS NOT NULL
      AND "amount_json" IS NOT NULL
    )
    OR (
      "source_type" = 'MANUAL'
      AND "source_recipe_id" IS NULL
      AND "source_recipe_version_id" IS NULL
      AND "source_recipe_title" IS NULL
      AND "source_base_servings" IS NULL
      AND "source_batch_key" IS NULL
      AND "source_ingredient_sort" IS NULL
      AND "amount_json" IS NULL
    )
    OR (
      "source_type" NOT IN ('RECIPE', 'PLAN', 'MANUAL')
      AND "source_recipe_id" IS NULL
      AND "source_recipe_version_id" IS NULL
      AND "source_recipe_title" IS NULL
      AND "source_base_servings" IS NULL
      AND "source_batch_key" IS NULL
      AND "source_ingredient_sort" IS NULL
      AND "ingredient_id" IS NULL
      AND "amount_json" IS NULL
    )
  );
