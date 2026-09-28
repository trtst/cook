CREATE TYPE "MealReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "meal_reminders" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "meal_plan_item_id" INTEGER,
  "dining_event_id" INTEGER,
  "status" "MealReminderStatus" NOT NULL DEFAULT 'PENDING',
  "accepted_at" TIMESTAMPTZ(3) NOT NULL,
  "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
  "sent_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "meal_reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meal_reminders_one_target_check" CHECK (("meal_plan_item_id" IS NULL) <> ("dining_event_id" IS NULL)),
  CONSTRAINT "meal_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meal_reminders_meal_plan_item_id_fkey" FOREIGN KEY ("meal_plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meal_reminders_dining_event_id_fkey" FOREIGN KEY ("dining_event_id") REFERENCES "dining_events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "meal_reminders_user_id_meal_plan_item_id_key" ON "meal_reminders"("user_id", "meal_plan_item_id");
CREATE UNIQUE INDEX "meal_reminders_user_id_dining_event_id_key" ON "meal_reminders"("user_id", "dining_event_id");
CREATE INDEX "meal_reminders_status_scheduled_at_idx" ON "meal_reminders"("status", "scheduled_at");
