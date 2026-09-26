ALTER TABLE "meal_plan_items"
ADD COLUMN "cancelled_at" TIMESTAMPTZ(3);

ALTER TABLE "dining_events"
ADD COLUMN "ingredients_ready_at" TIMESTAMPTZ(3),
ADD COLUMN "cooking_started_at" TIMESTAMPTZ(3);

CREATE TABLE "dining_event_preparations" (
    "id" SERIAL NOT NULL,
    "dining_event_id" INTEGER NOT NULL,
    "source_key" VARCHAR(120) NOT NULL,
    "confirmed_by_user_id" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_event_preparations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dining_event_preparations_dining_event_id_source_key_key"
ON "dining_event_preparations"("dining_event_id", "source_key");

CREATE INDEX "dining_event_preparations_confirmed_by_user_id_confirmed_at_idx"
ON "dining_event_preparations"("confirmed_by_user_id", "confirmed_at");

ALTER TABLE "dining_event_preparations"
ADD CONSTRAINT "dining_event_preparations_dining_event_id_fkey"
FOREIGN KEY ("dining_event_id") REFERENCES "dining_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_event_preparations"
ADD CONSTRAINT "dining_event_preparations_confirmed_by_user_id_fkey"
FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "meal_plan_items_user_id_plan_date_meal_slot_key";

CREATE UNIQUE INDEX "meal_plan_items_active_slot_key"
ON "meal_plan_items"("user_id", "plan_date", "meal_slot")
WHERE "status" <> 'CANCELLED';

CREATE INDEX "meal_plan_items_user_id_plan_date_meal_slot_idx"
ON "meal_plan_items"("user_id", "plan_date", "meal_slot");
