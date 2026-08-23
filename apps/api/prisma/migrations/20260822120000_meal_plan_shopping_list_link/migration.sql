ALTER TABLE "meal_plan_items"
ADD COLUMN "shopping_list_id" INTEGER;

CREATE INDEX "meal_plan_items_shopping_list_id_idx"
ON "meal_plan_items"("shopping_list_id");

ALTER TABLE "meal_plan_items"
ADD CONSTRAINT "meal_plan_items_shopping_list_id_fkey"
FOREIGN KEY ("shopping_list_id") REFERENCES "shopping_lists"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
