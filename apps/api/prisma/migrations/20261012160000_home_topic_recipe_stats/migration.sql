BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "home_topic_recipe_stats_snapshots" (
  "id" SERIAL NOT NULL,
  "scope" VARCHAR(32) NOT NULL DEFAULT 'PUBLIC_INSPIRATION',
  "snapshot_id" UUID NOT NULL,
  "eligible_recipe_count" INTEGER NOT NULL,
  "stats_json" JSONB NOT NULL,
  "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_admin_id" INTEGER,
  CONSTRAINT "home_topic_recipe_stats_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "home_topic_recipe_stats_snapshots_scope_key" UNIQUE ("scope"),
  CONSTRAINT "home_topic_recipe_stats_snapshots_snapshot_id_key" UNIQUE ("snapshot_id"),
  CONSTRAINT "home_topic_recipe_stats_snapshots_eligible_recipe_count_check" CHECK ("eligible_recipe_count" >= 0),
  CONSTRAINT "home_topic_recipe_stats_snapshots_scope_check" CHECK ("scope" = 'PUBLIC_INSPIRATION')
);

ALTER TABLE "home_topic_recipe_stats_snapshots"
  ADD CONSTRAINT "home_topic_recipe_stats_snapshots_updated_by_admin_id_fkey"
  FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "recipes_search_text_trgm_idx"
  ON "recipes" USING GIN ("search_text" gin_trgm_ops);

CREATE INDEX "recipe_content_versions_search_text_trgm_idx"
  ON "recipe_content_versions" USING GIN ("search_text" gin_trgm_ops);

COMMIT;
