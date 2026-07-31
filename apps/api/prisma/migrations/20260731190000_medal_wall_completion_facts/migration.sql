CREATE TYPE "MealPlanStatus" AS ENUM ('PLANNED', 'COMPLETED');

CREATE TYPE "MedalCode" AS ENUM (
    'FIRST_COMPLETED_MEAL',
    'FIRST_COMPLETED_DINING_EVENT',
    'FIRST_GROUP_MEAL',
    'FIRST_FULL_LOOP'
);

ALTER TYPE "DiningEventStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TABLE "meal_plan_items"
ADD COLUMN "status" "MealPlanStatus" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN "completed_at" TIMESTAMPTZ(3);

ALTER TABLE "dining_events"
ADD COLUMN "completed_at" TIMESTAMPTZ(3);

CREATE TABLE "user_medals" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" "MedalCode" NOT NULL,
    "awarded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_medals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_medals_user_id_code_key" ON "user_medals"("user_id", "code");
CREATE INDEX "user_medals_user_id_awarded_at_idx" ON "user_medals"("user_id", "awarded_at");

ALTER TABLE "user_medals"
ADD CONSTRAINT "user_medals_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
