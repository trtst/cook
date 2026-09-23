# 低摩擦做饭库存闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已有库存批次模型之上，完成“菜谱缺口自动写入、采购完成自动记入、做饭完成自动消耗、异常才干预”的低摩擦做饭闭环。

**Architecture:** 先核对并复用现有 `FridgeItem` 批次事实、购物项来源键、库存预占和 FEFO 扣减基础，不并行建设第二套库存系统。新增一层来源驱动的缺口写入与做饭完成消耗服务；自动写入明确区分 `STOCK_IN` 与 `STOCK_CONSUME`，数量未知库存只记录粗略使用状态。计划/饭局结束不调用消耗服务，只有带固定菜谱版本的做饭完成事件可以触发消耗。

**Tech Stack:** NestJS + Prisma + PostgreSQL；uni-app + Vue 3 + TypeScript；现有 `Idempotency-Key`、OpenAPI、本地客户端 API 类型和测试工具。

**Spec:** `docs/superpowers/specs/2026-09-21-low-friction-cooking-inventory-loop-design.md`

## Global Constraints

- 保留工作区已有库存批次、食材导入和通知改动；不得 reset、checkout、stash 或覆盖无关 staged/unstaged hunk。
- 先业务流程、页面行为、权限状态、最小接口，再实现；API/Prisma/migration 必须遵守 `docs/api-database-rules.md`。
- 用户手动输入明确数量和单位后保持精确库存；只有粗略标记或无法比较才降级。
- `适量`不参与精确扣减；同一顿饭相同食材先合并并保留来源。
- 计划/饭局结束不触发库存消耗；做饭完成事件必须幂等。
- 撤销仅在当前完成结果页有效，且不能覆盖后续手动修正。
- 撤销服务端窗口为自动操作完成后 5 分钟，且必须通过批次版本检查；前端离开结果页后隐藏入口。
- `UNKNOWN` 只在用户主动查看时确认，不自动弹窗、不阻止做饭、不自动写成确定缺口。
- 同食材同单位事实按来源保存，展示层可以合并数量；用户移除的自动来源必须保留已移除事实，后续同步不得写回。
- 用户移除来源复用现有 `ShoppingItem.status = DELETED`、`removedByUserId`、`removedAt` 作为墓碑；不新增 `removedByUser` 字段或独立来源表，并提供已移除来源恢复入口。
- 历史餐次补录窗口为餐次完成后 48 小时，使用补录时的当前库存；补录只改变本人冰箱，不改变计划/饭局状态，也不通知其他成员。
- 冰箱归属冻结为用户级；饭局只分配菜谱责任，不共享冰箱，不新增 `diningGroupId` 到库存模型。
- `Idempotency-Key` 使用客户端生成的数字字符串 `operationId`；服务端用 `userId + operationType + operationId + requestHash` 建立幂等作用域，禁止拼接非数字业务字段。
- 撤销对比自动操作后保存的 `FridgeItem.version`，而不是仅比较 `updatedAt`；任一相关批次被后续操作修改，整体撤销失败。
- 阶段 0 先确认现有批次允许 `exactQuantity = null` 的存在记录；未证明必要前不新增状态字段、库存表或通用流水表。
- 不实现全局精准库存模式、仓储级库存、成本核算或其他未确认能力。

---

### Task 1: 核对现有批次兼容性并冻结缺口状态模型

**Files:**
- Create: `apps/api/src/modules/pantry/pantry.low-friction-model.ts`
- Create: `apps/api/src/modules/pantry/pantry.low-friction-model.test.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `docs/api-contract.md`
- Modify: `docs/project.md`
- Modify: `docs/dining-group.md`

**Interfaces:**
- Consumes: `FridgeIngredientSummary`、菜谱精确用量、`SEASONING` 分类和现有缺口结果。
- Produces: `InventoryAvailabilityState`、`RecipeGapState`、稳定的缺口状态标签和粗略库存结果摘要。

- [ ] **Step 1: 先只读核对现有批次写入和展示，确认数量为空的批次可以表达“有库存但未知”。**

重点检查 `FridgeItem.exactQuantity`、`exactUnitId`、`available`、`quantityText`、来源字段和现有 FEFO writer；若已满足需求，不新增 Prisma 字段或迁移。

- [ ] **Step 2: 写失败测试，覆盖精确足够、精确不足、粗略未知和明确缺少。**

```ts
test("classifies exact enough, exact shortage, unknown stock, and missing separately", () => {
  assert.equal(classifyRecipeIngredientGap({ required: "500", unitId: 1, exactStock: "800", exactStockUnitId: 1, hasRoughStock: false }), "READY");
  assert.equal(classifyRecipeIngredientGap({ required: "500", unitId: 1, exactStock: "300", exactStockUnitId: 1, hasRoughStock: false }), "SHORTAGE");
  assert.equal(classifyRecipeIngredientGap({ required: "500", unitId: 1, exactStock: null, exactStockUnitId: null, hasRoughStock: true }), "UNKNOWN");
  assert.equal(classifyRecipeIngredientGap({ required: "500", unitId: 1, exactStock: null, exactStockUnitId: null, hasRoughStock: false }), "MISSING");
});
```

- [ ] **Step 3: 运行测试确认按预期因函数不存在而失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.low-friction-model.test.ts`

Expected: FAIL because the classification function and states do not exist.

- [ ] **Step 4: 实现纯函数，不在客户端猜测状态。**

实现 `classifyRecipeIngredientGap()`、`mergeRecipeConsumptionLines()` 和 `buildInventoryUsageSummary()`；同食材同单位合并，`FUZZY` 行跳过精确扣减，未知库存返回 `UNKNOWN` 而不是 `READY` 或 `SHORTAGE`。

- [ ] **Step 5: 同步公共类型、OpenAPI 和领域文档。**

只增加已确认的枚举/结果字段；更新 `docs/project.md` 和 `docs/dining-group.md`，明确采购完成只记录有库存，计划/饭局结束不等于消耗，做饭完成才是消耗触发点。

- [ ] **Step 6: 运行 focused 测试并检查目标 diff。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.low-friction-model.test.ts`

Run: `git diff --check -- docs/project.md docs/dining-group.md apps/api/src/modules/pantry/pantry.low-friction-model.ts apps/api/src/modules/pantry/pantry.low-friction-model.test.ts`

---

### Task 2: 自动缺口写入采购清单并保留来源

**Files:**
- Modify: `apps/api/src/modules/pantry/pantry.service.ts`
- Modify: `apps/api/src/modules/pantry/pantry.controller.ts`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Create: `apps/api/src/modules/pantry/pantry.shopping-gap.test.ts`
- Modify: `apps/client/src/pages_recipe/detail/index.vue`
- Modify: `apps/client/src/pages_meal/detail/index.vue`
- Modify: `apps/client/src/pages_pantry/gap/index.vue`
- Create: `apps/client/src/pages_pantry/gap/low-friction-gap-contract.test.js`
- Modify: relevant client API/type tests only when the frozen response contract requires it

**Interfaces:**
- Consumes: fixed recipe version, current people count, current fridge summaries, existing active shopping list and source-key deduplication.
- Produces: a source-scoped automatic gap write that creates or reuses one default active list, skips definite ready items, leaves `UNKNOWN` items as pending confirmation, and never mutates manual items.

- [ ] **Step 1: 写失败测试覆盖来源去重、手动项保护和 unknown 不静默过滤。**

```ts
test("automatic gap write only changes its own source items", async () => {
  const result = await writeRecipeGapToShoppingList({
    sourceKey: "plan:101:recipe:202",
    items: [
      { ingredientId: 7, unitId: 1, quantity: "500", state: "SHORTAGE" },
      { ingredientId: 8, unitId: 1, quantity: "300", state: "UNKNOWN" }
    ]
  });
  assert.deepEqual(result.createdSourceKeys, ["plan:101:recipe:202:ingredient:7"]);
  assert.deepEqual(result.pendingKeys, ["plan:101:recipe:202:ingredient:8"]);
  assert.equal(result.manualItemsChanged, 0);
});
```

- [ ] **Step 2: 运行测试确认当前写入路径不满足新语义。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.shopping-gap.test.ts`

Expected: FAIL on missing source-scoped pending behavior or duplicate handling.

- [ ] **Step 3: 在服务端复用现有 sourceKey 和 list binding 实现最小写入。**

服务端重新读取当前库存和固定菜谱版本，不信任客户端缺口结论；同食材同单位才合并；自动项携带来源键；同来源重复写入幂等；撤销只删除本次自动项。无有效清单时创建默认清单，创建与写项放入同一幂等事务。

- [ ] **Step 4: 接入菜谱详情、计划/饭局确认和缺口页。**

菜谱详情按 `MISSING > SHORTAGE > UNKNOWN > READY` 显示一个综合状态；`UNKNOWN` 默认只展示“可能有，数量未记录”，用户主动查看后在可展开列表中逐项选择“够用 / 不够，加入采购 / 暂不处理”，底部提供“全部确认”批量应用同一种处理方式；计划/饭局确认后自动调用来源写入；缺口页不再重复要求选择目标清单。

展示层按“食材 + 单位”合并数量，详情中保留多个计划、饭局或菜谱来源；自动来源被用户移除后，后续同步跳过相同来源键。

- [ ] **Step 5: 运行客户端 focused tests、API type-check 和目标 diff 检查。**

Run the focused recipe-detail, meal-detail, pantry-gap and shopping-source tests.

Run: `pnpm --filter @next-meal/api type-check`

Run: `pnpm --filter @next-meal/client type-check`

Run: `git diff --check -- apps/api/src/modules/pantry apps/client/src/pages_recipe/detail/index.vue apps/client/src/pages_meal/detail/index.vue apps/client/src/pages_pantry/gap/index.vue`

---

### Task 3: 采购完成自动记入粗略冰箱记录

**Files:**
- Modify: `apps/api/src/modules/pantry/pantry.service.ts`
- Modify: `apps/api/src/modules/pantry/pantry.controller.ts` only if the existing completion contract needs a minimal response field
- Modify: `apps/api/src/contracts/types.ts`, `apps/api/src/contracts/openapi.ts`
- Create: `apps/api/src/modules/pantry/pantry.shopping-inventory.test.ts`
- Modify: `apps/client/src/pages_pantry/list-detail/index.vue`
- Modify: `apps/client/src/pages_pantry/list-complete/index.vue` only if compatibility redirect/result handling is required
- Modify: relevant client API and tests

**Interfaces:**
- Consumes: checked shopping entries, source-linked shopping items, existing batch creator and idempotency record.
- Produces: one-step complete purchase that creates presence-only fridge records when exact quantity is absent, keeps precise quantity only when explicitly supplied, and returns an immediate undo token/event handle usable on the result page.

- [ ] **Step 1: 写失败测试覆盖 no quantity, no expiry, precise override and idempotent retry.**

```ts
test("completing a purchase creates presence-only fridge records without fake expiry", async () => {
  const result = await completeShoppingListWithDefaults(/* checked item without exact amount */);
  assert.equal(result.fridgeItems[0]?.exactQuantity, null);
  assert.equal(result.fridgeItems[0]?.expireAt, null);
  assert.equal(result.fridgeItems[0]?.availabilityState, "UNKNOWN");
});
```

- [ ] **Step 2: 运行测试确认旧入库确认语义先失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.shopping-inventory.test.ts`

Expected: FAIL because completion currently expects per-entry store/quantity/expiry confirmation.

- [ ] **Step 3: 调整服务端完成采购的默认行为。**

已购项自动创建或结算冰箱记录；无数量时不得伪造 quantity/expiry；保留 sourceShoppingList/sourceShoppingItem；未购项只保留采购事实。自动撤销只在当前结果页有效，服务端校验没有后续手动修改后再反向恢复。

- [ ] **Step 4: 将清单主按钮改成完成采购并移除独立入库主路径。**

全部已购时主按钮直接执行“全部买到，完成采购”；部分未购时直接完成已购项，未购项保留为待购买状态，结果页显示“已完成 X 项，未购 Y 项”，不追加确认步骤。结果页提供轻量“撤销记入冰箱”，服务端只接受 5 分钟内且没有后续修改的撤销；数量、单位和到期时间移动到冰箱详情页的主动入口。保留旧深链只用于兼容回退，不再作为正常导航。

- [ ] **Step 5: 运行 focused shopping/inventory tests 和 client type-check。**

Run the focused shopping completion and pantry page tests.

Run: `pnpm --filter @next-meal/api exec prisma validate`

Run: `pnpm --filter @next-meal/client type-check`

---

### Task 4: 做饭完成事件与合并消耗

**Files:**
- Create: `apps/api/src/modules/pantry/pantry.cooking-consumption.ts`
- Create: `apps/api/src/modules/pantry/pantry.cooking-consumption.test.ts`
- Modify: `apps/api/src/modules/meal/meal.controller.ts`
- Modify: `apps/api/src/modules/meal/meal.service.ts` or a focused pantry controller/service boundary, keeping meal ownership checks in meal domain
- Modify: `apps/api/src/contracts/dtos.ts`, `apps/api/src/contracts/types.ts`, `apps/api/src/contracts/openapi.ts`
- Modify: `apps/client/src/pages_meal/cook-mode/index.vue`
- Modify: `apps/client/src/pages_meal/apis/meal.ts` or shared API only after contract is frozen
- Modify: `apps/client/src/pages_meal/cook-mode/index.test.js`
- Modify: `apps/client/src/pages_meal/detail/index.vue` only for entry/source parameters

**Interfaces:**
- Consumes: fixed meal plan/menu recipe versions, people count, current user's responsibility, existing FEFO writer and coarse inventory state.
- Produces: an idempotent cooking completion result containing updated item count, unknown item count, source summary and a current-page undo handle.

- [ ] **Step 1: 写失败测试覆盖同食材合并、适量跳过、精确/粗略分流和重复事件。**

```ts
test("cooking completion merges duplicate ingredients and skips fuzzy seasoning", () => {
  const result = buildCookingConsumptionPlan([
    exactLine("egg", "2", "个", "番茄炒蛋"),
    exactLine("egg", "1", "个", "紫菜蛋花汤"),
    fuzzySeasoning("salt", "适量", "番茄炒蛋")
  ]);
  assert.deepEqual(result.exactLines, [{ ingredientKey: "egg", quantity: "3", unit: "个", sources: ["番茄炒蛋", "紫菜蛋花汤"] }]);
  assert.deepEqual(result.skippedFuzzySources, ["盐"]);
});
```

- [ ] **Step 2: 运行测试确认新计划函数不存在或不满足规则。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.cooking-consumption.test.ts`

Expected: FAIL for the new merge and result semantics.

- [ ] **Step 3: 实现纯函数和事务编排。**

精确行按最终有效食材和单位合并；数量未知行生成粗略使用结果，不调用精确扣减；适量跳过；可精确处理的行调用既有 FEFO 总量扣减，允许按 FEFO 顺序跨批次扣到可用部分，剩余不足进入摘要。单项异常写入结果摘要，不回滚其他独立成功项；事件整体使用数字字符串幂等键。

- [ ] **Step 4: 增加做饭完成接口并区分计划结束。**

接口必须验证当前用户对餐次/负责菜的所有权或饭局责任，只处理本人负责的菜和本人冰箱；读取固定菜谱版本和提交时的当前库存；重复事件返回原结果；计划完成和饭局结束接口不得调用该服务。若饭局未指定责任人或当前用户没有负责菜，页面必须让用户明确确认是否标记整桌完成，但只处理本人冰箱，不影响其他参与者。做饭完成可以从历史餐次补录，窗口为餐次完成后 48 小时，使用补录时的当前库存，不改变计划/饭局状态或触发成员通知。若需要撤销，保存完整的跨批次自动分配结果和 `FridgeItem.version`，只允许完成后 5 分钟内且所有相关批次未被后续修改时整体撤销。

- [ ] **Step 5: 在做饭模式最后一步加入单一“这顿做完了”动作。**

成功后显示“已按菜谱用量估算”摘要，动态呈现已更新、数量未知、库存不足和适量跳过的数量，并提供当前页撤销；异常只显示 `按有库存处理 / 标记快用完 / 暂不处理`。不显示逐项数量输入，不新增全局精准模式。

- [ ] **Step 6: 运行后端/客户端 focused tests。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.cooking-consumption.test.ts`

Run the existing cook-mode and meal-detail tests.

Run: `pnpm --filter @next-meal/client type-check`

---

### Task 5: 精准修正、即时撤销和库存状态展示

**Files:**
- Modify: `apps/api/src/modules/pantry/pantry.service.ts`
- Modify: `apps/api/src/modules/pantry/pantry.controller.ts`
- Modify: `apps/api/src/contracts/dtos.ts`, `apps/api/src/contracts/types.ts`, `apps/api/src/contracts/openapi.ts`
- Modify: `apps/client/src/pages_pantry/item-detail/index.vue`
- Modify: `apps/client/src/pages_pantry/index/index.vue`
- Create: `apps/api/src/modules/pantry/pantry.inventory-correction.test.ts`
- Modify: relevant pantry API tests only when the frozen response contract requires it

**Interfaces:**
- Consumes: Task 1 precision states, Task 3 presence-only records and Task 4 consumption result/undo handle.
- Produces: `补充数量`、`补充到期时间`、`精准调整消耗`、`快用完`、`用完` 的最小入口；精确修正后继续自动扣减，粗略标记后不参与精确计算。

- [ ] **Step 1: 写失败测试覆盖精确修正保持精确、粗略标记降级和撤销冲突。**

```ts
test("manual exact quantity remains eligible for future automatic consumption", () => {
  const state = applyManualQuantityCorrection({ quantity: null, unitId: null }, { quantity: "800", unitId: 1 });
  assert.equal(state.precision, "EXACT");
  assert.equal(state.autoConsumptionEligible, true);
});

test("undo refuses to overwrite a later manual correction", () => {
  assert.equal(canUndoAutomaticConsumption({ changedAfterConsumption: true }), false);
});
```

- [ ] **Step 2: 运行测试确认当前 API/UI 没有这些状态和撤销语义。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.inventory-correction.test.ts`

Expected: FAIL on missing precision/undo state functions.

- [ ] **Step 3: 实现最小状态和冲突校验。**

精确输入写回结构化数量和单位；粗略按钮清空可计算数量并保留存在事实；自动消耗撤销只在没有后续修改时反向应用。不要增加全局配置字段。

- [ ] **Step 4: 更新前台库存摘要。**

列表和详情只显示简短状态；精准输入和到期设置留在主动入口；数量未知不显示为零，不阻止从菜谱或做饭流程继续。

- [ ] **Step 5: 运行 focused tests、API build 和 client build。**

Run the focused pantry correction/undo tests.

Run: `pnpm build:api`

Run: `pnpm build:client`

---

### Task 6: 文档、central log 和真实验收

**Files:**
- Modify: `docs/project.md`
- Modify: `docs/dining-group.md`
- Modify: `docs/ingredient.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/plans/minor_change_log.md`
- Modify: `apps/api/scripts/verify-shopping-fridge-flow.ts` for the confirmed purchase-to-fridge path
- Create: `apps/api/scripts/verify-cooking-consumption-flow.ts` for the confirmed cooking-completion path

- [ ] **Step 1: 对照设计逐条检查实现覆盖。**

检查菜谱综合状态、UNKNOWN 主动确认、来源合并展示、用户移除后不写回、自动记入、未知库存、做饭完成、合并扣减、跨批次部分扣减、适量跳过、幂等、5 分钟撤销窗口、历史补录、计划/饭局解耦和精准修正；每一项必须绑定到固定测试文件、实现位置或真实验收证据，不以计划文本本身作为完成证据。

- [ ] **Step 2: 更新当前权威文档和 central log。**

只更新本次确认的库存消耗和低摩擦流程，不覆盖历史 `docs/cook/` 源材料；记录实际验证命令和仍未完成的微信开发者工具/真机验收。

- [ ] **Step 3: 运行最终静态门禁。**

Run: `pnpm type-check`

Run: `pnpm build:api`

Run: `pnpm build:client`

Run: `git diff --check`

- [ ] **Step 4: 运行真实 API/页面流程。**

至少验证：菜谱综合缺口状态、UNKNOWN 逐项/批量确认、自动来源合并展示、用户移除后不写回与手动恢复、完成采购部分未购项保留、自动记入无数量批次、做饭完成一次扣减与数字幂等键重复提交、跨批次部分扣减、三批次整体撤销与任一批次版本冲突、粗略库存不阻塞、48 小时历史补录及无通知、5 分钟撤销与手动修改冲突、用户级冰箱下多人分别完成各自菜品、精确修正继续自动扣减、计划/饭局结束不扣库存。

- [ ] **Step 5: 做范围自检并报告未覆盖项。**

分别列出本需求修改的文件、刻意未改的现有 staged/unstaged 文件、静态验证结果、真实验收结果和微信端仍待验证的边界。
