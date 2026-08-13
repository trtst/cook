CREATE TABLE "meal_plan_cook_assistants" (
    "id" SERIAL NOT NULL,
    "plan_item_id" INTEGER NOT NULL,
    "menu_digest" VARCHAR(128) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meal_plan_cook_assistants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meal_plan_cook_assistants_plan_item_id_key" ON "meal_plan_cook_assistants"("plan_item_id");

ALTER TABLE "meal_plan_cook_assistants"
ADD CONSTRAINT "meal_plan_cook_assistants_plan_item_id_fkey"
FOREIGN KEY ("plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
