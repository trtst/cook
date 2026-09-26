-- V1 直接切换到低维护食材痕迹模型。
-- 不迁移旧库存、批次或购物预占数据；精确库存若未来启用，必须从独立账本的启用时间点开始记录。
DROP TABLE IF EXISTS "shopping_item_fridge_reservations";
DROP TABLE IF EXISTS "fridge_items";

ALTER TABLE "shopping_items"
  DROP COLUMN IF EXISTS "base_quantity_text",
  DROP COLUMN IF EXISTS "fridge_applied_quantity_text",
  DROP COLUMN IF EXISTS "fridge_covered";

CREATE TYPE "FridgeTraceKind" AS ENUM ('PURCHASED', 'USED', 'MANUAL_PRESENT', 'MANUAL_EMPTY');

CREATE TABLE "fridge_traces" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "ingredient_id" INTEGER,
  "source_shopping_item_id" INTEGER,
  "source_meal_plan_item_id" INTEGER,
  "kind" "FridgeTraceKind" NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "category_name" VARCHAR(40),
  "category_code" VARCHAR(40),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fridge_traces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fridge_traces_source_shopping_item_id_kind_key"
  ON "fridge_traces"("source_shopping_item_id", "kind");
CREATE INDEX "fridge_traces_user_id_created_at_id_idx"
  ON "fridge_traces"("user_id", "created_at", "id");
CREATE INDEX "fridge_traces_user_id_ingredient_id_created_at_id_idx"
  ON "fridge_traces"("user_id", "ingredient_id", "created_at", "id");
CREATE INDEX "fridge_traces_user_id_kind_created_at_id_idx"
  ON "fridge_traces"("user_id", "kind", "created_at", "id");

ALTER TABLE "fridge_traces"
  ADD CONSTRAINT "fridge_traces_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "fridge_traces_ingredient_id_fkey"
    FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "fridge_traces_source_shopping_item_id_fkey"
    FOREIGN KEY ("source_shopping_item_id") REFERENCES "shopping_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "fridge_traces_source_meal_plan_item_id_fkey"
    FOREIGN KEY ("source_meal_plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
