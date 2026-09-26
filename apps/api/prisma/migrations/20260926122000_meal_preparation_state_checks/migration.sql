ALTER TABLE "dining_events"
ADD CONSTRAINT "dining_events_cooking_started_requires_ingredients_ready_check"
CHECK ("cooking_started_at" IS NULL OR "ingredients_ready_at" IS NOT NULL);

ALTER TABLE "meal_plan_items"
ADD CONSTRAINT "meal_plan_items_cancelled_at_matches_status_check"
CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
