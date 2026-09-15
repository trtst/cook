ALTER TABLE "recipe_cook_assistants"
  ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "RecipeAssistantStatus_new" AS ENUM ('PENDING', 'GENERATING', 'NEEDS_REVIEW', 'READY', 'FAILED');

ALTER TABLE "recipe_cook_assistants"
  ALTER COLUMN "status" TYPE "RecipeAssistantStatus_new"
  USING "status"::text::"RecipeAssistantStatus_new";

DROP TYPE "RecipeAssistantStatus";

ALTER TYPE "RecipeAssistantStatus_new" RENAME TO "RecipeAssistantStatus";

ALTER TABLE "recipe_cook_assistants"
  ADD COLUMN "candidate_json" JSONB,
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ALTER COLUMN "generated_at" DROP DEFAULT;

UPDATE "recipe_cook_assistants"
SET
  "candidate_json" = "snapshot_json",
  "snapshot_json" = NULL,
  "generated_at" = NULL,
  "status" = 'NEEDS_REVIEW'
WHERE "snapshot_json" IS NOT NULL;

ALTER TABLE "recipe_cook_assistants"
  ADD CONSTRAINT "recipe_cook_assistants_ready_snapshot_chk"
  CHECK (
    (
      "status" = 'READY'
      AND "snapshot_json" IS NOT NULL
      AND "generated_at" IS NOT NULL
    )
    OR
    (
      "status" <> 'READY'
      AND "snapshot_json" IS NULL
    )
  );

CREATE TYPE "MealAssistantStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

ALTER TABLE "meal_plan_cook_assistants"
  ADD COLUMN "contract_version" VARCHAR(32) NOT NULL DEFAULT 'legacy.v1',
  ADD COLUMN "status" "MealAssistantStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "assistant_json" JSONB,
  ADD COLUMN "assistant_generated_at" TIMESTAMPTZ(3),
  ALTER COLUMN "menu_digest" DROP NOT NULL,
  ALTER COLUMN "snapshot" DROP NOT NULL,
  ALTER COLUMN "generated_at" DROP NOT NULL;

ALTER TABLE "meal_plan_cook_assistants"
  ADD CONSTRAINT "meal_plan_cook_assistants_ready_contract_chk"
  CHECK (
    "contract_version" <> 'cook-assistant.v1'
    OR (
      (
        "status" = 'READY'
        AND "assistant_json" IS NOT NULL
        AND "assistant_generated_at" IS NOT NULL
      )
      OR
      (
        "status" <> 'READY'
        AND "assistant_json" IS NULL
      )
    )
  );

CREATE TABLE "cook_assistant_unlocks" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "recipe_version_id" INTEGER,
  "plan_item_id" INTEGER,
  "unlocked_on" DATE NOT NULL,
  "unlocked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cook_assistant_unlocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cook_assistant_unlocks_target_xor_chk"
    CHECK (
      ("recipe_version_id" IS NOT NULL AND "plan_item_id" IS NULL)
      OR
      ("recipe_version_id" IS NULL AND "plan_item_id" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "cook_assistant_unlocks_user_recipe_version_id_key"
  ON "cook_assistant_unlocks"("user_id", "recipe_version_id");

CREATE UNIQUE INDEX "cook_assistant_unlocks_user_plan_item_id_key"
  ON "cook_assistant_unlocks"("user_id", "plan_item_id");

CREATE INDEX "cook_assistant_unlocks_user_unlocked_on_idx"
  ON "cook_assistant_unlocks"("user_id", "unlocked_on");

CREATE INDEX "cook_assistant_unlocks_recipe_version_id_idx"
  ON "cook_assistant_unlocks"("recipe_version_id");

CREATE INDEX "cook_assistant_unlocks_plan_item_id_idx"
  ON "cook_assistant_unlocks"("plan_item_id");

ALTER TABLE "cook_assistant_unlocks"
  ADD CONSTRAINT "cook_assistant_unlocks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cook_assistant_unlocks"
  ADD CONSTRAINT "cook_assistant_unlocks_recipe_version_id_fkey"
  FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cook_assistant_unlocks"
  ADD CONSTRAINT "cook_assistant_unlocks_plan_item_id_fkey"
  FOREIGN KEY ("plan_item_id") REFERENCES "meal_plan_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "idempotency_records_operation_id_operation_type_user_id_din_idx";

CREATE UNIQUE INDEX "idempotency_records_user_no_group_uq"
  ON "idempotency_records"("operation_id", "operation_type", "user_id")
  WHERE "user_id" IS NOT NULL AND "dining_group_id" IS NULL AND "admin_id" IS NULL;

CREATE UNIQUE INDEX "idempotency_records_user_group_uq"
  ON "idempotency_records"("operation_id", "operation_type", "user_id", "dining_group_id")
  WHERE "user_id" IS NOT NULL AND "dining_group_id" IS NOT NULL AND "admin_id" IS NULL;

CREATE UNIQUE INDEX "idempotency_records_admin_uq"
  ON "idempotency_records"("operation_id", "operation_type", "admin_id")
  WHERE "admin_id" IS NOT NULL AND "user_id" IS NULL AND "dining_group_id" IS NULL;
