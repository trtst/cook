ALTER TABLE "recipes"
  ADD CONSTRAINT "ck_recipes_version" CHECK ("version" > 0),
  ADD CONSTRAINT "ck_recipes_report_count" CHECK ("report_count" >= 0),
  ADD CONSTRAINT "ck_recipes_lifecycle" CHECK (
    (
      "status" = 'ACTIVE'
      AND "blocked_reason" IS NULL
      AND "blocked_at" IS NULL
      AND "recycled_until" IS NULL
      AND "deleted_at" IS NULL
    )
    OR (
      "status" = 'RECYCLED'
      AND "blocked_reason" IS NULL
      AND "blocked_at" IS NULL
      AND "recycled_until" IS NOT NULL
      AND "deleted_at" IS NOT NULL
    )
    OR (
      "status" = 'BLOCKED'
      AND "blocked_reason" IS NOT NULL
      AND "blocked_at" IS NOT NULL
      AND "recycled_until" IS NULL
      AND "deleted_at" IS NULL
    )
    OR (
      "status" = 'DELETED'
      AND "blocked_reason" IS NULL
      AND "blocked_at" IS NULL
      AND "recycled_until" IS NULL
      AND "deleted_at" IS NOT NULL
    )
  );

ALTER TABLE "recipe_content_versions"
  ADD CONSTRAINT "ck_recipe_content_versions_size" CHECK ("content_size_bytes" >= 0),
  ADD CONSTRAINT "ck_recipe_content_versions_duration" CHECK (
    "duration_minutes" IS NULL OR "duration_minutes" >= 0
  );

CREATE UNIQUE INDEX "uq_recipe_reports_open"
  ON "recipe_reports"("recipe_id", "reporter_id")
  WHERE "status" = 'OPEN';

ALTER TABLE "meal_plan_items"
  ADD CONSTRAINT "ck_meal_plan_items_version" CHECK ("version" > 0);

ALTER TABLE "dining_events"
  ADD CONSTRAINT "ck_dining_events_version" CHECK ("version" > 0);

ALTER TABLE "dining_event_participants"
  ADD CONSTRAINT "ck_dining_event_participants_source" CHECK (
    (
      "source_type" = 'DINING_GROUP'
      AND "user_id" IS NOT NULL
      AND "guest_name" IS NULL
    )
    OR (
      "source_type" = 'SHARE'
      AND "guest_name" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "ck_dining_event_participants_bring" CHECK (
    ("bring_recipe_id" IS NULL) = ("bring_version_id" IS NULL)
  );

ALTER TABLE "fridge_items"
  ADD CONSTRAINT "ck_fridge_items_version" CHECK ("version" > 0),
  ADD CONSTRAINT "ck_fridge_items_availability" CHECK (
    ("available" AND "consumed_at" IS NULL)
    OR (NOT "available" AND "consumed_at" IS NOT NULL)
  );

ALTER TABLE "shopping_items"
  ADD CONSTRAINT "ck_shopping_items_version" CHECK ("version" > 0),
  ADD CONSTRAINT "ck_shopping_items_source" CHECK (
    ("source_type" = 'MANUAL' AND "source_key" IS NULL)
    OR ("source_type" <> 'MANUAL' AND "source_key" IS NOT NULL)
  );

ALTER TABLE "storage_ledger"
  ADD CONSTRAINT "ck_storage_ledger_used_bytes" CHECK ("used_bytes" >= 0);
