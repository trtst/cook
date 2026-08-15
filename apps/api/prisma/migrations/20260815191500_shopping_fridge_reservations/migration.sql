CREATE TABLE "shopping_item_fridge_reservations" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "shopping_list_id" INTEGER NOT NULL,
  "shopping_item_id" INTEGER NOT NULL,
  "fridge_item_id" INTEGER NOT NULL,
  "reserved_quantity" DECIMAL(12, 3) NOT NULL,
  "reserved_unit_id" INTEGER NOT NULL,
  "released_at" TIMESTAMPTZ(3),
  "settled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shopping_item_fridge_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shopping_item_fridge_reservations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shopping_item_fridge_reservations_shopping_list_id_fkey"
    FOREIGN KEY ("shopping_list_id") REFERENCES "shopping_lists"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shopping_item_fridge_reservations_shopping_item_id_fkey"
    FOREIGN KEY ("shopping_item_id") REFERENCES "shopping_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shopping_item_fridge_reservations_fridge_item_id_fkey"
    FOREIGN KEY ("fridge_item_id") REFERENCES "fridge_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shopping_item_fridge_reservations_reserved_unit_id_fkey"
    FOREIGN KEY ("reserved_unit_id") REFERENCES "units"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ck_shopping_item_fridge_reservations_reserved_quantity"
    CHECK ("reserved_quantity" > 0)
);

CREATE INDEX "shopping_fridge_resv_user_active_idx"
  ON "shopping_item_fridge_reservations"("user_id", "released_at", "settled_at", "created_at");

CREATE INDEX "shopping_fridge_resv_list_active_idx"
  ON "shopping_item_fridge_reservations"("shopping_list_id", "released_at", "settled_at", "created_at");

CREATE INDEX "shopping_fridge_resv_item_active_idx"
  ON "shopping_item_fridge_reservations"("shopping_item_id", "released_at", "settled_at", "created_at");

CREATE INDEX "shopping_fridge_resv_fridge_active_idx"
  ON "shopping_item_fridge_reservations"("fridge_item_id", "released_at", "settled_at", "created_at");

CREATE UNIQUE INDEX "shopping_item_fridge_reservations_active_item_fridge_uniq"
  ON "shopping_item_fridge_reservations"("shopping_item_id", "fridge_item_id")
  WHERE "released_at" IS NULL AND "settled_at" IS NULL;
