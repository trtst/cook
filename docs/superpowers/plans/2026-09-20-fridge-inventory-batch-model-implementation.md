# 食材库存批次模型优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将食材库存改为“列表按食材聚合、详情按购买批次展示”，并提供可幂等、可回滚的新增库存与总量扣减能力。

**Architecture:** 继续复用 `fridge_items` 作为一次购买/入库一行的批次事实，不建立平行汇总表。API 读取层按最终有效食材身份聚合当前批次，详情接口返回当前批次、过期折叠批次和可分页的历史批次；写入层通过统一的事务服务创建新批次或按 FEFO（最早到期优先）跨批次扣减。客户端列表只消费食材摘要，详情只消费食材身份和批次详情；购物库存预占仍与真实扣减分离。

**Tech Stack:** NestJS + Prisma + PostgreSQL；uni-app + Vue 3 + TypeScript + Pinia；现有数字字符串资源 ID、`Idempotency-Key` 和 OpenAPI 装饰器。

**Spec:** `docs/superpowers/specs/2026-09-20-fridge-inventory-batch-model-design.md`

## Global Constraints

- `FridgeItem` 每一行代表一次购买或一次入库形成的库存批次；新增库存不得覆盖已有批次。
- 食材列表同一最终有效 `ingredientId` 只出现一次；详情页才展示多个批次。
- 过期只改变提醒和展示分组，不把库存标记为不可用；过期但仍有数量的批次可继续扣减。
- 扣减只提交食材身份、数量、单位和幂等键；服务端按最早到期批次分摊，数量不足或单位不可比较时整次回滚。
- 同单位才汇总；没有可靠换算关系时保留分段数量，不猜测换算。
- `Ingredient.aliases` 与 `MERGED + mergedToId` 沿用现有语义，不新增 `parentIngredientId` 或库存专用食材树。
- 购物清单“应用库存”仍然是预占；只有购物完成入库、做菜或明确消耗流程才调用真实库存新增/扣减。
- 所有重试写入使用数字字符串 `Idempotency-Key`；数据库/接口变更必须同步 `docs/api-database-rules.md`、OpenAPI、客户端类型和 central minor change log。
- 保留工作区现有未提交修改：`apps/api/src/modules/user/notification.service.test.ts`、`apps/api/src/modules/user/notification.service.ts`、`apps/client/src/pages/me/index.vue`、`apps/client/src/pages_me/recommend/index.test.js`、`apps/client/src/pages_me/recommend/index.vue`、`docs/api-contract.md`、`docs/plans/minor_change_log.md`；只提交本功能明确涉及的 hunk。

---

### Task 1: 审计现有库存数据和调用链，冻结迁移前置条件

**Files:**
- Create: `apps/api/src/modules/pantry/pantry.inventory-audit.ts`
- Create: `apps/api/src/modules/pantry/pantry.inventory-audit.test.ts`
- Modify: `docs/superpowers/specs/2026-09-20-fridge-inventory-batch-model-design.md`
- Modify: `docs/plans/minor_change_log.md`（只追加本次审计结论对应的 hunk）

**Interfaces:**
- Consumes: Prisma `FridgeItem`、`Ingredient`、`Unit`、`ShoppingItemFridgeReservation` 只读数据。
- Produces: `InventoryAuditReport`，包含 `missingIngredientIds`、`mergedIngredientIds`、`fuzzyQuantityIds`、`negativeOrInvalidQuantityIds`、`reservedBatchIds` 和可安全迁移计数；后续任务只允许依赖审计报告确认过的事实。

- [x] **Step 1: 写失败测试，覆盖空食材身份、归并身份、模糊数量和过期库存的分类。**

```ts
it("reports unsafe legacy rows without guessing by name", () => {
  const report = inspectInventoryRows([
    { id: 1, ingredientId: null, quantityText: "一袋", exactQuantity: null, exactUnitId: null, available: true, expireAt: null },
    { id: 2, ingredientId: 12, ingredientStatus: "MERGED", mergedToId: 20, quantityText: "2 个", exactQuantity: "2", exactUnitId: 3, available: true, expireAt: null },
    { id: 3, ingredientId: 20, ingredientStatus: "ACTIVE", mergedToId: null, quantityText: "500 克", exactQuantity: "500", exactUnitId: 4, available: true, expireAt: new Date("2026-09-19T00:00:00.000Z") }
  ], new Date("2026-09-20T00:00:00.000Z"));

  assert.deepEqual(report.missingIngredientIds, [1]);
  assert.deepEqual(report.mergedIngredientIds, [{ id: 2, targetId: 20 }]);
  assert.deepEqual(report.fuzzyQuantityIds, []);
  assert.deepEqual(report.expiredAvailableIds, [3]);
});
```

- [x] **Step 2: 运行审计测试确认先失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.inventory-audit.test.ts`

Expected: FAIL because `inspectInventoryRows` and `InventoryAuditReport` do not exist.

- [x] **Step 3: 实现纯函数审计和只读 Prisma 入口。**

实现 `inspectInventoryRows()` 只按已存字段分类，不按名称、拼音或别名推断 `ingredientId`；实现 `runInventoryAudit(prisma)` 读取所有库存行及当前食材归并状态，输出待人工处理 ID。审计不得写库，不得把过期行标为不可用。

- [x] **Step 4: 运行测试并保存当前数据库审计输出。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.inventory-audit.test.ts`

Expected: PASS；再运行项目已有只读审计命令/Prisma 查询，记录真实 `missingIngredientIds` 等结果。若存在无法安全解析的旧数据，实施只收紧新写入和聚合口径，不自动迁移这些行。

- [x] **Step 5: 更新设计文档和 central log。**

把真实审计结果和是否需要 migration 的结论追加到设计文档与 `docs/plans/minor_change_log.md`，不覆盖工作区中其他人的未提交 hunk。

### Task 2: 建立批次读取模型和 API 契约

**Files:**
- Modify: `apps/api/src/contracts/types.ts:2968-3028`
- Modify: `apps/api/src/contracts/dtos.ts:968-990,2479-2540,2929-2945`
- Modify: `apps/api/src/contracts/openapi.ts:2367-2425`（以当前实际行号为准）
- Modify: `apps/api/src/modules/pantry/pantry.controller.ts:68-145`
- Modify: `apps/api/src/modules/pantry/pantry.service.ts:348-426,4951-5085`
- Modify: `apps/client/src/pages_pantry/apis/fridge.ts`
- Modify: `apps/client/src/apis/fridge.ts`
- Modify: `docs/api-contract.md`（只修改库存接口段落）
- Modify: `docs/ingredient.md`（追加当前库存批次口径）

**Interfaces:**
- Consumes: Task 1 审计报告；现有 `FridgeItem` 行、系统单位和食材归并关系。
- Produces: `FridgeIngredientSummary`、`FridgeBatchSummary`、`FridgeIngredientDetail`、`FridgeHistoryPage`；`GET /fridge-items` 返回食材级摘要，`GET /fridge-items/:ingredientId` 返回详情，`GET /fridge-items/:ingredientId/history` 返回历史批次。

- [x] **Step 1: 先写契约测试，明确同食材两批次聚合、过期分组和多单位分段。**

```ts
it("returns one ingredient summary for multiple batches", () => {
  const result = groupFridgeBatches([
    batch({ id: 10, ingredientId: 7, exactQuantity: "500", exactUnitId: 1, exactUnitName: "克", expireAt: "2026-09-22", available: true }),
    batch({ id: 11, ingredientId: 7, exactQuantity: "2", exactUnitId: 2, exactUnitName: "个", expireAt: "2026-09-19", available: true })
  ], new Date("2026-09-20T00:00:00.000Z"));

  assert.equal(result.length, 1);
  assert.equal(result[0]?.ingredientId, 7);
  assert.deepEqual(result[0]?.stockGroups, [
    { unitId: 2, unitName: "个", quantity: "2" },
    { unitId: 1, unitName: "克", quantity: "500" }
  ]);
  assert.equal(result[0]?.expiredBatchCount, 1);
});
```

- [x] **Step 2: 运行契约测试确认先失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.inventory-contract.test.ts`

Expected: FAIL because the ingredient-level types and grouping function do not exist.

- [x] **Step 3: 实现最小数据类型、分组纯函数和稳定排序。**

当前库存只取 `available = true` 且数量仍大于 0 的行；最终身份按 `MERGED` 的目标食材解析。相同 `exactUnitId` 汇总 `Decimal` 数量；非结构化数量或不同单位保留 `stockText` 段落并标记 `needsConfirmation`。当前批次排序为有到期日优先、到期日升序、入库时间升序、ID 升序；无到期日排最后。历史接口只返回 `available = false` 的行，默认不删除任何行。

- [x] **Step 4: 在 `PantryService` 和 controller 中接入读取接口。**

将 `listFridge()` 改为分页食材摘要，而不是分页批次；详情接口以最终有效 `ingredientId` 查询该用户的当前批次，返回 `expiredBatches`（仍有库存但已过期，前台默认收起）和 `activeBatches`（未过期/临期），并保留预占明细。历史接口使用 `page/pageSize` 查询已用完批次；15 天只作为 `expiredBatches` 的重点展示/历史筛选元数据，不改变数据库状态。

- [x] **Step 5: 同步 DTO、OpenAPI、客户端 request types 和文档。**

详情参数只能是食材身份，不接受页面用名称猜测；为旧的批次深链保留 `GET /fridge-items/:itemId` 反查批次并 301/业务跳转到食材详情的兼容处理，不能让旧入口静默显示另一食材。

- [x] **Step 6: 运行后端类型和契约检查。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.inventory-contract.test.ts`

Run: `pnpm --filter @next-meal/api exec prisma validate`

Run: `pnpm type-check`

Expected: focused tests, Prisma validation and type-check all PASS；已有未提交通知/用户改动造成的独立失败要单独记录，不修改它们。

### Task 3: 实现新增批次和 FEFO 跨批次扣减事务

**Files:**
- Modify: `apps/api/src/contracts/dtos.ts`（新增/扣减 DTO）
- Modify: `apps/api/src/contracts/types.ts`（新增/扣减响应）
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/modules/pantry/pantry.service.ts:427-720`
- Modify: `apps/api/src/modules/pantry/pantry.controller.ts:92-145`
- Create: `apps/api/src/modules/pantry/pantry.inventory-write.test.ts`
- Modify: `apps/api/prisma/schema.prisma`（只有审计证明需要时才加约束/索引）
- Migration file: 只有审计证明需要 schema 变更时，才按仓库当前时间戳命名规则创建一份具体 migration；若现有字段和索引足够则不创建 migration。

**Interfaces:**
- Consumes: Task 2 的 `FridgeIngredientDetail` 和现有 `FridgeItem` 事实；调用方提交 `ingredientId + exactQuantity + exactUnitId`。
- Produces: `POST /fridge-items` 新建独立批次；`POST /fridge-items/consume` 接收 `{ ingredientId, exactQuantity, exactUnitId }`；响应返回食材详情及 `allocations[{ batchId, quantity, unitId }]`。

- [x] **Step 1: 写失败测试覆盖新增不覆盖、FEFO、过期可扣减和失败回滚。**

```ts
it("consumes across batches in earliest-expiry order and rolls back on shortage", async () => {
  await createBatch({ id: 21, ingredientId: 7, quantity: "2", unitId: 3, expireAt: "2026-09-21" });
  await createBatch({ id: 22, ingredientId: 7, quantity: "5", unitId: 3, expireAt: "2026-09-25" });

  const result = await service.consumeFridgeStock(userId, "90001", {
    ingredientId: 7, exactQuantity: "6", exactUnitId: 3
  });
  assert.deepEqual(result.allocations, [
    { batchId: 21, quantity: "2", unitId: 3 },
    { batchId: 22, quantity: "4", unitId: 3 }
  ]);
  assert.equal(result.detail.activeBatches.find(batch => batch.id === 21)?.available, false);

  await assert.rejects(
    service.consumeFridgeStock(userId, "90002", { ingredientId: 7, exactQuantity: "2", exactUnitId: 4 }),
    /数量待确认|单位/
  );
  assert.equal(await readQuantity(22), "1");
});
```

- [x] **Step 2: 运行写入测试确认先失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.inventory-write.test.ts`

Expected: FAIL because `consumeFridgeStock` and allocation response do not exist.

- [x] **Step 3: 将现有 create 语义固定为“只创建新批次”。**

校验最终食材身份、正数 `Decimal`、单位属于系统单位、数量/单位成对出现；保留 `quantityText` 作为旧数据/模糊数量事实，但新的可自动扣减批次必须有结构化数量。创建时不查询或更新旧批次，存储 ledger 为新行建立记录，幂等 key 重试返回同一批次结果，重用 key 提交不同 hash 返回冲突。

- [x] **Step 4: 实现事务内 FEFO 扣减。**

按 `ingredientId/userId/available` 读取候选批次和活动预占，按到期日、创建时间、ID 排序；过期批次不跳过。先在内存计算完整 allocation，数量不足或无可靠单位比较时先抛错，再用 `updateMany({ where: { id, version, available: true }, data: { exactQuantity: { decrement }, available: 0 时 false, consumedAt: 0 时 now, version: { increment: 1 } } })` 逐行更新并校验受影响行数，任何并发版本冲突都让事务回滚。预占数量必须从可扣减数量中排除；不允许扣减导致负数。

- [x] **Step 5: 让旧 itemIds 消耗入口兼容地转发到统一服务。**

只有仍有结构化数量且来自同一食材的旧批次 ID 集合可以转成一笔明确总量扣减；批次选择不能再由客户端决定。对旧入口无法安全转换的请求返回“数量待确认”，不要静默整行作废。详情页与后续做菜入口只调用食材总量接口。

- [x] **Step 6: 运行 focused tests、Prisma 校验和 API build。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.inventory-write.test.ts src/modules/pantry/pantry.inventory-contract.test.ts`

Run: `pnpm --filter @next-meal/api exec prisma validate`

Run: `pnpm build:api`

Expected: PASS；失败时只修本任务涉及的契约/实现，不通过放宽数量校验来掩盖失败。

### Task 4: 迁移采购完成及其他真实库存入口

**Files:**
- Modify: `apps/api/src/modules/pantry/pantry.service.ts:completeShoppingList`
- Modify: `apps/api/src/modules/meal/meal.service.ts`（仅在存在明确消耗入口时）
- Modify: `apps/api/src/modules/pantry/pantry.controller.ts`（若新增做菜消耗路由）
- Modify: `apps/api/src/contracts/types.ts`、`apps/api/src/contracts/dtos.ts`、`apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/modules/pantry/pantry.inventory-write.test.ts`
- Modify: `docs/api-contract.md`（采购完成/真实扣减边界）

**Interfaces:**
- Consumes: Task 3 的 `createFridgeBatchInTx()`、`consumeFridgeStockInTx()`；采购清单预占记录。
- Produces: 采购完成对每个已勾选并选择入库的项目创建独立批次；做菜或明确消耗入口使用统一总量扣减；“应用库存”仍只建立/撤销预占。

- [ ] **Step 1: 写失败测试确保采购完成创建多批次且来源/到期日不互相覆盖。**

```ts
it("settles each bought shopping entry as a separate fridge batch", async () => {
  const result = await service.completeShoppingList(userId, listId, operationId, version, [
    { itemId: 31, store: true, quantityText: "500 克", expireAt: "2026-09-22T00:00:00.000Z" },
    { itemId: 32, store: true, quantityText: "2 个", expireAt: "2026-09-25T00:00:00.000Z" }
  ]);
  const rows = await readFridgeRows(listId);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0]?.id, rows[1]?.id);
  assert.deepEqual(rows.map(row => row.sourceShoppingItemId).sort(), [31, 32]);
});
```

- [ ] **Step 2: 运行测试确认当前入口行为不足。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.shopping-inventory.test.ts`

Expected: FAIL until the entry calls the shared batch creator and the test fixture exposes both rows.

- [x] **Step 3: 抽取事务内共享写入函数并改造采购完成。**

采购完成事务先结算预占，再为每条入库项调用共享批次创建函数；不能把预占直接改成扣减，也不能把两条同食材采购项合并成一行。保留来源字段、备注、结构化数量和到期日。

- [x] **Step 4: 盘点做菜入口并只迁移已有明确消耗语义。**

若代码中不存在“完成做菜/消耗食材”的真实写入入口，本任务只补契约说明，不新增猜测性路由；若存在，则将其改为提交食材总量并调用共享扣减函数。随机菜单、缺口预览、库存预占和“冰箱里有”推荐只读当前食材身份，不得因为列表聚合而返回批次 ID。

- [ ] **Step 5: 运行 pantry/meal focused tests 和 API build。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/pantry/pantry.shopping-inventory.test.ts src/modules/pantry/pantry.recipe-kind.test.ts`

Run: `pnpm build:api`

Expected: PASS；预占相关已有测试保持原语义。

### Task 5: 改造客户端 API、食材列表和详情页交互

**Files:**
- Modify: `apps/client/src/pages_pantry/apis/fridge.ts`
- Modify: `apps/client/src/apis/fridge.ts`
- Modify: `apps/client/src/pages_pantry/index/index.vue`
- Modify: `apps/client/src/pages_pantry/item-detail/index.vue`
- Modify: `apps/client/src/pages_pantry/item-edit/index.vue`（新增库存改为创建批次，不编辑旧批次总量）
- Modify: `apps/client/src/pages_pantry/item-detail/style.test.ts`
- Modify: `apps/client/src/pages_pantry/error-empty-state.test.ts`（若文案/加载态选择器受影响）
- Create: `apps/client/src/pages_pantry/inventory-batch-contract.test.ts`
- Modify: `apps/client/src/pages_pantry/item-image-layout.test.ts`（若图片参数改用食材身份）

**Interfaces:**
- Consumes: Task 2/3 的食材摘要、详情、历史、create/consume API。
- Produces: 列表一食材一卡；详情以 `ingredientId` 加载；新增库存新建批次；扣减只输入总量；过期批次默认折叠，历史批次默认折叠并点击加载。

- [x] **Step 1: 先写客户端源码契约测试。**

```ts
it("uses ingredient identity for cards and keeps the detail hero inside scroll content", () => {
  const listSource = readFileSync(resolve(__dirname, "index/index.vue"), "utf8");
  const detailSource = readFileSync(resolve(__dirname, "item-detail/index.vue"), "utf8");
  assert.match(listSource, /card\.ingredientId/);
  assert.doesNotMatch(listSource, /card\.id.*item-detail/);
  assert.match(detailSource, /fridgeApi\.getDetail\(/);
  assert.match(detailSource, /class="detail-content-scroll"[\s\S]*class="detail-hero"/);
  assert.doesNotMatch(detailSource, /fridgeApi\.consume\(\[currentItem\.value\.id\]/);
  assert.match(detailSource, /扣减数量/);
});
```

- [x] **Step 2: 运行客户端测试确认旧页面行为被捕获。**

Run: `pnpm --filter @next-meal/client exec tsx src/pages_pantry/inventory-batch-contract.test.ts && pnpm --filter @next-meal/client exec tsx src/pages_pantry/item-detail/style.test.ts`

Expected: FAIL because the list still keys cards by batch ID, detail still loads `fridgeApi.list()` and the Hero is outside `scroll-view`.

- [x] **Step 3: 更新客户端 API 类型和 normalized response。**

列表 card 使用 `ingredientId`；同食材同单位数量直接展示服务端汇总，多单位展示服务端的分段文案。详情加载 `fridgeApi.getDetail(ingredientId)`，新增使用 `fridgeApi.create()`，扣减使用 `fridgeApi.consume({ ingredientId, exactQuantity, exactUnitId })`，历史展开调用 `getHistory()`，所有写入生成新 operation ID。

- [x] **Step 4: 改造食材列表为摘要列表。**

删除客户端按批次行再去重的临时逻辑，直接消费服务端食材摘要；`PantryCard.id` 改为最终食材身份，点击参数改为 `ingredientId`。保留库存、到期、预占等必要提醒，弱化/移除卡片上批次级编辑操作，补货入口创建新批次。

- [x] **Step 5: 改造详情页信息层级和批次操作。**

把 `detail-hero`、summary card、批次内容放进同一个 `scroll-view`；导航 backdrop 仍 fixed，但 Hero 不 fixed。移除 `summary-card__description` 中与 warning badge 相同的到期文案，详情首屏只保留一个到期醒目表达。当前批次按 FEFO 展示，过期但有库存批次放入默认收起的“已过期库存”；已用完批次放入默认收起的“历史批次”，点击再查全部历史。将“快速扣减当前库存”改成数量 sheet，支持结构化数量和单位，不出现批次选择。

- [x] **Step 6: 让 item-edit 只负责新增批次，保留旧深链兼容。**

从详情“新增库存/补货”进入时走 create；旧批次编辑入口只显示批次信息并引导“新增一批”或仍按明确批次元数据修改，不能把多批次总量覆盖回一条行。详情入参是 ingredient ID，旧 `itemId` 入参先反查并转到食材详情。

- [x] **Step 7: 运行客户端 focused tests 和 type-check。**

Run: `pnpm --filter @next-meal/client exec tsx src/pages_pantry/inventory-batch-contract.test.ts && pnpm --filter @next-meal/client exec tsx src/pages_pantry/item-detail/style.test.ts && pnpm --filter @next-meal/client exec tsx src/pages_pantry/item-image-layout.test.ts && pnpm --filter @next-meal/client exec tsx src/pages_pantry/error-empty-state.test.ts`

Run: `pnpm type-check`

Expected: PASS；与本功能无关的用户/推荐改动失败要与本功能结果分开报告。

### Task 6: 文档、迁移核对和真实 API/页面验收

**Files:**
- Modify: `docs/api-contract.md`（库存接口完整新契约）
- Modify: `docs/ingredient.md`
- Modify: `docs/plans/minor_change_log.md`
- Create: `docs/plans/fridge-inventory-batch-execution.md`
- Modify: `apps/api/src/modules/pantry/pantry.inventory-audit.test.ts`
- Modify: `apps/api/src/modules/pantry/pantry.inventory-contract.test.ts`
- Modify: `apps/api/src/modules/pantry/pantry.inventory-write.test.ts`

**Interfaces:**
- Consumes: Tasks 1-5 的已验证代码、migration（如有）、focused test 输出和真实 API 环境。
- Produces: 可复核的执行记录，清楚区分静态测试、真实 API、微信 DevTools/设备验收和仍未完成的生产迁移。

- [x] **Step 1: 按 `docs/api-database-rules.md` 完成 schema/migration pre-commit checklist。**

核对 owner、最小数据、非负数量、正数版本、外键、`user_id + ingredient_id + available` 和到期排序索引、迁移前审计、回滚策略。若现有表和索引已经足够，不创建空 migration；如果必须增加约束/索引，在 migration SQL 中使用明确的 `CHECK`/`CREATE INDEX`，并用 Prisma validate 验证。

- [x] **Step 2: 完善 focused 回归测试。**

至少固定以下断言：一食材一卡、多批次详情、别名同一 ID、不安全旧数据不猜测、过期可扣减、FEFO 跨批次、超量回滚、单位不可比较回滚、幂等重试、采购预占不等于真实扣减、历史批次展开和 15 天只影响展示。

- [x] **Step 3: 执行静态验证。**

Run: `pnpm --filter @next-meal/api exec prisma validate`

Run: `find src/modules/pantry -maxdepth 1 -name '*.test.ts' -print0 | xargs -0 pnpm exec tsx --test`

Run: `find src/pages_pantry -type f \( -name '*.test.ts' -o -name '*.test.js' \) -print0 | xargs -0 -n 1 pnpm exec tsx`

Run: `pnpm type-check`

Run: `git diff --check`

- [ ] **Step 4: 执行真实 API 验收。**

使用测试用户连续创建同一食材两批次，确认列表一项、详情两批；新增第三批不覆盖前两批；扣减跨批次并检查 allocation；用过期但仍有量的批次扣减；超量请求后读取确认所有批次数量未变；展开历史确认 15 天边界只影响展示查询。记录请求路径、响应摘要和环境，不把 HTTP 可达性当成微信页面验收。

- [ ] **Step 5: 执行客户端页面验收。**

在客户端运行环境确认 Hero 随滚动、导航仍渐变固定、到期文案不重复、过期批次默认收起、历史点击加载、详情新增/扣减不出现批次选择。若只能完成静态或浏览器验收，明确标记微信 DevTools/真机未完成。

- [x] **Step 6: 更新独立执行单与 central log，并做范围自检。**

执行单记录实际文件、测试输出、真实接口验收和剩余风险；`minor_change_log.md` 只追加本次总结。最终按 AGENTS 要求回答：每个文件为何必需、哪些诱人后续没有加入、哪些抽象被拒绝、是否还能缩小 diff。提交前再次检查 `git status --short`，不纳入工作区现有用户修改。

## Self-Review Checklist

- [x] 设计文档的所有核心规则都有对应 Task：列表去重、详情批次、别名/归并、FEFO、过期可用、历史折叠、15 天展示、统一新增/扣减、采购预占分离。
- [x] 全文没有以 `TBD`、`TODO` 或“写测试即可”代替实际接口、文件和验证命令。
- [x] Task 2 定义的 `FridgeIngredientSummary`、`FridgeIngredientDetail`、`FridgeBatchSummary` 和 Task 3 的 `consumeFridgeStock` 在后续任务中名称一致。
- [x] 没有新增库存主从食材树、通用权限中心、OCR、AI 或其他未确认范围。
- [x] 没有把 `available = false` 解释成过期；过期与生命周期始终分离。
- [x] 没有把购物预占直接转成实际扣减。
