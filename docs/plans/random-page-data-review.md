# 随机页最小数据表与字段约束评审稿

## 一、文档状态

本文是随机页进入后端实现前的**最小数据表 / 字段约束评审稿**。

它只回答 4 类问题：

1. 随机页要依赖哪些现有主事实。
2. 哪些字段必须新增到真实 owner。
3. 哪些结果不应落库，只能按主事实重算。
4. 迁移和过渡应如何收口，避免长期双模型。

本文不直接修改 Prisma、SQL、OpenAPI 或实现代码。

## 二、当前真实 owner

随机页本身不是数据 owner。

它当前涉及的真实主事实只有 3 类：

1. `RecipeContentVersion`
   用于提供可随机、可替换、可缺口预检的菜谱内容和标签事实
2. `MealPlanItem / MealPlanDish`
   用于承接最终确认后的菜单计划
3. `ShoppingItem`
   用于承接用户确认采购的缺口食材

当前不应把随机页扩展成新的持久化域，因此本评审先明确：

- 不新增 `RandomMenu` 主表
- 不新增 `RandomMenuDraft` 主表
- 不新增 `RandomHistory` 主表
- 不新增 `RandomCandidateCache` 主表

## 三、现有结构能复用什么

### 3.1 `RecipeContentVersion`

当前已有：

- `name`
- `baseServings`
- `duration`
- `estimatedCalories`
- `ingredientsJson`
- `stepsJson`
- `imagesJson`
- `searchText`

这些已经足够支撑：

- 菜名展示
- 人份展示
- 时长筛选
- 缺口预检里的食材计算
- 轻量热量展示

当前还不够支撑：

- 按餐次过滤
- 按菜位类型过滤
- 按口味筛选
- 按主肉类型做多样化约束
- 按“是否适合优先用冰箱”做排序

### 3.2 `MealPlanItem / MealPlanDish`

当前已有：

- `MealPlanItem.userId + planDate + mealSlot` 唯一约束
- `MealPlanItem.menuSnapshot`
- `MealPlanDish.recipeId`
- `MealPlanDish.recipeVersionId`
- `MealPlanDish.sortOrder`

这些已经足够支撑：

- 同一餐次只有一条计划
- 一餐多菜
- 固定版本引用
- 菜单顺序

当前还不够支撑：

- 菜位类型
- “保留但暂不采购”这种计划内状态

### 3.3 `ShoppingItem`

当前已有：

- `sourceType`
- `sourceKey`
- `sourceRecipeId`
- `sourceRecipeVersionId`
- `sourceRecipeTitle`
- `ingredientId`
- `amountJson`

这些已经足够支撑：

- 写入食材采购项
- 保留来源菜谱与版本
- 后续按来源回溯

当前还不够支撑的不是字段，而是来源语义：

- 现有 `sourceType` 没有 `RANDOM_MENU`

## 四、建议新增字段与枚举

### 4.1 新增 `RecipeVersionTag`

首版随机页真正需要的最小标签，改为挂在独立的 `RecipeVersionTag` 表，而不是继续塞回 `RecipeContentVersion` 主字段。

原因：

1. 随机推荐和最终计划都依赖固定内容版本，标签仍然必须按版本冻结。
2. 同一道菜不同版本，时长、口味、主肉类型确实可能不同。
3. 独立标签表才能记录 `AUTO / USER / OPS / AI` 来源、排序、置信度和后续用户修正覆盖。
4. 这样才能兼容后续 AI 参与，但当前不必提前引入 AI 服务。

建议主键字段：

```text
recipeVersionId
tagCode
tagValue
source
confidence
sortOrder
isLocked
```

建议取值：

`tagCode = MEAL_TYPE`

- `BREAKFAST`
- `LUNCH`
- `DINNER`

`tagCode = DISH_ROLE`

- `MAIN`
- `VEGETABLE`
- `SOUP`
- `STAPLE`

`tagCode = MAIN_PROTEIN_TYPE`

- `PORK`
- `CHICKEN`
- `BEEF`
- `LAMB`
- `DUCK`
- `FISH`
- `NONE`

`tagCode = SPICE_LEVEL`

- `NONE`
- `MILD`
- `MEDIUM`
- `HOT`

`tagCode = PRIMARY_INGREDIENT`

- `ingredientId` 字符串化存储

`tagCode = FLAVOR_PROFILE`

- 首版受控值至少包含 `NOT_SPICY / MILD / LIGHT`

#### 为什么 `flavorTags` 不用数据库枚举

`FLAVOR_PROFILE` 目前确认的只是首版常用筛选：

- `NOT_SPICY`
- `MILD`
- `LIGHT`

但后续很可能扩展，且本质更像多选标签而不是稳定互斥状态。

因此建议：

- `MEAL_TYPE / DISH_ROLE / MAIN_PROTEIN_TYPE / SPICE_LEVEL` 用稳定枚举值域
- `FLAVOR_PROFILE` 仍存多条标签记录，不单独做数据库枚举

### 4.2 `MealPlanDish` 新增结构字段

随机页进入计划后，计划项不再只是“某餐若干 recipeIds”。

建议为 `MealPlanDish` 新增：

```text
slotType
purchaseState
```

建议取值：

`slotType`

- `MEAT`
- `VEGETABLE`
- `SOUP`
- `STAPLE`
- `BREAKFAST_STAPLE`
- `BREAKFAST_PROTEIN`
- `BREAKFAST_SIDE`

`purchaseState`

- `READY`
- `PENDING`

语义：

- `READY`：该菜位已具备执行条件，或缺口已明确处理
- `PENDING`：该菜位被用户保留进计划，但缺口未采购

#### 为什么不把 `purchaseState` 放进 `menuSnapshot`

因为这是会被计划页继续读取、筛选、改动和展示的业务事实，不是一次性展示文案。

它应该成为 `MealPlanDish` 的真实字段，而不是藏在 JSON 里。

### 4.3 `ShoppingItem.sourceType`

建议补一个来源值：

- `RANDOM_MENU`

原因：

1. 当前随机页写入购物项并不来自已有 `PLAN / EVENT`
2. 如果继续伪装成 `PLAN`，后续来源回溯会混乱
3. `RANDOM_MENU` 不等于新增新主事实，只是购物来源语义补充

## 五、明确不新增的字段与表

### 5.1 不新增随机运行态表

这些都不应新增：

- `random_menu_sessions`
- `random_menu_candidates`
- `random_menu_histories`
- `random_menu_gap_checks`

原因：

1. 当前页面流程不要求恢复中间态
2. 当前没有跨设备继续编辑随机页的需求
3. 当前缺口预检结果可从菜谱和冰箱主事实重算
4. 新增这些表只会把页面运行态误建成长期业务域

### 5.2 不新增通用 JSON 扩展字段

不要为了“先做起来”新增：

- `recipe_content_versions.random_meta_json`
- `meal_plan_dishes.extra_json`
- `shopping_items.random_payload_json`

随机页现在需要的字段已经足够明确，没必要先塞进 JSON。

## 六、约束与索引建议

### 6.1 `RecipeContentVersion`

建议索引方向：

- `mealMoments`
- `duration`
- `mainProteinType`

这里的原则是：

- 只为真实筛选字段加索引
- 不因为“未来可能会筛”就提前铺很多组合索引

`slotTypes` 和 `flavorTags` 是否单独索引，要看真实查询方式和 PostgreSQL 类型选择。

当前评审建议：

- 先不在文档里冻结过多组合索引
- 等后端确定字段类型后，再按真实查询语句做最小索引评审

### 6.2 `MealPlanDish`

当前已有：

- `@@index([planItemId, sortOrder])`

若新增 `slotType / purchaseState`，首版不建议额外加索引。

原因：

- 随机页和计划页主要都是按 `planItemId` 拉整桌
- 暂无按 `slotType` 或 `purchaseState` 独立分页或全局筛选的真实查询

### 6.3 `ShoppingItem`

当前已有：

- `@@index([userId, sourceType, sourceKey])`
- `@@index([userId, sourceType, sourceRecipeId, sourceRecipeVersionId, ingredientId])`

补 `RANDOM_MENU` 后，现有索引足以支撑来源回溯和重复判断。

本轮不建议为 `RANDOM_MENU` 再单独加新索引。

## 七、迁移与过渡策略

### 7.1 `RecipeContentVersion`

新增标签字段必须走前向 migration。

建议顺序：

1. 先允许空
2. 系统菜谱批量回填
3. 用户菜谱在编辑或发布新版本时补齐
4. 随机功能只对标签齐全的版本开放真实候选

不要做：

- 运行时按菜名猜 `mainProteinType`
- 运行时按步骤文本猜 `mealMoments`
- 用多层 fallback 掩盖数据没补齐

### 7.2 `MealPlanDish`

新增 `slotType / purchaseState` 也必须走前向 migration。

建议顺序：

1. 先加可空字段
2. 旧计划数据回填默认值：
   `slotType = null`
   `purchaseState = READY`
3. 升级 `POST /meal-plans` 契约
4. 同一批次切随机页和计划页调用
5. 再评估是否把 `slotType` 从可空收紧为必填

### 7.3 购物来源

`ShoppingItem.sourceType` 新增 `RANDOM_MENU` 后：

1. 不改旧数据
2. 新随机页写入才使用 `RANDOM_MENU`
3. 旧 `PLAN / EVENT / RECIPE / BRING` 保持原语义

## 八、和接口评审稿的关系

本文和以下文档配套使用：

- [random-page-api-dto-draft.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-api-dto-draft.md)
- [random-page-frontend-state.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-frontend-state.md)
- [random-page-execution.md](/Users/yangpenghui/personal/cook/docs/plans/random-page-execution.md)

关系分工：

- `api-dto-draft` 负责路径、请求、响应和错误语义
- `frontend-state` 负责页面状态和组件拆分
- `execution` 负责业务范围、实现顺序和验收口径
- `data-review` 负责字段、owner、约束和迁移边界

## 九、数据评审结论

随机页当前最小数据结论建议冻结为：

1. 随机页本身不新增持久化主表
2. 推荐标签挂在 `RecipeContentVersion`
3. 计划扩展状态挂在 `MealPlanDish`
4. 购物来源补 `ShoppingItem.sourceType = RANDOM_MENU`
5. 所有新增字段都走前向 migration，先宽后严

这一步完成后，下一步才应该进入真正的 Prisma / DTO / OpenAPI 改造评审。
