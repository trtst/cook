-- AlterTable
ALTER TABLE "ingredients"
ADD COLUMN "display_sort_order" INTEGER;

-- Backfill
WITH ranked AS (
  SELECT
    ingredient."id",
    ROW_NUMBER() OVER (
      ORDER BY category."sort_order" ASC, ingredient."system_sort_order" ASC, ingredient."created_at" ASC, ingredient."id" ASC
    ) - 1 AS "sort_order"
  FROM "ingredients" AS ingredient
  INNER JOIN "ingredient_categories" AS category
    ON category."id" = ingredient."category_id"
  WHERE ingredient."owner_id" IS NULL
)
UPDATE "ingredients" AS target
SET "display_sort_order" = ranked."sort_order"
FROM ranked
WHERE target."id" = ranked."id";

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_system_display_sort_active_key"
ON "ingredients"("display_sort_order")
WHERE "owner_id" IS NULL
  AND "status" = 'ACTIVE'
  AND "display_sort_order" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ingredients_owner_id_status_display_sort_order_id_idx"
ON "ingredients"("owner_id", "status", "display_sort_order", "id");
