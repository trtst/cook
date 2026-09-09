CREATE TYPE "RecipeCompletenessStatus" AS ENUM ('PENDING', 'PARTIAL', 'READY', 'FAILED');

CREATE TABLE "recipe_completeness_snapshots" (
  "id" SERIAL NOT NULL,
  "recipe_version_id" INTEGER NOT NULL,
  "source_version" VARCHAR(64) NOT NULL,
  "content_status" "RecipeCompletenessStatus" NOT NULL,
  "content_score" INTEGER NOT NULL,
  "content_blocking_reasons" JSONB NOT NULL,
  "structured_data_status" "RecipeCompletenessStatus" NOT NULL,
  "structured_data_score" INTEGER NOT NULL,
  "structured_data_blocking_reasons" JSONB NOT NULL,
  "tag_status" "RecipeCompletenessStatus" NOT NULL,
  "tag_score" INTEGER NOT NULL,
  "tag_blocking_reasons" JSONB NOT NULL,
  "nutrition_status" "RecipeCompletenessStatus" NOT NULL,
  "nutrition_score" INTEGER NOT NULL,
  "nutrition_blocking_reasons" JSONB NOT NULL,
  "assistant_status" "RecipeCompletenessStatus" NOT NULL,
  "assistant_score" INTEGER NOT NULL,
  "assistant_blocking_reasons" JSONB NOT NULL,
  "frontend_status" "RecipeCompletenessStatus" NOT NULL,
  "frontend_score" INTEGER NOT NULL,
  "frontend_blocking_reasons" JSONB NOT NULL,
  "random_menu_status" "RecipeCompletenessStatus" NOT NULL,
  "random_menu_score" INTEGER NOT NULL,
  "random_menu_blocking_reasons" JSONB NOT NULL,
  "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recipe_completeness_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_completeness_snapshots_recipe_version_id_fkey"
    FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "recipe_completeness_snapshots_recipe_version_id_source_version_key"
  ON "recipe_completeness_snapshots"("recipe_version_id", "source_version");
CREATE INDEX "recipe_completeness_snapshots_source_version_content_status_idx"
  ON "recipe_completeness_snapshots"("source_version", "content_status");
CREATE INDEX "recipe_completeness_snapshots_recipe_version_id_calculated_at_idx"
  ON "recipe_completeness_snapshots"("recipe_version_id", "calculated_at");
