CREATE TABLE "user_notification_settings" (
  "user_id" INTEGER NOT NULL,
  "meal_enabled" BOOLEAN NOT NULL DEFAULT true,
  "meal_breakfast_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
  "meal_lunch_time" VARCHAR(5) NOT NULL DEFAULT '12:00',
  "meal_afternoon_tea_time" VARCHAR(5) NOT NULL DEFAULT '15:30',
  "meal_dinner_time" VARCHAR(5) NOT NULL DEFAULT '18:30',
  "meal_late_night_time" VARCHAR(5) NOT NULL DEFAULT '21:30',
  "fridge_enabled" BOOLEAN NOT NULL DEFAULT true,
  "fridge_days" INTEGER NOT NULL DEFAULT 3,
  "recommend_enabled" BOOLEAN NOT NULL DEFAULT false,
  "reminder_dot_only" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "user_notification_states" (
  "user_id" INTEGER NOT NULL,
  "feed_read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_notification_states_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "user_notification_settings"
ADD CONSTRAINT "user_notification_settings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notification_states"
ADD CONSTRAINT "user_notification_states_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notification_settings"
ADD CONSTRAINT "user_notification_settings_fridge_days_check"
CHECK ("fridge_days" IN (1, 2, 3, 5, 7));
