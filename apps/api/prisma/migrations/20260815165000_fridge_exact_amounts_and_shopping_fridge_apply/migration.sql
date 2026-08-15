ALTER TABLE "fridge_items"
  ADD COLUMN "exact_unit_id" INTEGER,
  ADD COLUMN "exact_quantity" DECIMAL(12, 3);

ALTER TABLE "shopping_items"
  ADD COLUMN "base_quantity_text" VARCHAR(64),
  ADD COLUMN "fridge_applied_quantity_text" VARCHAR(64),
  ADD COLUMN "fridge_covered" BOOLEAN NOT NULL DEFAULT false;

UPDATE "shopping_items"
SET "base_quantity_text" = "quantity_text"
WHERE "base_quantity_text" IS NULL;

ALTER TABLE "fridge_items"
  ADD CONSTRAINT "fridge_items_exact_unit_id_fkey"
  FOREIGN KEY ("exact_unit_id") REFERENCES "units"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fridge_items"
  ADD CONSTRAINT "ck_fridge_items_exact_quantity_pair"
  CHECK (
    ("exact_quantity" IS NULL AND "exact_unit_id" IS NULL)
    OR ("exact_quantity" IS NOT NULL AND "exact_unit_id" IS NOT NULL AND "exact_quantity" > 0)
  );

CREATE INDEX "fridge_items_user_id_ingredient_id_exact_unit_id_available_idx"
  ON "fridge_items"("user_id", "ingredient_id", "exact_unit_id", "available");
