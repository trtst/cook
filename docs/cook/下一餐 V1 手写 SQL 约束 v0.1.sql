-- 下一餐 V1 手写 SQL 约束 v0.1
-- Prisma 5.22.0 无法完整表达 partial index / check constraint / immutability trigger。

CREATE UNIQUE INDEX IF NOT EXISTS uq_dish_concepts_global_name
ON dish_concepts (search_key)
WHERE scope = 'GLOBAL';

CREATE UNIQUE INDEX IF NOT EXISTS uq_dish_concepts_restaurant_name
ON dish_concepts (owner_restaurant_id, search_key)
WHERE scope = 'RESTAURANT' AND owner_restaurant_id IS NOT NULL;

ALTER TABLE dish_concepts
ADD CONSTRAINT ck_dish_concepts_scope_owner
CHECK (
  (scope = 'GLOBAL' AND owner_restaurant_id IS NULL)
  OR
  (scope = 'RESTAURANT' AND owner_restaurant_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_recipes_active_source
ON restaurant_recipes (restaurant_id, source_version_id)
WHERE status <> 'ARCHIVED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_plans_active_slot
ON meal_plans (restaurant_id, date, meal_type)
WHERE status <> 'CANCELLED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_shopping_lists_active
ON shopping_lists (restaurant_id)
WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION prevent_recipe_content_version_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD.ingredients IS DISTINCT FROM NEW.ingredients
    OR OLD.steps IS DISTINCT FROM NEW.steps
  THEN
    RAISE EXCEPTION 'recipe_content_versions are immutable: ingredients and steps cannot be changed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_recipe_content_version_mutation ON recipe_content_versions;

CREATE TRIGGER trg_prevent_recipe_content_version_mutation
BEFORE UPDATE ON recipe_content_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_recipe_content_version_mutation();

ALTER TABLE public_recipe_versions
ADD CONSTRAINT ck_public_recipe_versions_exposure_requires_safety
CHECK (
  exposure_level = 'NONE'
  OR safety_status = 'PASSED'
);

-- V1 临时约束：公共模块 Disabled，所有公共版本不得曝光。
-- V1.1 启用公共曝光前删除该约束。
ALTER TABLE public_recipe_versions
ADD CONSTRAINT ck_v1_public_recipe_versions_no_exposure
CHECK (exposure_level = 'NONE');

ALTER TABLE usage_quotas
ADD CONSTRAINT ck_usage_quotas_non_negative
CHECK (
  "limit" >= 0
  AND used >= 0
  AND frozen >= 0
  AND used + frozen <= "limit"
);

ALTER TABLE point_wallets
ADD CONSTRAINT ck_point_wallets_non_negative
CHECK (
  recharge_balance >= 0
  AND gift_balance >= 0
);

ALTER TABLE assets
ADD CONSTRAINT ck_assets_scope_owner
CHECK (
  (scope = 'RESTAURANT' AND owner_type = 'RESTAURANT')
  OR
  (scope = 'PERSONAL' AND owner_type = 'USER')
  OR
  (scope = 'SYSTEM' AND owner_type = 'SYSTEM')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_user_global_scope
ON idempotency_records (operation_id, operation_type, user_id)
WHERE restaurant_id IS NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_restaurant_scope
ON idempotency_records (operation_id, operation_type, user_id, restaurant_id)
WHERE restaurant_id IS NOT NULL AND user_id IS NOT NULL;
