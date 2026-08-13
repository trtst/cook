# 随机页 Prisma / DTO / OpenAPI 改造评审稿

## 一、文档状态

本文是随机页从“文档评审”进入“代码改造前评审”的最后一层设计稿。

目标不是直接改代码，而是把以下 4 件事冻结到可实施程度：

1. Prisma 需要新增哪些枚举和字段。
2. DTO / OpenAPI / 共享类型要改哪些点。
3. 这些改动分别归哪个真实模块 owner。
4. 如何前向迁移，避免长期双契约和过度封装。

本文和以下文档配套：

- [random-page-execution.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-execution.md)
- [random-page-api-dto-draft.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-api-dto-draft.md)
- [random-page-data-review.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-data-review.md)
- [random-page-frontend-state.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-frontend-state.md)

## 二、现有代码事实

当前已确认的真实结构：

1. `RecipeContentVersion` 已有：
   `baseServings / duration / estimatedCalories / ingredientsJson`
2. `MealPlanDish` 目前只有：
   `recipeId / recipeVersionId / sortOrder`
3. `CreateMealPlanDto` 目前仍是：
   `planDate + mealSlot + recipeIds[] + note`
4. `MealPlanMenuItemModel / MealPlanMenuItemSummary` 目前不含：
   `slotType / purchaseState`
5. `ShoppingSourceType` 目前到 `EVENT` 结束，没有 `RANDOM_MENU`

因此随机页目前无法在正式契约层表达：

- 菜谱版本的随机推荐标签
- 菜位类型
- “保留但暂不采购”的计划状态
- 随机页写入购物的明确来源语义

## 三、Prisma 改造建议

### 3.1 复用现有枚举

以下枚举直接复用，不新增同义枚举：

- `MealSlot`
- `RecipeDuration`

原因：

- 语义已稳定
- 当前 DTO / OpenAPI / client 类型已统一
- 没有必要为随机页再造 `RandomMealMoment` 这类重复概念

### 3.2 建议新增的枚举

建议新增 3 个枚举：

```prisma
enum RecipeSlotType {
  MEAT
  VEGETABLE
  SOUP
  STAPLE
  BREAKFAST_STAPLE
  BREAKFAST_PROTEIN
  BREAKFAST_SIDE
}

enum RecipeProteinType {
  PORK
  CHICKEN
  BEEF
  LAMB
  DUCK
  FISH
  NONE
}

enum MealPlanDishPurchaseState {
  READY
  PENDING
}
```

不建议新增：

- `RandomMenuStatus`
- `RandomMenuType`
- `RandomMealMoment`
- `RandomDishState`

这些都是页面流程或现有枚举的重复，不属于数据库主事实。

### 3.3 `ShoppingSourceType` 扩展

建议把现有：

```prisma
enum ShoppingSourceType {
  MANUAL
  RECIPE
  PLAN
  EVENT
  BRING
}
```

升级为：

```prisma
enum ShoppingSourceType {
  MANUAL
  RECIPE
  PLAN
  EVENT
  BRING
  RANDOM_MENU
}
```

原因：

- 随机页写入购物不属于 `PLAN / EVENT`
- 如果继续伪装成现有来源，后续来源追踪会失真

### 3.4 `RecipeContentVersion` 字段改造

建议新增独立标签表：

```prisma
model RecipeVersionTag {
  recipeVersionId Int
  tagCode         RecipeVersionTagCode
  tagValue        String
  source          RecipeVersionTagSource
  confidence      Decimal?
  sortOrder       Int?
  isLocked        Boolean
}
```

#### 字段说明

`recipeVersionId`

- owner：内容版本
- 事实类型：结构化推荐标签
- 用途：与固定内容版本一起冻结

`tagCode`

- owner：内容版本
- 事实类型：结构化推荐标签
- 用途：区分 `DISH_ROLE / MEAL_TYPE / MAIN_PROTEIN_TYPE / PRIMARY_INGREDIENT / FLAVOR_PROFILE / SPICE_LEVEL`

`tagValue`

- owner：内容版本
- 事实类型：结构化推荐标签
- 用途：存具体标签值

`source / confidence / sortOrder / isLocked`

- owner：内容版本
- 事实类型：结构化推荐标签
- 用途：表达自动建议、用户修正、运营录入和未来 AI 来源的优先级与锁定语义

#### 明确不新增 `fridgeFit`

不建议在 `RecipeContentVersion` 上新增持久化 `fridgeFit` 字段。

原因：

1. `fridgeFit` 是当前用户冰箱上下文相关结果，不是菜谱固有事实
2. 同一道菜对不同用户的冰箱匹配度不同
3. 当前 `ingredientsJson` 已足够作为运行时计算依据

正确做法：

- 随机接口请求时加载当前用户可用冰箱食材
- 基于 `ingredientsJson` 和当前冰箱事实计算本次 `fridgeFit`
- 该结果只出现在响应 DTO，不回写数据库

### 3.5 `MealPlanDish` 字段改造

建议新增：

```prisma
slotType      RecipeSlotType?         @map("slot_type")
purchaseState MealPlanDishPurchaseState @default(READY) @map("purchase_state")
```

#### 为什么 `slotType` 首批建议可空

因为当前库里已有历史计划项，没有槽位信息。

更稳的前向顺序是：

1. 先加可空 `slotType`
2. 随新随机页和新计划写入开始填充
3. 后续确认旧数据回填策略后，再评估是否改成非空

#### 为什么 `purchaseState` 可以直接非空默认

旧数据统一回填 `READY` 是安全的：

- 旧计划并没有“保留但暂不采购”的语义
- 默认 `READY` 不会误导为缺口未处理

### 3.6 `ShoppingItem` 字段

`ShoppingItem` 本轮不新增新字段。

只扩展：

- `sourceType = RANDOM_MENU`

原因：

- 现有 `sourceKey / sourceRecipeId / sourceRecipeVersionId / ingredientId / amountJson` 已足够承接随机页购物写入
- 当前缺的只是来源分类，不是承载能力

## 四、DTO 改造建议

### 4.1 `CreateMealPlanDto`

建议从：

```ts
planDate
mealSlot
recipeIds: number[]
note?
```

升级为：

```ts
planDate
mealSlot
expectedVersion?
menuItems: CreateMealPlanMenuItemDto[]
note?
```

建议新增 DTO：

```ts
class CreateMealPlanMenuItemDto {
  slotType!: "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE";
  sortOrder!: number;
  recipeId!: number;
  recipeVersionId!: number;
  purchaseState!: "READY" | "PENDING";
}
```

并把 `CreateMealPlanDto` 上的 `recipeIds` 删除，而不是长期并存。

### 4.2 新增随机页请求 DTO

建议在 `apps/api/src/contracts/dtos.ts` 新增：

- `RandomSlotPlanDto`
- `GenerateRandomMenuDto`
- `ReplaceRandomMenuSlotDto`
- `ReplaceRandomMenuConstraintDto`
- `RandomMenuGapInventoryDecisionDto`
- `PreviewRandomMenuGapDto`
- `CreateRandomMenuShoppingItemsDto`
- `CreateRandomMenuShoppingItemDto`
- `CreateRandomMenuShoppingIngredientDto`

这些 DTO 都应直接服务随机页接口，不要抽成：

- `MenuDecisionContextDto`
- `RandomEnginePayloadDto`
- `RandomMenuAdapterDto`

原因：

- 这些名字没有真实 owner
- 只会把一个局部功能包装成通用框架

### 4.3 `Shopping` DTO

客户端已确认随机页写购物需要：

- `slotId`
- `recipeId`
- `recipeVersionId`
- `ingredients[]`

这部分建议走独立 DTO，不复用旧 `from-recipe` 请求。

原因：

- 旧 `from-recipe` 语义是整道菜直接写购物
- 随机页是“只写用户确认采购的缺口食材”

## 五、OpenAPI 与共享类型改造建议

### 5.1 `MealPlanMenuItemModel`

建议新增：

- `slotType`
- `purchaseState`

### 5.2 `MealPlanMenuItemSummary`

建议新增：

- `slotType`
- `purchaseState`

### 5.3 `CreateMealPlanRequest`

`apps/api/src/contracts/types.ts` 和 `apps/client/src/pages_meal/apis/meal.ts` 中的 `CreateMealPlanRequest` 都应同步改为 `menuItems[]` 结构。

### 5.4 `ShoppingItemSummary`

`sourceType` 扩展 `RANDOM_MENU`。

注意：

如果共享类型已经把 `ShoppingItemSummary.status` 收口到新购物域语义，需要同时核对旧代码引用，不允许随机页把旧 `OPEN / BOUGHT / DELETED` 和新 `OPEN / CHECKED / REMOVED` 混着写成一个不自洽状态。

### 5.5 新增随机页响应模型

建议 OpenAPI / types 同步新增：

- `RandomMenuWarningModel`
- `RandomMenuItemModel`
- `RandomMenuModel`
- `RandomMenuGapIngredientModel`
- `RandomMenuGapItemModel`
- `RandomMenuGapPreviewModel`

这些名字都按“资源结果”命名，不加 `manager / context / center`。

## 六、模块 owner 与文件落点

### 6.1 Prisma

- `apps/api/prisma/schema.prisma`

### 6.2 DTO / OpenAPI / Types

- `apps/api/src/contracts/dtos.ts`
- `apps/api/src/contracts/openapi.ts`
- `apps/api/src/contracts/types.ts`

### 6.3 后端模块 owner

建议随机页接口仍归 `Meal` 模块。

原因：

1. 它最终落向计划和餐次决策
2. 不值得为一个无持久化 owner 的入口新建顶层模块
3. 已有 `meal` 模块最接近该业务语义

建议实现形式：

- `meal.controller.ts` 增加随机页接口入口
- 复杂选择逻辑如代码量过大，可在 `modules/meal/` 内新增局部 `random-menu.service.ts`

不建议：

- 新建顶层 `random` 模块
- 新建 `random-engine` 公共层
- 新建跨 meal/pantry/recipe 的 `decision-center`

## 七、前向迁移顺序

建议顺序固定为：

1. Prisma 新增枚举和字段
2. 新 migration 允许：
   - `RecipeContentVersion` 新字段先给安全默认值
   - `MealPlanDish.slotType` 先可空
   - `MealPlanDish.purchaseState` 默认 `READY`
   - `ShoppingSourceType` 补 `RANDOM_MENU`
3. `prisma generate`
4. 更新 DTO / OpenAPI / 共享类型
5. 再改 `meal` / `shopping` 模块实现
6. 同一批次内切随机页和计划页客户端
7. 最后再评估是否收紧 `slotType` 非空

### 7.1 不允许的过渡方式

- 长期保留 `recipeIds[]` 和 `menuItems[]` 两套公开计划写接口
- 用运行时 fallback 猜 `slotType`
- 用菜名猜 `mainProteinType`
- 用额外 adapter 层长期把旧模型翻译成新模型

### 7.2 允许的短过渡方式

只允许一类短过渡：

- 在单个开发批次内，后端内部暂时把旧计划调用转成新 `menuItems[]`

但这个过渡只服务同批迁移，不应成为长期公开兼容层。

## 八、性能与安全补充

### 8.1 Prisma 查询边界

随机页接口不要一次把完整正文、步骤图、长故事、全部图片拉出来。

随机生成和替换的候选查询只需要：

- `Recipe.id`
- `Recipe.currentVersionId`
- `RecipeContentVersion.name`
- `baseServings`
- `duration`
- `estimatedCalories`
- `ingredientsJson`
- 新标签字段

### 8.2 冰箱匹配计算

冰箱匹配只能按当前用户可用 `FridgeItem` 计算。

不得：

- 读取他人冰箱
- 预聚合成跨用户共享缓存
- 把冰箱匹配结果反写到 `RecipeContentVersion`

### 8.3 Migration 安全

所有新增字段都必须走前向 migration。

新增非空字段时：

- 先给默认值或允许空
- 再逐步收紧

不能直接在历史表上加无默认非空字段。

## 九、改造结论

随机页进入代码实现前，Schema / DTO / OpenAPI 最小改造建议冻结为：

1. `RecipeContentVersion`
   新增 `mealMoments / slotTypes / flavorTags / mainProteinType`
2. `MealPlanDish`
   新增 `slotType / purchaseState`
3. `ShoppingSourceType`
   新增 `RANDOM_MENU`
4. `CreateMealPlanDto`
   从 `recipeIds[]` 升级到 `menuItems[]`
5. `MealPlanMenuItemModel / Summary`
   新增 `slotType / purchaseState`
6. 随机页接口 owner 继续放在 `Meal` 模块，不新建顶层 `random` 域

如果这份评审稿没有异议，下一步就应该进入真正的 Prisma / DTO / OpenAPI 代码改造，而不是再继续补说明文档。
