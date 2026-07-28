DROP INDEX IF EXISTS "ingredients_category_id_system_sort_order_key";

CREATE UNIQUE INDEX "ingredients_system_category_sort_active_key"
ON "ingredients"("category_id", "system_sort_order")
WHERE "owner_id" IS NULL
  AND "status" = 'ACTIVE'
  AND "system_sort_order" IS NOT NULL;

CREATE UNIQUE INDEX "ingredients_system_search_key_active_key"
ON "ingredients"("search_key")
WHERE "owner_id" IS NULL
  AND "status" IN ('ACTIVE', 'DISABLED');

CREATE UNIQUE INDEX "ingredients_owner_id_search_key_active_key"
ON "ingredients"("owner_id", "search_key")
WHERE "owner_id" IS NOT NULL
  AND "status" = 'ACTIVE';
