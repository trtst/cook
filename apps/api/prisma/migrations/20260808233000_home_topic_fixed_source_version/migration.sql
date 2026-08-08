ALTER TABLE "home_topic_items"
ADD COLUMN "source_version_id" INTEGER;

UPDATE "home_topic_items" AS "item"
SET "source_version_id" = "recipe"."current_version_id"
FROM "recipes" AS "recipe"
WHERE "recipe"."id" = "item"."recipe_id"
  AND "item"."source_version_id" IS NULL;

ALTER TABLE "home_topic_items"
ALTER COLUMN "source_version_id" SET NOT NULL;

CREATE INDEX "home_topic_items_source_version_id_idx"
ON "home_topic_items"("source_version_id");

ALTER TABLE "home_topic_items"
ADD CONSTRAINT "home_topic_items_source_version_id_fkey"
FOREIGN KEY ("source_version_id") REFERENCES "recipe_content_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
