ALTER TYPE "ShoppingSourceType" RENAME TO "ShoppingSourceType_old";

CREATE TYPE "ShoppingSourceType" AS ENUM (
  'MANUAL',
  'RECIPE',
  'PLAN',
  'EVENT',
  'BRING'
);

ALTER TABLE "shopping_items"
  ALTER COLUMN "source_type" TYPE "ShoppingSourceType"
  USING ("source_type"::text::"ShoppingSourceType");

DROP TYPE "ShoppingSourceType_old";

ALTER TABLE "shopping_items"
  ADD COLUMN "source_recipe_id" INTEGER,
  ADD COLUMN "source_recipe_version_id" INTEGER,
  ADD COLUMN "source_recipe_title" VARCHAR(120),
  ADD COLUMN "source_base_servings" INTEGER,
  ADD COLUMN "source_batch_key" VARCHAR(64),
  ADD COLUMN "source_ingredient_sort" INTEGER,
  ADD COLUMN "ingredient_id" INTEGER,
  ADD COLUMN "amount_json" JSONB;

CREATE INDEX "shopping_items_user_id_source_type_source_recipe_id_source_recipe_idx"
ON "shopping_items"("user_id", "source_type", "source_recipe_id", "source_recipe_version_id", "ingredient_id");

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "shopping_items_source_recipe_id_fkey"
  FOREIGN KEY ("source_recipe_id") REFERENCES "recipes"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "shopping_items_source_recipe_version_id_fkey"
  FOREIGN KEY ("source_recipe_version_id") REFERENCES "recipe_content_versions"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "shopping_items_ingredient_id_fkey"
  FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "ck_shopping_items_recipe_source" CHECK (
    (
      "source_type" = 'RECIPE'
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
      "source_type" <> 'RECIPE'
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
