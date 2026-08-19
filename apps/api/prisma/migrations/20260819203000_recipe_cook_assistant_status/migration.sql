CREATE TYPE "RecipeAssistantStatus" AS ENUM ('READY', 'FAILED');

ALTER TABLE "recipe_cook_assistants"
  ADD COLUMN "status" "RecipeAssistantStatus" NOT NULL DEFAULT 'READY',
  ALTER COLUMN "snapshot_json" DROP NOT NULL,
  ALTER COLUMN "generated_at" DROP NOT NULL,
  ALTER COLUMN "generated_at" SET DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "last_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "last_error" VARCHAR(500),
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "recipe_cook_assistants"
SET
  "status" = 'READY',
  "last_attempt_at" = COALESCE("generated_at", CURRENT_TIMESTAMP),
  "attempt_count" = 1,
  "updated_at" = COALESCE("generated_at", CURRENT_TIMESTAMP);
