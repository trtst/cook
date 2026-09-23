CREATE TYPE "CookAssistantUnlockStatus" AS ENUM ('RESERVED', 'CONSUMED');

CREATE TYPE "RecipeWikiRequestStatus" AS ENUM ('PENDING', 'READY', 'REJECTED');

ALTER TABLE "cook_assistant_unlocks"
  ADD COLUMN "status" "CookAssistantUnlockStatus" NOT NULL DEFAULT 'CONSUMED';

CREATE TABLE "recipe_cook_assistant_requests" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "recipe_version_id" INTEGER NOT NULL,
  "status" "RecipeWikiRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  "rejection_reason" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_cook_assistant_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_cook_assistant_requests_user_id_recipe_version_id_key"
  ON "recipe_cook_assistant_requests"("user_id", "recipe_version_id");
CREATE INDEX "recipe_cook_assistant_requests_recipe_version_id_status_requested_at_idx"
  ON "recipe_cook_assistant_requests"("recipe_version_id", "status", "requested_at");
CREATE INDEX "recipe_cook_assistant_requests_user_id_status_requested_at_idx"
  ON "recipe_cook_assistant_requests"("user_id", "status", "requested_at");

ALTER TABLE "recipe_cook_assistant_requests"
  ADD CONSTRAINT "recipe_cook_assistant_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "recipe_cook_assistant_requests_recipe_version_id_fkey"
  FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
