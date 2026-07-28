-- AlterTable
ALTER TABLE "units"
ADD COLUMN "system_sort_order" INTEGER;

-- Backfill
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "type"
      ORDER BY "created_at" ASC, "id" ASC
    ) - 1 AS "sort_order"
  FROM "units"
  WHERE "owner_id" IS NULL
)
UPDATE "units" AS target
SET "system_sort_order" = ranked."sort_order"
FROM ranked
WHERE target."id" = ranked."id";

-- CreateIndex
CREATE UNIQUE INDEX "units_type_system_sort_order_key"
ON "units"("type", "system_sort_order")
WHERE "owner_id" IS NULL;

-- CreateIndex
CREATE INDEX "units_owner_id_type_system_sort_order_id_idx"
ON "units"("owner_id", "type", "system_sort_order", "id");
