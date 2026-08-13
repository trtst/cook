# 随机页最小 API / DTO 草案

## 一、文档定位

本文不是最终 API 契约，也不是数据库实现单。

它只回答两件事：

1. 随机页进入开发评审时，前后端最小接口面应该长什么样。
2. 现有 `meal-plans`、`shopping-gap`、`RecipeContentVersion` 契约里，哪些可以复用，哪些已经不够用。

当前业务冻结前提：

- 随机页是“生成一桌可执行菜单”，不是单道翻牌。
- 页面先完成菜单选择和本桌缺口预检，再进入计划或购物清单。
- `unknown` 必须由用户显式处理，未处理不能加入计划。
- “保留但暂不采购”会写入计划，但不自动加入购物清单，并带待处理标记。
- 菜谱推荐标签挂在 `RecipeContentVersion` 内容层。

## 一点五、命名与 owner 原则

随机页是入口，不是持久化 owner。

因此接口命名必须遵守两条：

1. 计算型接口可以挂在 `random-menu*` 语义下。
2. 最终写入接口必须回到真实 owner：
   计划写入回 `meal-plans`，购物写入回 `shopping-items` 或购物域现有写接口。

本文后续所有命名都按这个原则收口，避免把“随机页”错误建成长期业务域。

## 二、现有契约基线

### 2.1 可以直接复用的已确认契约

- `mealSlot` 继续复用 `BREAKFAST / LUNCH / DINNER`。
- 菜谱时长继续复用 `RecipeDuration`：
  `WITHIN_15 / BETWEEN_15_30 / BETWEEN_30_60 / OVER_60`
- 计划结果继续以 `MealPlanSummary` 为基线返回。
- 购物清单写入后的结果继续以 `ShoppingItemSummary[]` 返回。
- 菜谱最终引用继续落在固定 `RecipeContentVersion`。

### 2.2 现有契约不足的部分

当前 `CreateMealPlanDto` 只有：

```ts
{
  operationId: string;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  recipeIds: UUID[];
  note?: string | null;
}
```

它不够表达：

- 一桌菜单的菜位结构
- 每道菜的 `slotType`
- 计划写入时的固定 `recipeVersionId`
- “待采购 / 缺口未处理”这种菜位状态

当前 `GET /shopping-gap` 只适合“全局待处理饭局缺口总览”，不适合“本桌缺口预检”。

当前 `POST /dining-events/:eventId/shopping-gap` 只适合“已存在饭局菜单 -> 写入本人购物清单”，不适合“随机页未建计划前的本桌缺口确认”。

结论：

- 随机生成、菜位替换、本桌缺口预检需要新增最小 DTO。
- 计划写入建议直接升级现有 `meal-plans` 写入契约，不新增 random-only 的计划创建路径。

## 三、推荐接口面

推荐保持“计算接口尽量无状态，最终写入接口再落库”的原则。

### 3.1 生成一桌菜单

`POST /random-menus/generate`

用途：

- 按餐次、人数、冰箱优先和当前槽位配置，生成一桌候选菜单。

请求草案：

```ts
type RandomMealSlot = "MEAT" | "VEGETABLE" | "SOUP" | "STAPLE" | "BREAKFAST_STAPLE" | "BREAKFAST_PROTEIN" | "BREAKFAST_SIDE";

type RandomSlotPlan = {
  meatCount: number;
  vegetableCount: number;
  soupCount: number;
  stapleCount: number;
  breakfastStapleCount: number;
  breakfastProteinCount: number;
  breakfastSideCount: number;
};

type GenerateRandomMenuRequest = {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan?: RandomSlotPlan | null;
};
```

响应草案：

```ts
type RandomMenuWarningCode = "INSUFFICIENT_CANDIDATES" | "PARTIAL_MENU";

type RandomMenuWarning = {
  code: RandomMenuWarningCode;
  message: string;
  slotTypes: RandomMealSlot[];
};

type RandomMenuItem = {
  slotId: string;
  slotType: RandomMealSlot;
  slotIndex: number;
  recipeId: UUID;
  recipeVersionId: UUID;
  title: string;
  coverUrl: string | null;
  servings: number | null;
  duration: RecipeDuration | null;
  durationText: string | null;
  estimatedCalories: number | null;
  flavorTags: string[];
  mainProteinType: "PORK" | "CHICKEN" | "BEEF" | "LAMB" | "DUCK" | "FISH" | "NONE" | null;
  fridgeFit: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
};

type RandomMenuResponse = {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan: RandomSlotPlan;
  items: RandomMenuItem[];
  warnings: RandomMenuWarning[];
  generatedAt: string;
};
```

说明：

- 接口不落库，不需要 `Idempotency-Key`。
- 首次进入时 `slotPlan` 可不传，由服务端按默认规则推导。
- 用户本次手动加槽 / 删菜后，再次整桌重摇时回传 `slotPlan`。

### 3.2 替换单个菜位

`POST /random-menu-slots/replace`

用途：

- 只替换一个菜位，保留其他菜位不变。

请求草案：

```ts
type ReplaceConstraint =
  | { kind: "FLAVOR"; value: "NOT_SPICY" | "MILD" | "LIGHT" }
  | { kind: "DURATION"; value: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" }
  | { kind: "INGREDIENT"; value: "USE_FRIDGE_FIRST" }
  | { kind: "AVOID_INGREDIENT"; ingredientId?: UUID; ingredientName: string };

type ReplaceRandomMenuSlotRequest = {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  fridgePreferred: boolean;
  slotPlan: RandomSlotPlan;
  currentItems: Array<{
    slotId: string;
    slotType: RandomMealSlot;
    recipeId: UUID;
    recipeVersionId: UUID;
  }>;
  targetSlotId: string;
  targetSlotType: RandomMealSlot;
  replaceConstraints: ReplaceConstraint[];
  rejectedRecipeVersionIds: UUID[];
  requestSeq: number;
};
```

响应草案：

```ts
type ReplaceRandomMenuSlotResponse = {
  requestSeq: number;
  slot: RandomMenuItem | null;
  warning: RandomMenuWarning | null;
};
```

说明：

- `requestSeq` 原样返回，前端据此丢弃旧响应。
- `rejectedRecipeVersionIds` 用于避免同一菜位来回摇出同一道菜。
- `currentItems` 用于避免整桌重复肉类和重复菜谱。

### 3.3 本桌缺口预检

`POST /random-menu-gap/preview`

用途：

- 对当前这桌已保留的菜做局部缺口预检，不写入购物清单。

请求草案：

```ts
type GapInventoryDecision = {
  slotId: string;
  ingredientId?: UUID | null;
  ingredientName: string;
  decision: "HAS" | "MISSING";
};

type CheckRandomMenuGapRequest = {
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  peopleCount: number;
  items: Array<{
    slotId: string;
    slotType: RandomMealSlot;
    recipeId: UUID;
    recipeVersionId: UUID;
  }>;
  inventoryDecisions: GapInventoryDecision[];
};
```

响应草案：

```ts
type GapStatus = "OK" | "PARTIAL" | "MISSING" | "UNKNOWN";

type RandomGapIngredient = {
  decisionKey: string;
  ingredientId?: UUID | null;
  ingredientName: string;
  requiredAmount?: number | null;
  requiredUnit?: string | null;
  ownedAmount?: number | null;
  ownedUnit?: string | null;
  gapAmount?: number | null;
  inventoryStatus: "ENOUGH" | "PARTIAL" | "MISSING" | "UNKNOWN";
  purchasable: boolean;
};

type RandomGapItem = {
  slotId: string;
  slotType: RandomMealSlot;
  recipeId: UUID;
  recipeVersionId: UUID;
  recipeName: string;
  status: GapStatus;
  missingIngredients: RandomGapIngredient[];
  actions: {
    canKeep: boolean;
    canReplace: boolean;
    canRemove: boolean;
    canAddToShopping: boolean;
  };
  unresolvedUnknownCount: number;
};

type RandomGapSummary = {
  okCount: number;
  partialCount: number;
  missingCount: number;
  unknownCount: number;
};

type CheckRandomMenuGapResponse = {
  items: RandomGapItem[];
  summary: RandomGapSummary;
  canCreatePlan: boolean;
};
```

说明：

- `unknown` 不会自动降成 `missing`。
- 前端点击“确认有 / 确认无”后，继续请求同一个接口并带回 `inventoryDecisions`。
- 当 `summary.unknownCount > 0` 时，`canCreatePlan` 必须为 `false`。

### 3.4 把随机菜单写入计划

推荐直接升级现有 `POST /meal-plans` 写入 DTO，而不是新增 `/random-menus/create-plan`。

原因：

- “计划”是稳定业务事实，不是随机页私有事实。
- 后续计划页调整菜谱也需要同一份 richer menu contract。
- 当前 `recipeIds[]` 已不足以表达冻结后的计划结构。

升级后的请求草案：

```ts
type MealPlanDishPurchaseState = "READY" | "PENDING";

type CreateMealPlanMenuItemDto = {
  slotType: RandomMealSlot;
  sortOrder: number;
  recipeId: UUID;
  recipeVersionId: UUID;
  purchaseState: MealPlanDishPurchaseState;
};

type CreateMealPlanRequestV2 = {
  operationId: string;
  planDate: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
  expectedVersion?: number | null;
  menuItems: CreateMealPlanMenuItemDto[];
  note?: string | null;
};
```

计划响应建议扩展：

```ts
type MealPlanMenuItemSummaryV2 = {
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  servings: number | null;
  sortOrder: number;
  slotType: RandomMealSlot;
  purchaseState: "READY" | "PENDING";
};
```

说明：

- `purchaseState = PENDING` 对应“保留但暂不采购”。
- 计划页可据此展示“待采购 / 缺口未处理”标记。
- `recipeVersionId` 必须由客户端提交，避免确认时被最新菜谱版本漂移覆盖。
- `expectedVersion` 在“覆盖已有计划”时必须提交；首次创建空餐次时允许为空。

### 3.5 把缺口写入购物清单

`POST /shopping-items/from-random-menu`

用途：

- 用户在缺口预检页确认采购哪些缺口后，写入本人购物清单。

请求草案：

```ts
type CreateRandomMenuShoppingItemsRequest = {
  operationId: string;
  items: Array<{
    slotId: string;
    recipeId: UUID;
    recipeVersionId: UUID;
    ingredients: Array<{
      ingredientId?: UUID | null;
      ingredientName: string;
      quantityText: string | null;
    }>;
  }>;
};
```

响应：

```ts
type CreateRandomMenuShoppingItemsResponse = ShoppingItemSummary[];
```

说明：

- 该接口是随机页出口 2 的最小写接口。
- 它和当前 `POST /dining-events/:eventId/shopping-gap` 不是同一职责，不能混用。

### 3.6 输入上限与可预测成本

所有随机接口都必须给出硬上限，避免页面临时需求把查询成本做成开放口。

建议固定：

- `peopleCount`: `1 ~ 12`
- 单次 `slotPlan` 总菜位数：最大 `12`
- `replaceConstraints`: 最大 `6`
- `rejectedRecipeVersionIds`: 最大 `30`
- `inventoryDecisions`: 最大 `80`
- `menuItems`: 最大 `12`
- 随机购物写入里的总缺口食材项：最大 `80`

响应也要限制体积：

- 生成菜单只返回列表摘要，不返回整份菜谱步骤、完整食材和长文本正文。
- 单菜位替换只返回目标菜位，不重复回传整桌菜单。
- 缺口预检只返回当前菜单相关缺口，不返回全局冰箱或全局购物清单数据。

### 3.7 写接口的幂等与并发

随机页里的写接口只有两类：

1. 写入计划
2. 写入购物清单

规则固定为：

- 两类写接口都必须使用请求头 `Idempotency-Key`
- `Idempotency-Key` 继续沿用当前项目的纯数字字符串约束
- 覆盖已有计划时必须校验 `expectedVersion`
- 同一 `planDate + mealSlot` 的已有计划如果版本不符，返回冲突，不允许静默覆盖
- 购物清单写入必须由服务端生成 `sourceKey` 和来源归属，不能信任客户端拼接

计算型接口不写幂等记录，也不落缓存。

## 三点五、最小安全规则

随机页接口看起来轻，但安全边界不能降级。

### 3.5.1 鉴权

- `generate / replace / gap preview / create plan / create shopping` 全部要求登录
- 只允许读取当前用户可访问的菜谱与冰箱事实
- 不允许通过传入任意 `recipeVersionId` 读取无权版本

### 3.5.2 服务端权威

服务端必须自行校验：

- `mealSlot / peopleCount / slotPlan` 是否合法
- 每个 `recipeId / recipeVersionId` 是否真实匹配
- 每道菜是否属于当前用户可用于计划的菜谱范围
- `purchaseState` 是否只取 `READY / PENDING`
- `slotType` 是否与服务端记录的推荐结果或菜谱标签兼容

客户端提交的这些字段都不能直接当事实：

- `title`
- `durationText`
- `estimatedCalories`
- `flavorTags`
- `mainProteinType`
- `quantityText`

它们最多是展示缓存，真正写入时必须以服务端主事实重算或校验。

### 3.5.3 审计与日志

写计划、写购物清单时，日志只记录：

- 操作者
- 目标计划或清单
- 菜位数量
- 来源动作

不要把完整菜单正文、冰箱库存细项或用户输入的长说明直接打进普通日志。

## 四、与现有契约的关系

### 4.1 直接复用

- `MealSlot` 枚举
- `RecipeDuration` 枚举
- `MealPlanSummary` 作为计划结果基线
- `ShoppingItemSummary[]` 作为购物清单写入结果
- `RecipeContentVersion` 作为最终菜单引用目标

### 4.2 需要新增的 DTO

- `RandomSlotPlan`
- `RandomMenuItem`
- `RandomMenuWarning`
- `ReplaceConstraint`
- `RandomGapIngredient`
- `RandomGapItem`
- `MealPlanDishPurchaseState`

### 4.3 需要升级的现有 DTO

- `CreateMealPlanDto`
- `MealPlanMenuItemModel`
- `MealPlanMenuItemSummary`

新增时也应同步考虑：

- `MealPlanSummary`
- `ShoppingItemSummary` 的来源语义是否需要补 `RANDOM_MENU`

### 4.4 明确不复用的现有接口

- `GET /shopping-gap`
- `POST /dining-events/:eventId/shopping-gap`

原因：

- 它们是“全局饭局缺口”与“已存在饭局菜单缺口写入”接口。
- 随机页需要的是“当前这桌”的局部预检与局部采购写入。

## 五、最小数据依赖

随机接口真正可用前，`RecipeContentVersion` 至少需要补齐这些可查询标签：

- `mealMoments`: 适用餐次
- `slotTypes`: 荤菜 / 素菜 / 汤 / 主食 / 早餐主食 / 早餐蛋白 / 早餐小食
- `flavorTags`
- `duration`
- `mainProteinType`
- `fridgeFit` 或可用于冰箱匹配的结构化依据

当前 schema 已有：

- `duration`
- `estimatedCalories`
- `ingredientsJson`
- `baseServings`

当前 schema 还没有：

- `mealMoments`
- `slotTypes`
- `flavorTags`
- `mainProteinType`

这部分属于下一阶段 API / 数据建模评审，不在本文直接定表。

## 六、安全、性能与迁移结论

### 6.1 安全

- 不接受客户端用展示字段替代事实字段
- 不允许通过随机页接口访问他人冰箱、他人计划或无权菜谱
- 写接口继续走幂等键和版本冲突校验

### 6.2 性能

- 计算接口默认不缓存
- 候选查询只选当前菜单生成真正需要的字段
- 所有数组和候选集都有硬上限
- 缺口预检只对当前菜单计算，不复用全局聚合缺口路径

### 6.3 命名

- 资源命名保持短、按 owner 收口
- 不使用 `context / overview / current` 这类大杂烩接口名
- 不引入 `RandomMenuManagerDto`、`RandomContextPayload` 这类泛化命名

### 6.4 过渡策略

推荐采用“一次短过渡，不保留长期双契约”的方式：

1. 先新增随机计算接口
2. 再升级 `POST /meal-plans` 为 `menuItems[]`
3. 同一开发批次内迁移随机页和计划页调用
4. 迁移完成后移除 `recipeIds[]` 临时兼容

允许存在的临时过渡只限于：

- 后端内部把旧 `recipeIds[]` 映射为 `menuItems[]`
- 前端局部把旧计划页提交模型补成新结构

但这些过渡逻辑不能变成长期公开契约，也不能抽成通用 adapter 层。

## 六、接口设计结论

最小可开发接口面建议固定为 5 个动作：

1. `POST /random-menus/generate`
2. `POST /random-menu-slots/replace`
3. `POST /random-menu-gap/preview`
4. 升级 `POST /meal-plans`
5. `POST /shopping-items/from-random-menu`

其中：

- 前 3 个是无状态计算接口
- 后 2 个是最终写接口

这样可以避免先引入“随机草稿表”“随机记录表”这类未被证明需要持久化的新主事实。
