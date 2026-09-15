DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ingredients"
    WHERE "owner_id" IS NULL
      AND "status" = 'PENDING'
    GROUP BY "search_key"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate pending system ingredient search_key';
  END IF;
END $$;

ALTER TABLE "ingredients"
  ALTER COLUMN "default_unit_id" DROP NOT NULL;

ALTER TABLE "ingredients"
  ADD CONSTRAINT "ingredients_active_default_unit_check"
  CHECK ("status" <> 'ACTIVE' OR "default_unit_id" IS NOT NULL);

CREATE UNIQUE INDEX "ingredients_system_search_key_pending_key"
ON "ingredients"("search_key")
WHERE "owner_id" IS NULL
  AND "status" = 'PENDING';
