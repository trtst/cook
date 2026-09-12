LOCK TABLE "recipes" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "users"
    WHERE "id" = 1001
      AND "status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'system recipe owner 1001 must be active before backfilling legacy system samples';
  END IF;
END $$;

-- These are the exact system samples created by prisma/seed.ts before the
-- seed began persisting owner_id. Do not broaden this list: other ownerless
-- rows require an explicit ownership decision and remain guarded below.
UPDATE "recipes"
SET "owner_id" = 1001
WHERE "owner_id" IS NULL
  AND "is_inspiration" = false
  AND "id" IN (10002101, 10002102, 10002103, 10002104, 10002105, 10002111, 10002112, 10002113, 10002114, 10002115);

CREATE TEMP TABLE "_legacy_ownerless_inspiration_recipes" ON COMMIT DROP AS
SELECT "id"
FROM "recipes"
WHERE "is_inspiration" = true
  AND "owner_id" IS NULL;

-- These two foreign keys intentionally restrict deletion. Their scoped rows
-- belong to the ownerless inspiration recipes the product has removed.
DELETE FROM "home_topic_items" AS "item"
USING "_legacy_ownerless_inspiration_recipes" AS "legacy"
WHERE "item"."recipe_id" = "legacy"."id";

DELETE FROM "recipe_collections" AS "collection"
USING "_legacy_ownerless_inspiration_recipes" AS "legacy"
WHERE "collection"."source_recipe_id" = "legacy"."id";

DELETE FROM "recipes" AS "recipe"
USING "_legacy_ownerless_inspiration_recipes" AS "legacy"
WHERE "recipe"."id" = "legacy"."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "recipes" WHERE "owner_id" IS NULL) THEN
    RAISE EXCEPTION 'recipes.owner_id still contains non-inspiration legacy rows; assign an owner explicitly before applying this migration';
  END IF;
END $$;

ALTER TABLE "recipe_inspiration_owners"
RENAME TO "public_content_user_pool_members";

ALTER TABLE "recipes"
DROP COLUMN "curated_by_name",
ADD COLUMN "owner_nickname_snapshot" VARCHAR(64),
ALTER COLUMN "owner_id" SET NOT NULL;

ALTER TABLE "recipe_recommendations"
DROP COLUMN "curated_by_name";
