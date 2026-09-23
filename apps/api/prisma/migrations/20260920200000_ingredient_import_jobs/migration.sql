CREATE TYPE "IngredientImportJobStatus" AS ENUM ('RUNNING', 'READY', 'FAILED', 'COMPLETED');

CREATE TYPE "IngredientImportItemStatus" AS ENUM ('NEEDS_FIX', 'READY', 'IMPORTED', 'FAILED');

CREATE TABLE "ingredient_import_jobs" (
  "id" SERIAL NOT NULL,
  "source_name" VARCHAR(255) NOT NULL,
  "status" "IngredientImportJobStatus" NOT NULL DEFAULT 'RUNNING',
  "total_count" INTEGER NOT NULL DEFAULT 0,
  "ready_count" INTEGER NOT NULL DEFAULT 0,
  "needs_fix_count" INTEGER NOT NULL DEFAULT 0,
  "imported_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "created_by_admin_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingredient_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ingredient_import_items" (
  "id" SERIAL NOT NULL,
  "job_id" INTEGER NOT NULL,
  "source_path" VARCHAR(512) NOT NULL,
  "title" VARCHAR(64) NOT NULL,
  "status" "IngredientImportItemStatus" NOT NULL DEFAULT 'NEEDS_FIX',
  "raw_body_json" JSONB NOT NULL,
  "ingredient_body_json" JSONB NOT NULL,
  "error_json" JSONB NOT NULL,
  "warn_json" JSONB NOT NULL,
  "ingredient_id" INTEGER,
  "match_type" VARCHAR(32),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingredient_import_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingredient_import_jobs_status_updated_at_idx" ON "ingredient_import_jobs"("status", "updated_at");
CREATE INDEX "ingredient_import_jobs_created_by_admin_id_updated_at_idx" ON "ingredient_import_jobs"("created_by_admin_id", "updated_at");
CREATE INDEX "ingredient_import_items_job_id_status_updated_at_idx" ON "ingredient_import_items"("job_id", "status", "updated_at");
CREATE INDEX "ingredient_import_items_ingredient_id_idx" ON "ingredient_import_items"("ingredient_id");

ALTER TABLE "ingredient_import_jobs"
  ADD CONSTRAINT "ingredient_import_jobs_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingredient_import_items"
  ADD CONSTRAINT "ingredient_import_items_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "ingredient_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ingredient_import_items_ingredient_id_fkey"
  FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
