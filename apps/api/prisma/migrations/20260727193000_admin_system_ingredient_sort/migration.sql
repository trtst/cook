-- AlterTable
ALTER TABLE "ingredient_categories"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ingredients"
ADD COLUMN "system_sort_order" INTEGER;

-- Backfill
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "category_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) - 1 AS "sort_order"
  FROM "ingredients"
  WHERE "owner_id" IS NULL
)
UPDATE "ingredients" AS target
SET "system_sort_order" = ranked."sort_order"
FROM ranked
WHERE target."id" = ranked."id";

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_category_id_system_sort_order_key"
ON "ingredients"("category_id", "system_sort_order");

-- CreateIndex
CREATE INDEX "ingredients_owner_id_category_id_system_sort_order_id_idx"
ON "ingredients"("owner_id", "category_id", "system_sort_order", "id");
