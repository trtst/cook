# 下一餐 V1 手写 SQL 约束清单

Prisma Schema v0.1 覆盖基础表结构、普通索引和普通唯一约束。以下约束需要在 Prisma migration 中追加手写 SQL，原因是它们依赖 PostgreSQL partial index、check constraint 或触发器语义，Prisma 5.22.0 无法完整表达。

## 1. DishConcept 唯一约束

全局菜品概念按 `search_key` 唯一；餐厅私有菜品概念按 `(owner_restaurant_id, search_key)` 唯一。`search_key` 由应用层生成，用于菜名检索和去重，例如去首尾空格、统一大小写、统一简繁/别名映射后的稳定键。

```sql
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
```

## 2. RestaurantRecipe 唯一导入

同一餐厅对同一个 `source_version_id` 只能存在一个未归档入口。归档后允许再次导入。

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_recipes_active_source
ON restaurant_recipes (restaurant_id, source_version_id)
WHERE status <> 'ARCHIVED';
```

## 3. MealPlan 唯一餐次

同一餐厅、同一天、同一餐次只能有一个未取消计划。

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_plans_active_slot
ON meal_plans (restaurant_id, date, meal_type)
WHERE status <> 'CANCELLED';
```

## 4. ShoppingList 唯一 ACTIVE

每个餐厅同一时间只能有一份激活购物清单。

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_shopping_lists_active
ON shopping_lists (restaurant_id)
WHERE status = 'ACTIVE';
```

## 5. RecipeContentVersion 不可变约束

应用层必须禁止更新内容字段。数据库层只兜底最核心的结构化内容字段：`ingredients` 与 `steps`。其他描述字段由应用层在创建版本时写入，后续不提供更新入口。

```sql
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
```

允许更新的字段仅限治理字段，例如 `status`、`deprecated_at`、`deprecated_reason`。内容字段的完整不可变仍由应用层和权限入口共同保证。

## 6. PublicRecipeVersion 曝光状态约束

只有安全通过的版本才允许进入曝光池。V1 中所有公共版本应保持 `exposure_level = 'NONE'`。

```sql
ALTER TABLE public_recipe_versions
ADD CONSTRAINT ck_public_recipe_versions_exposure_requires_safety
CHECK (
  exposure_level = 'NONE'
  OR safety_status = 'PASSED'
);
```

V1 如需强制公共模块禁用，可额外加临时约束：

```sql
ALTER TABLE public_recipe_versions
ADD CONSTRAINT ck_v1_public_recipe_versions_no_exposure
CHECK (exposure_level = 'NONE');
```

该 V1 临时约束在 V1.1 启用公共曝光前删除。

## 7. UsageQuota 数值约束

额度不能出现负数，已用 + 冻结不能超过上限。

```sql
ALTER TABLE usage_quotas
ADD CONSTRAINT ck_usage_quotas_non_negative
CHECK (
  "limit" >= 0
  AND used >= 0
  AND frozen >= 0
  AND used + frozen <= "limit"
);
```

## 8. PointWallet 数值约束

饭票余额不能为负。V1 中 PointWallet 仅预留充值饭票与赠送饭票余额，不建冻结字段；V1.1 启用饭票消费时再设计冻结/预扣模型。

```sql
ALTER TABLE point_wallets
ADD CONSTRAINT ck_point_wallets_non_negative
CHECK (
  recharge_balance >= 0
  AND gift_balance >= 0
);
```

## 9. Asset 归属约束

资产归属统一使用 `owner_type + owner_id + scope`，不额外依赖 `restaurant_id`。餐厅资源必须属于餐厅，个人资源必须属于用户，系统资源必须属于系统。

```sql
ALTER TABLE assets
ADD CONSTRAINT ck_assets_scope_owner
CHECK (
  (scope = 'RESTAURANT' AND owner_type = 'RESTAURANT')
  OR
  (scope = 'PERSONAL' AND owner_type = 'USER')
  OR
  (scope = 'SYSTEM' AND owner_type = 'SYSTEM')
);
```

## 10. IdempotencyRecord 作用域约束

业务约定：`operation_id` 在 `operation_type + user_id + restaurant_id` 下唯一。Prisma 已建普通唯一约束，但 PostgreSQL 对 NULL 的唯一语义会允许多条 NULL。对不含餐厅的全局操作，需要补充 partial unique。

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_user_global_scope
ON idempotency_records (operation_id, operation_type, user_id)
WHERE restaurant_id IS NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_restaurant_scope
ON idempotency_records (operation_id, operation_type, user_id, restaurant_id)
WHERE restaurant_id IS NOT NULL AND user_id IS NOT NULL;
```

## 11. FridgeItem V1 语义说明

`fridge_items(restaurant_id, ingredient_id)` 唯一表示 V1 不做多批次库存。`expire_at` 仅表示该食材最近确认的预计过期时间，不表示每批库存的独立保质期。

如 V1.1 做批次库存，新增 `fridge_batches`，不要破坏 `fridge_items` 的汇总语义。
