-- Old private-inspiration saves have no personal category. The user confirmed
-- that these records should be discarded instead of migrated or backfilled.
DELETE FROM "recipe_collections";

UPDATE "recipes"
SET "collect_count" = 0
WHERE "collect_count" <> 0;

ALTER TABLE "recipe_collections"
  ADD COLUMN "category_id" INTEGER NOT NULL;

CREATE UNIQUE INDEX "recipe_categories_id_user_id_key"
  ON "recipe_categories"("id", "user_id");

CREATE INDEX "recipe_collections_user_id_category_id_created_at_id_idx"
  ON "recipe_collections"("user_id", "category_id", "created_at", "id");

ALTER TABLE "recipe_collections"
  ADD CONSTRAINT "recipe_collections_category_id_user_id_fkey"
  FOREIGN KEY ("category_id", "user_id") REFERENCES "recipe_categories"("id", "user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
