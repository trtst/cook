-- Reclassify the system ingredient 干辣椒 from DRIED_PRESERVED to SEASONING.
-- Risk: this changes its category and increments its optimistic-lock version; existing recipe links remain intact.
-- Recovery: restore the previous category code DRIED_PRESERVED and increment version again if rollback is required.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ingredients"
    WHERE "owner_id" IS NULL
      AND "name" = '干辣椒'
      AND "search_key" = '干辣椒'
  ) AND NOT EXISTS (
    SELECT 1 FROM "ingredient_categories" WHERE "code" = 'SEASONING'
  ) THEN
    RAISE EXCEPTION 'Cannot reclassify system ingredient 干辣椒: SEASONING category is missing';
  END IF;
END $$;

UPDATE "ingredients" AS ingredient
SET "category_id" = target.id,
    "version" = ingredient."version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
FROM "ingredient_categories" AS target
WHERE target."code" = 'SEASONING'
  AND ingredient."owner_id" IS NULL
  AND ingredient."name" = '干辣椒'
  AND ingredient."search_key" = '干辣椒'
  AND ingredient."category_id" <> target.id;
