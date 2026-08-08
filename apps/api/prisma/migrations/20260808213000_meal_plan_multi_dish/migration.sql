CREATE TABLE "meal_plan_dishes" (
    "id" SERIAL NOT NULL,
    "plan_item_id" INTEGER NOT NULL,
    "recipe_id" INTEGER,
    "recipe_version_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_plan_dishes_pkey" PRIMARY KEY ("id")
);

INSERT INTO "meal_plan_dishes" (
    "plan_item_id",
    "recipe_id",
    "recipe_version_id",
    "sort_order",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "recipe_id",
    "recipe_version_id",
    0,
    "created_at",
    "updated_at"
FROM "meal_plan_items";

CREATE INDEX "meal_plan_dishes_plan_item_id_sort_order_idx" ON "meal_plan_dishes"("plan_item_id", "sort_order");
CREATE INDEX "meal_plan_dishes_recipe_id_idx" ON "meal_plan_dishes"("recipe_id");
CREATE INDEX "meal_plan_dishes_recipe_version_id_idx" ON "meal_plan_dishes"("recipe_version_id");

ALTER TABLE "meal_plan_dishes" ADD CONSTRAINT "meal_plan_dishes_plan_item_id_fkey" FOREIGN KEY ("plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meal_plan_dishes" ADD CONSTRAINT "meal_plan_dishes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meal_plan_dishes" ADD CONSTRAINT "meal_plan_dishes_recipe_version_id_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meal_plan_items" DROP CONSTRAINT "meal_plan_items_recipe_id_fkey";
ALTER TABLE "meal_plan_items" DROP CONSTRAINT "meal_plan_items_recipe_version_id_fkey";
DROP INDEX IF EXISTS "meal_plan_items_recipe_id_idx";
DROP INDEX IF EXISTS "meal_plan_items_recipe_version_id_idx";
ALTER TABLE "meal_plan_items" DROP COLUMN "recipe_id",
DROP COLUMN "recipe_version_id";
