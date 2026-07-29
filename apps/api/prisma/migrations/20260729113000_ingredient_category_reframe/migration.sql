ALTER TABLE "ingredient_categories"
  ADD COLUMN "code" VARCHAR(32),
  ADD COLUMN "is_selectable" BOOLEAN NOT NULL DEFAULT true;

CREATE TEMP TABLE "_ingredient_category_target" (
  "seed_id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(20) NOT NULL,
  "is_selectable" BOOLEAN NOT NULL,
  "sort_order" INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO "_ingredient_category_target" ("seed_id", "code", "name", "is_selectable", "sort_order")
VALUES
  ('50000000-0000-4000-8000-000000000001', 'PRODUCE', '蔬果菌菇', true, 0),
  ('50000000-0000-4000-8000-000000000002', 'MEAT_POULTRY_EGG', '肉禽蛋', true, 1),
  ('50000000-0000-4000-8000-000000000003', 'SEAFOOD', '水产海鲜', true, 2),
  ('50000000-0000-4000-8000-000000000004', 'SOY_DAIRY', '豆乳制品', true, 3),
  ('50000000-0000-4000-8000-000000000005', 'GRAINS_STAPLES', '米面杂粮', true, 4),
  ('50000000-0000-4000-8000-000000000006', 'SEASONING', '调味料', true, 5),
  ('50000000-0000-4000-8000-000000000007', 'DRIED_PRESERVED', '干货腌制', true, 6),
  ('50000000-0000-4000-8000-000000000008', 'BEVERAGE_ALCOHOL', '酒水饮料', true, 7),
  ('50000000-0000-4000-8000-000000000009', 'UNCLASSIFIED', '待归类', false, 8);

UPDATE "ingredient_categories" AS ic
SET
  "code" = target."code",
  "name" = target."name",
  "icon_key" = NULL,
  "is_selectable" = target."is_selectable",
  "sort_order" = 1000 + target."sort_order"
FROM "_ingredient_category_target" AS target
WHERE ic."name" = target."name";

INSERT INTO "ingredient_categories" (
  "id",
  "code",
  "name",
  "icon_key",
  "is_selectable",
  "sort_order",
  "version",
  "created_at",
  "updated_at"
)
SELECT
  target."seed_id",
  target."code",
  target."name",
  NULL,
  target."is_selectable",
  1000 + target."sort_order",
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "_ingredient_category_target" AS target
WHERE NOT EXISTS (
  SELECT 1
  FROM "ingredient_categories" AS ic
  WHERE ic."name" = target."name"
);

CREATE TEMP TABLE "_ingredient_category_legacy_map" (
  "legacy_name" VARCHAR(20) NOT NULL,
  "target_code" VARCHAR(32) NOT NULL
) ON COMMIT DROP;

INSERT INTO "_ingredient_category_legacy_map" ("legacy_name", "target_code")
VALUES
  ('蔬菜', 'PRODUCE'),
  ('水果', 'PRODUCE'),
  ('蔬果菌菇', 'PRODUCE'),
  ('肉类', 'MEAT_POULTRY_EGG'),
  ('肉禽蛋', 'MEAT_POULTRY_EGG'),
  ('水产海鲜', 'SEAFOOD'),
  ('豆乳制品', 'SOY_DAIRY'),
  ('主食干货', 'GRAINS_STAPLES'),
  ('米面杂粮', 'GRAINS_STAPLES'),
  ('调味酱料', 'SEASONING'),
  ('调味料', 'SEASONING'),
  ('干货腌制', 'DRIED_PRESERVED'),
  ('酒水饮料', 'BEVERAGE_ALCOHOL'),
  ('冷冻食品', 'UNCLASSIFIED'),
  ('其他', 'UNCLASSIFIED'),
  ('待归类', 'UNCLASSIFIED');

UPDATE "ingredients" AS i
SET
  "category_id" = target."id",
  "system_sort_order" = NULL
FROM "ingredient_categories" AS legacy
JOIN "_ingredient_category_legacy_map" AS map
  ON legacy."name" = map."legacy_name"
JOIN "ingredient_categories" AS target
  ON target."code" = map."target_code"
WHERE i."category_id" = legacy."id"
  AND legacy."id" <> target."id";

UPDATE "ingredient_recommendations" AS ir
SET
  "category_id" = target."id",
  "category_name" = target."name"
FROM "_ingredient_category_legacy_map" AS map
JOIN "ingredient_categories" AS target
  ON target."code" = map."target_code"
WHERE ir."category_name" = map."legacy_name";

DELETE FROM "ingredient_categories"
WHERE "code" IS NULL;

UPDATE "ingredient_categories" AS ic
SET "sort_order" = target."sort_order"
FROM "_ingredient_category_target" AS target
WHERE ic."code" = target."code";

ALTER TABLE "ingredient_categories"
  ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "ingredient_categories_code_key" ON "ingredient_categories"("code");
