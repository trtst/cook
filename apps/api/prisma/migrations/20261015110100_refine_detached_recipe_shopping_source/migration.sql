-- 允许 RECIPE / PLAN 购物项在来源菜谱删除后保留固定版本和正文快照，source_recipe_id 可由外键置空。
-- MANUAL、EVENT 及其他来源类型继续沿用既有字段约束，避免放宽无关购物项。
-- 风险：历史购物项若不符合原有 MANUAL / EVENT 字段组合，验证约束会失败并保留旧约束。
-- 恢复：验证失败时先修复异常购物项再重试；如需回退且已有脱离菜谱的购物项，须先恢复其有效菜谱外键。
ALTER TABLE "shopping_items"
  ADD CONSTRAINT "ck_shopping_items_recipe_source_next" CHECK (
    (
      "source_type" IN ('RECIPE', 'PLAN')
      AND "source_recipe_version_id" IS NOT NULL
      AND "source_recipe_title" IS NOT NULL
      AND "source_base_servings" IS NOT NULL
      AND "source_batch_key" IS NOT NULL
      AND "source_ingredient_sort" IS NOT NULL
      AND "ingredient_id" IS NOT NULL
      AND "amount_json" IS NOT NULL
    )
    OR (
      "source_type" = 'MANUAL'
      AND "source_recipe_id" IS NULL
      AND "source_recipe_version_id" IS NULL
      AND "source_recipe_title" IS NULL
      AND "source_base_servings" IS NULL
      AND "source_batch_key" IS NULL
      AND "source_ingredient_sort" IS NULL
      AND "amount_json" IS NULL
    )
    OR (
      "source_type" = 'EVENT'
      AND "source_recipe_id" IS NULL
      AND "source_recipe_version_id" IS NULL
      AND "source_recipe_title" IS NULL
      AND "source_base_servings" IS NULL
      AND "source_batch_key" IS NULL
      AND "source_ingredient_sort" IS NULL
      AND (
        ("ingredient_id" IS NULL AND "amount_json" IS NULL)
        OR ("ingredient_id" IS NOT NULL AND "amount_json" IS NOT NULL)
      )
    )
    OR (
      "source_type" NOT IN ('RECIPE', 'PLAN', 'MANUAL', 'EVENT')
      AND "source_recipe_id" IS NULL
      AND "source_recipe_version_id" IS NULL
      AND "source_recipe_title" IS NULL
      AND "source_base_servings" IS NULL
      AND "source_batch_key" IS NULL
      AND "source_ingredient_sort" IS NULL
      AND "ingredient_id" IS NULL
      AND "amount_json" IS NULL
    )
  ) NOT VALID;

ALTER TABLE "shopping_items"
  VALIDATE CONSTRAINT "ck_shopping_items_recipe_source_next";

ALTER TABLE "shopping_items"
  DROP CONSTRAINT "ck_shopping_items_recipe_source";

ALTER TABLE "shopping_items"
  RENAME CONSTRAINT "ck_shopping_items_recipe_source_next"
  TO "ck_shopping_items_recipe_source";
