-- Inventory batches keep the remaining exact quantity after a full consumption.
-- Zero is a valid terminal quantity; the lifecycle flag and consumed_at remain
-- the source of truth for whether the batch is current or historical.
ALTER TABLE "fridge_items"
  DROP CONSTRAINT IF EXISTS "ck_fridge_items_exact_quantity_pair";

ALTER TABLE "fridge_items"
  ADD CONSTRAINT "ck_fridge_items_exact_quantity_pair"
  CHECK (
    ("exact_quantity" IS NULL AND "exact_unit_id" IS NULL)
    OR ("exact_quantity" IS NOT NULL AND "exact_unit_id" IS NOT NULL AND "exact_quantity" >= 0)
  );

CREATE INDEX "fridge_items_user_id_ingredient_id_available_expire_created_idx"
  ON "fridge_items"("user_id", "ingredient_id", "available", "expire_at", "created_at", "id");
