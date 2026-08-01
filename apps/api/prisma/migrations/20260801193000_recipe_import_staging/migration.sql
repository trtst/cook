CREATE TYPE "RecipeImportSourceType" AS ENUM ('MARKDOWN', 'EXCEL');

CREATE TYPE "RecipeImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED', 'COMPLETED');

CREATE TYPE "RecipeImportItemStatus" AS ENUM ('PENDING_PARSE', 'NEEDS_FIX', 'READY', 'PUBLISHING', 'PUBLISHED', 'FAILED');

ALTER TABLE "recipe_content_versions"
ADD COLUMN "estimated_calories" INTEGER;

CREATE TABLE "recipe_import_jobs" (
    "id" SERIAL NOT NULL,
    "source_type" "RecipeImportSourceType" NOT NULL,
    "source_name" VARCHAR(255) NOT NULL,
    "status" "RecipeImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "ready_count" INTEGER NOT NULL DEFAULT 0,
    "needs_fix_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_import_items" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "source_path" VARCHAR(512) NOT NULL,
    "title" VARCHAR(120),
    "status" "RecipeImportItemStatus" NOT NULL DEFAULT 'PENDING_PARSE',
    "raw_body_json" JSONB NOT NULL,
    "parsed_body_json" JSONB NOT NULL,
    "recipe_body_json" JSONB NOT NULL,
    "error_json" JSONB NOT NULL,
    "warn_json" JSONB NOT NULL,
    "recipe_id" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_import_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recipe_import_jobs_status_updated_at_idx"
ON "recipe_import_jobs"("status", "updated_at");

CREATE INDEX "recipe_import_jobs_created_by_admin_id_updated_at_idx"
ON "recipe_import_jobs"("created_by_admin_id", "updated_at");

CREATE INDEX "recipe_import_items_job_id_status_updated_at_idx"
ON "recipe_import_items"("job_id", "status", "updated_at");

CREATE INDEX "recipe_import_items_recipe_id_idx"
ON "recipe_import_items"("recipe_id");

ALTER TABLE "recipe_import_jobs"
ADD CONSTRAINT "recipe_import_jobs_created_by_admin_id_fkey"
FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_accounts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_import_items"
ADD CONSTRAINT "recipe_import_items_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "recipe_import_jobs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_import_items"
ADD CONSTRAINT "recipe_import_items_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
