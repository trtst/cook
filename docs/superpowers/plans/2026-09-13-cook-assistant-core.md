# 做饭助手第一阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不接正式 AI 和会员门禁的前提下，交付单菜 Wiki 助手、本餐共享快照、个人永久解锁、活动期每日 2 次，以及与助手完全独立的按菜谱做饭路径。

**Architecture:** 固定菜谱版本上的 `READY` Wiki 和计划餐次上的成功本餐快照是共享内容；新增用户级解锁事实承接每日次数与永久查看权。Recipe、Meal、User 路由继续归各自模块，新的 `CookAssistantAccessService` 只集中处理活动日、次数、解锁和幂等短事务，不扩成会员或通用权益中心。长时间内容生成不进入数据库事务；第一阶段使用现有可验证规则生成本餐快照，只消费已验证 Wiki，不实现正式 AI。

**Tech Stack:** NestJS、Prisma/PostgreSQL、TypeScript、Vue 3、uni-app、Pinia、OpenAPI、Node test、mp-weixin。

**Specs:**

- `docs/plans/meal-assistant-execution.md`
- `docs/plans/recipe-wiki-execution.md`
- `docs/api-contract.md`
- `docs/api-database-rules.md`

## Global Constraints

- 按菜谱做饭永久免费，只读原始步骤，不读取 Wiki、不生成快照、不扣次数。
- 普通菜谱详情只返回 `assistantAvailable`，绝不内嵌 Wiki JSON。
- 单菜助手绑定固定 `RecipeContentVersion`；本餐助手绑定 `MealPlanItem`，计划和关联饭局复用同一目标。
- 每位用户每天最多首次解锁 2 份，单菜与本餐共用，当日清零、不累计；解锁后永久可看。
- 同一用户对同一目标只能有一条解锁事实；同一本餐只能有一份新契约成功快照。
- `INVITED / ACCEPTED` 可访问关联饭局助手；`DECLINED / REMOVED` 不可访问。角色不改变助手内容或扣次规则。
- 单菜无 `READY` Wiki 不提供助手；本餐部分缺失可标记 `ORIGINAL` 降级，全部缺失不生成。
- 旧本餐快照不得继承为新结果；新契约成功后不可覆盖，不暴露 `isStale` 或重生成入口。
- 首次“思考 Loading”由客户端展示，不能用服务端 sleep 模拟。
- 第一阶段不接会员、购买次数、正式 AI、Worker 批处理、个性化编排或通用权限/权益中心。
- 保留无关未提交改动；完成每个可交付切片后更新 `docs/plans/minor_change_log.md`，未经用户授权不提交 Git。

---

### Task 1: 冻结数据库事实与前向 migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260913100000_cook_assistant_unlocks/migration.sql`
- Create: `apps/api/src/modules/cook-assistant/cook-assistant-schema.test.ts`
- Create: `apps/api/scripts/backfill-recipe-wiki-readiness.ts`
- Create: `apps/api/scripts/backfill-recipe-wiki-readiness.test.ts`

**Data contract:**

- `RecipeAssistantStatus = PENDING | GENERATING | NEEDS_REVIEW | READY | FAILED`。
- `RecipeCookAssistant` 区分候选 JSON 与可用 `snapshotJson`；只有 `READY + snapshotJson != null` 可供前台读取。历史规则型快照先转为候选并标记 `NEEDS_REVIEW`，不得直接继承为可用 Wiki。
- `MealPlanCookAssistant` 保留现有 `snapshot` 为只读 legacy 字段，另增新契约快照、生成状态和 `contractVersion`；旧数据回填为旧契约版本，新读取只认当前契约版本。第一次生成新契约内容时写新字段，不覆盖 legacy JSON。
- 新增 `CookAssistantUnlock`：`userId`、可空 `recipeVersionId / planItemId`、`unlockedOn`、`unlockedAt`；真实外键 `onDelete: Cascade`。
- 数据库 Check 保证两个目标恰好一个非空；分别保证 `(userId, recipeVersionId)` 与 `(userId, planItemId)` 唯一。
- 为用户活动日统计建立 `(userId, unlockedOn)` 索引。
- 为 `IdempotencyRecord` 补三个数据库唯一索引：用户无饭局作用域 `(operationId, operationType, userId)` 的部分唯一索引、用户有饭局作用域 `(operationId, operationType, userId, diningGroupId)` 的部分唯一索引、后台作用域 `(operationId, operationType, adminId)` 的部分唯一索引，防止 nullable 列绕过唯一性。
- 数据库 Check 保证 `RecipeCookAssistant` 只有 `READY` 可以携带前台可用快照，且 `READY` 必须同时具备快照和生成时间。

- [x] **Step 1: 写失败的 schema 契约测试。** 读取 Prisma schema 和 migration，断言五态枚举、解锁表、两个目标外键、XOR Check、两组目标唯一索引、活动日索引和幂等唯一索引存在。

- [x] **Step 2: 证明测试失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/cook-assistant/cook-assistant-schema.test.ts`

Expected: FAIL，因为当前只有 `READY / FAILED`，没有个人解锁事实和数据库唯一兜底。

- [x] **Step 3: 做迁移前只读审计。** 查询现有 `idempotency_records` 是否存在目标唯一键重复、历史脱钩饭局数量、旧本餐快照数量和无快照 `RecipeCookAssistant` 数量。发现重复数据时停止并报告，不在 migration 中静默删除或猜测保留项。

- [x] **Step 4: 实现 schema 和前向 migration。** 不修改历史 migration。旧本餐 JSON 留在 legacy 字段并标记旧契约版本；旧单菜规则快照移入候选并标记 `NEEDS_REVIEW`，不得在 SQL 中猜测其已验证。候选字段与可用快照字段保持独立。

- [x] **Step 5: 实现显式 Wiki readiness 回填脚本。** 默认 dry-run，按固定版本运行与前台相同的确定性验证，输出 `READY / NEEDS_REVIEW` 计数和阻断原因；只有 `--apply` 才把通过项发布为可用快照。脚本不得调用 AI，也不得复制旧结果到新菜谱版本。

- [x] **Step 6: 验证数据库定义和回填脚本。**

Run: `pnpm --filter @next-meal/api exec prisma validate --schema prisma/schema.prisma`

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/cook-assistant/cook-assistant-schema.test.ts`

Run: `pnpm --filter @next-meal/api exec tsx --test scripts/backfill-recipe-wiki-readiness.test.ts`

Expected: PASS；Prisma 关系和 SQL 约束一致。

### Task 2: 活动配置、用量与原子解锁服务

**Files:**

- Create: `apps/api/src/modules/cook-assistant/cook-assistant.config.ts`
- Create: `apps/api/src/modules/cook-assistant/cook-assistant-access.service.ts`
- Create: `apps/api/src/modules/cook-assistant/cook-assistant-access.service.test.ts`
- Create: `apps/api/src/modules/cook-assistant/cook-assistant.module.ts`
- Modify: `apps/api/src/modules/app.module.ts`
- Modify: `apps/api/src/modules/user/user.module.ts`
- Modify: `apps/api/src/modules/user/user.controller.ts`
- Modify: `apps/api/src/modules/app-config/app-config.service.ts`
- Modify: `apps/api/src/modules/app-config/app-config.service.test.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`

**Interfaces:**

- Produces `AppConfigResponse.cookAssistant` with `activityEnabled / startsAt / endsAt / timeZone / dailyUnlockLimit / tipText`。
- Produces `GET /users/me/cook-assistant-usage`。
- Produces feature-local methods to read an existing unlock and atomically create the first unlock under a per-user/per-business-day advisory lock.

- [x] **Step 1: 写失败的配置与解锁测试。** 覆盖活动关闭、上海活动日边界、每日 2 次、单菜和本餐共池、昨日记录不占今日额度、同一目标重复不扣次、第三个不同目标被拒绝、解锁事实永久保留。

- [x] **Step 2: 补并发和幂等测试。** 两个并发的不同目标在只剩 1 次时只能成功一个；同一目标并发只产生一条解锁；同一 `Idempotency-Key` 重试返回第一次结果；相同键用于不同目标返回冲突。

- [x] **Step 3: 证明测试失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/app-config/app-config.service.test.ts src/modules/cook-assistant/cook-assistant-access.service.test.ts`

Expected: FAIL，因为公开配置没有助手活动，且没有解锁服务。

- [x] **Step 4: 实现最小服务。** 活动参数集中在 feature-local config，不写进会员模块。`getUsage` 按服务端时区返回当前业务日。最终扣次事务顺序固定为：取得用户活动日 advisory lock -> 重查目标解锁 -> 校验活动和当日计数 -> 写解锁 -> 完成幂等记录。

- [x] **Step 5: 接入公开配置和用户用量路由。** `GET /app-config` 不返回个人用量；`GET /users/me/cook-assistant-usage` 不返回会员信息、历史解锁列表或余额。

- [x] **Step 6: 证明测试通过。** 运行 Step 3 命令，并执行 `pnpm --filter @next-meal/api type-check`。

### Task 3: 单菜 Wiki 门禁与个人解锁

**Files:**

- Modify: `apps/api/src/modules/recipe/recipe.module.ts`
- Modify: `apps/api/src/modules/recipe/recipe.controller.ts`
- Modify: `apps/api/src/modules/recipe/recipe.service.ts`
- Modify: `apps/api/src/modules/recipe/recipe-content.ts`
- Modify: `apps/api/src/modules/recipe/recipe-wiki.ts`
- Modify: `apps/api/src/modules/recipe/recipe-wiki.test.ts`
- Create: `apps/api/src/modules/recipe/recipe-cook-assistant.service.test.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/scripts/verify-recipe-flow.ts`
- Modify: `apps/api/scripts/verify-meal-assistant-flow.ts`

**Interfaces:**

- Produces `assistantAvailable` on `MyRecipeDetail / CollectedRecipeDetail / InspirationRecipeDetail`。
- Produces `GET /recipe-versions/:recipeVersionId/cook-assistant`。
- Produces `POST /recipe-versions/:recipeVersionId/cook-assistant/unlock` with empty strict DTO and numeric-string `Idempotency-Key`。
- Removes the new-contract use of `POST /recipes/:recipeId/assistant` and membership-gated on-demand generation.

- [x] **Step 1: 写失败的详情合同测试。** 断言三类详情都只返回 `assistantAvailable`，不会出现 `assistant`；只有 `READY` 且可用快照存在时为 `true`。

- [x] **Step 2: 写失败的单菜读取/解锁测试。** 覆盖本人菜谱、可见灵感、有效收藏固定版本、隐藏/下架对象、无 Wiki、未解锁正文隐藏、首次解锁扣 1 次、重复读取不扣次和新菜谱版本独立解锁。

- [x] **Step 3: 写发布解耦测试。** 用户发布新固定版本只登记 `PENDING`，不调用生成器；派生失败不回滚发布。现有可验证导入路径只能在完成质量门禁后写 `READY`。

- [x] **Step 4: 证明测试失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/recipe/recipe-wiki.test.ts src/modules/recipe/recipe-cook-assistant.service.test.ts`

Expected: FAIL，因为详情仍返回助手 JSON，旧写接口受会员限制且发布链路会同步生成。

- [x] **Step 5: 实现固定版本权限与 READY 门禁。** 服务端先校验调用者能否访问固定版本，再检查 Wiki；未解锁只返回元数据。禁止用 recipe 当前版本替换请求中的固定 `recipeVersionId`。

- [x] **Step 6: 实现首次解锁。** Wiki 已经 READY 才调用 Task 2 的原子解锁；失败、无 Wiki、活动关闭或次数不足都不得写解锁。返回 `newlyUnlocked` 供客户端决定是否展示首次 Loading。

- [x] **Step 7: 更新 OpenAPI 与验证脚本并运行。**

Run: `pnpm --filter @next-meal/api verify:recipe-flow`

Run: `pnpm --filter @next-meal/api type-check`

Expected: 目标接口、DTO 与文档一致；普通详情响应中没有 Wiki JSON。

### Task 4: 本餐原始上下文、共享快照与饭局权限

**Files:**

- Modify: `apps/api/src/modules/meal/meal.module.ts`
- Modify: `apps/api/src/modules/meal/meal.controller.ts`
- Modify: `apps/api/src/modules/meal/meal.service.ts`
- Modify: `apps/api/src/modules/meal/meal.service.test.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/scripts/verify-meal-assistant-flow.ts`
- Modify: `apps/api/scripts/verify-dining-event-flow.ts`

**Interfaces:**

- Produces `GET /meal-plans/:planItemId/cook-context`，只含当前菜单固定版本与原始步骤。
- Produces `GET /meal-plans/:planItemId/cook-assistant`，分开返回内容状态和当前用户解锁状态。
- Produces `POST /meal-plans/:planItemId/cook-assistant/unlock`，首次生成或复用共享快照，并在成功后解锁当前用户。

- [x] **Step 1: 写失败的访问矩阵测试。** 覆盖计划 owner、饭局 owner、`INVITED`、`ACCEPTED`、`DECLINED`、`REMOVED` 和陌生用户。脱钩历史饭局不提供助手；关联饭局存在时物理删除计划被数据库关系阻止。

- [x] **Step 2: 写失败的原始上下文测试。** 断言 `cook-context` 使用计划当前 `MealPlanDish.recipeVersionId`，返回每道菜自己的原始步骤，不读取 `RecipeCookAssistant`，也不扁平化成整桌流程。

- [x] **Step 3: 写失败的共享快照测试。** 覆盖首次生成、他人复用同一 JSON 但独立扣次、部分无 Wiki 时冻结 `ORIGINAL` 来源、全部无 Wiki 失败不扣次、旧契约快照不继承、并发只产生一份新契约成功快照。

- [x] **Step 4: 写不可变测试。** 成功生成后修改菜单、切换菜谱版本或补齐 Wiki，再次读取仍返回原快照和原生成时间；写接口不得覆盖，也不返回 `isStale`。

- [x] **Step 5: 证明测试失败。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/meal/meal.service.test.ts`

Expected: FAIL，因为当前只允许计划 owner、按会员补洞、覆盖 upsert，并暴露 `isStale`。

- [x] **Step 6: 实现访问解析和原始上下文。** 统一从 `planItemId` 解析 owner 与关联饭局参与状态；禁止仅凭参与者行存在就放行。不要新增 event 版助手接口或第二份饭局快照。

- [x] **Step 7: 实现内容生成状态机。** 用当前已确认规则把 `READY` Wiki 和必要原始步骤整理为三阶段快照；长计算在事务外进行，唯一内容任务负责 `GENERATING -> READY / FAILED`。成功写入使用“仅当不存在当前契约 READY 快照”条件，不使用覆盖 upsert。

- [x] **Step 8: 完成个人解锁短事务。** 内容 READY 后调用 Task 2 服务；若用户并发耗尽次数，只保留共享内容，不授予解锁。响应只有在当前用户已解锁时才包含 `assistant`。

- [x] **Step 9: 更新 OpenAPI 和真实流程验证。**

Run: `pnpm --filter @next-meal/api verify:meal-assistant-flow`

Run: `pnpm --filter @next-meal/api verify:dining-event-flow`

Run: `pnpm --filter @next-meal/api type-check`

### Task 5: 小程序请求层、活动提示与单菜助手

**Files:**

- Modify: `apps/client/src/apis/app-config.ts`
- Modify: `apps/client/src/stores/app-config.ts`
- Modify: `apps/client/src/stores/app-config.test.ts`
- Modify: `apps/client/src/apis/recipe.ts`
- Modify: `apps/client/src/apis/recipe-summary.test.ts`
- Modify: `apps/client/src/pages_recipe/detail/index.vue`
- Modify: `apps/client/src/pages_recipe/detail/index.test.js`
- Modify: `apps/client/src/pages_recipe/edit/index.vue`
- Modify: `apps/client/src/pages_recipe/edit/index.test.js`
- Create: `apps/client/src/pages_recipe/assistant/index.vue`
- Create: `apps/client/src/pages_recipe/assistant/index.test.js`
- Modify: `apps/client/src/pages.json`

**Interfaces:**

- Consumes `AppConfigResponse.cookAssistant` and the single-recipe assistant endpoints.
- Produces the single-recipe entry beside the existing bottom-Bar “计划” action, only when `assistantAvailable=true`。
- Produces a single-recipe assistant page with activity Tips, one-time random Loading, generated time and `PREP / COOK / SERVE` phases.

- [x] **Step 1: 写失败的 API/store 测试。** 断言活动配置完整保存，接口使用固定 `recipeVersionId`，unlock 带数字字符串幂等键，详情类型不再包含 `assistant`。

- [x] **Step 2: 写失败的详情与发布测试。** 把现有不可达的 `openCookMode` 接到免费“按菜谱做饭”入口；有 `READY` Wiki 才在计划旁出现“做饭助手”。无 Wiki 只保留免费做饭和计划入口，不在详情加载时预取 Wiki。发布成功不再按会员弹出或调用助手生成。

- [x] **Step 3: 写失败的助手页状态测试。** 覆盖未解锁有次数、次数耗尽、首次成功 Loading、刷新已解锁不 Loading、活动关闭、Wiki 不可用、错误重试和生成时间。

- [x] **Step 4: 证明测试失败。**

Run: `pnpm --filter @next-meal/client exec tsx src/stores/app-config.test.ts`

Run: `pnpm --filter @next-meal/client exec tsx src/apis/recipe-summary.test.ts`

Run: `pnpm --filter @next-meal/client exec tsx src/pages_recipe/detail/index.test.js`

Run: `pnpm --filter @next-meal/client exec tsx src/pages_recipe/edit/index.test.js`

Run: `pnpm --filter @next-meal/client exec tsx src/pages_recipe/assistant/index.test.js`

- [x] **Step 5: 实现最小页面。** 随机 Loading 只在 `newlyUnlocked=true` 时启动，时长由客户端有限区间随机；页面退出不撤销服务端解锁。步骤图片使用 Wiki 已有 URL，不复制资源。

- [x] **Step 6: 运行聚焦测试与类型检查。** 执行 Step 4 命令及 `pnpm --filter @next-meal/client type-check`。

### Task 6: 小程序本餐助手与多菜谱沉浸模式

**Files:**

- Modify: `apps/client/src/apis/meal.ts`
- Modify: `apps/client/src/pages_meal/apis/meal.ts`
- Modify: `apps/client/src/pages_recipe/apis/meal.ts`
- Modify: `apps/client/src/pages_home/apis/meal.ts`
- Modify: `apps/client/src/pages_pantry/apis/meal.ts`
- Modify: `apps/client/src/pages_share/apis/meal.ts`
- Modify: `apps/client/src/pages_meal/detail/index.vue`
- Modify: `apps/client/src/pages_meal/detail/index.test.js`
- Modify: `apps/client/src/pages_meal/event/index.vue`
- Modify: `apps/client/src/pages_meal/event/index.test.js`
- Modify: `apps/client/src/pages_meal/assistant/index.vue`
- Modify: `apps/client/src/pages_meal/assistant/index.test.js`
- Modify: `apps/client/src/pages_meal/cook-mode/index.vue`
- Modify: `apps/client/src/pages_meal/cook-mode/index.test.js`
- Modify: `apps/client/src/pages_share/preview/index.vue`
- Create: `apps/client/src/pages_share/preview/cook-assistant-routing.test.ts`
- Modify: `apps/client/src/test-utils/meal-assistant-fixture.js`

**Interfaces:**

- Consumes the new meal `cook-context / cook-assistant / unlock` endpoints.
- Produces the same assistant entry and rules for plan owner and eligible dining participant.
- Produces original multi-recipe cooking as “menu header -> selected dish -> that dish's steps”, without automatic whole-table compilation.

- [x] **Step 1: 写失败的本餐 API 与入口测试。** 删除旧 generate/re-generate 调用和 `isStale` 分支；owner 与 eligible participant 都能进入，同一 `planItemId` 是唯一助手目标。分享预览进入关联饭局时保留服务端返回的 `planItemId`；历史脱钩饭局不伪造目标或展示助手入口。

- [x] **Step 2: 写失败的助手页状态测试。** 覆盖 `NOT_GENERATED / GENERATING / READY / FAILED`，个人未解锁/已解锁、他人已生成但我首次查看仍扣次并 Loading、部分原始步骤来源标识、生成时间和次数不足。

- [x] **Step 3: 写失败的沉浸模式测试。** Header 平铺菜单；左右切换菜品与菜内步骤；只消费 `cook-context` 原始步骤；不加载助手、不显示 assistant/original 双模式切换。

- [x] **Step 4: 证明测试失败。**

Run: `pnpm --filter @next-meal/client exec tsx src/pages_meal/detail/index.test.js`

Run: `pnpm --filter @next-meal/client exec tsx src/pages_meal/event/index.test.js`

Run: `pnpm --filter @next-meal/client exec tsx src/pages_meal/assistant/index.test.js`

Run: `pnpm --filter @next-meal/client exec tsx src/pages_meal/cook-mode/index.test.js`

Run: `pnpm --filter @next-meal/client exec tsx src/pages_share/preview/cook-assistant-routing.test.ts`

Expected: FAIL，因为当前参与者入口受限、助手可重生成、做饭模式会混合并扁平化来源。

- [x] **Step 5: 实现页面迁移。** 活动 Tips 使用服务端文案；正文仅在 `unlocked=true` 时渲染。共享快照已存在也必须先走当前用户 unlock。原始模式保留每道菜自己的进度，不把助手进度混入。

- [x] **Step 6: 运行聚焦测试与类型检查。** 执行 Step 4 命令及 `pnpm --filter @next-meal/client type-check`。

### Task 7: 后台 Wiki 状态兼容与第一阶段验收

**Files:**

- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Create: `apps/api/src/modules/admin/admin.recipe-assistant.service.test.ts`
- Modify: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`
- Modify: `apps/api/src/modules/admin/recipe-import-json.ts`
- Modify: `apps/api/src/modules/admin/recipe-import-json.test.ts`
- Modify: `apps/api/scripts/verify-recipe-import-json-flow.ts`
- Modify: `apps/admin/src/apis/recipe.ts`
- Modify: `apps/admin/src/pages/RecipeDetailPage.vue`
- Create: `apps/admin/src/pages/recipe-detail-assistant.test.js`
- Modify: `docs/api-contract.md`
- Modify: `docs/plans/meal-assistant-execution.md`
- Modify: `docs/plans/recipe-wiki-execution.md`
- Modify: `docs/plans/minor_change_log.md`

**Interfaces:**

- Admin correctly displays `PENDING / GENERATING / NEEDS_REVIEW / READY / FAILED` and candidate/snapshot distinction.
- First-phase docs and OpenAPI match the actual delivered implementation; second-phase AI remains explicitly blocked.

- [x] **Step 1: 写失败的后台状态与导入测试。** 覆盖五态文案、只有 READY 显示“前台可用”、NEEDS_REVIEW 显示待人工处理、重试不宣称覆盖成功快照。导入 JSON 中的 Wiki 先按候选验证，只有完整通过质量门禁后才能发布为 READY；失败不得回滚基础菜谱发布。

- [x] **Step 2: 实现最小后台兼容。** 只调整现有菜谱详情与状态展示，不新增批量 AI 页面、通用任务中心或运营权限矩阵。

- [x] **Step 3: 跑聚焦测试。**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/admin/admin.recipe-assistant.service.test.ts src/modules/admin/admin.recipe-import.service.test.ts src/modules/admin/recipe-import-json.test.ts`

Run: `node apps/admin/src/pages/recipe-detail-assistant.test.js`

Run: `pnpm --filter @next-meal/admin type-check`

Run: `pnpm --filter @next-meal/api verify:recipe-import-json`

- [x] **Step 4: 跑全量静态门禁。**

Run: `pnpm type-check`

Run: `pnpm check`

Run: `pnpm build:api`

Run: `pnpm build:client`

Run: `pnpm build:admin`

Run: `pnpm --filter @next-meal/api verify:openapi`

Run: `git diff --check`

- [x] **Step 5: 做真实 API 验收。** 用两个用户验证：同一本餐只生成一份内容、两人分别首次扣次、各自第二次进入不扣、第三个不同目标当日被拒绝；验证生成失败不扣次、无 Wiki 单菜无助手、部分/全部缺 Wiki 本餐边界、`DECLINED / REMOVED` 权限。

- [x] **Step 6: 做 mp-weixin 页面验收。** 在微信开发者工具或官方 automator 验证单菜入口、本餐入口、每人首次 Loading、活动 Tips、三阶段滑动、菜单 Header 与菜内步骤切换。记录尚未执行的真机、生产 migration、正式 AI、外部图片和活动结束验收门禁。

- [x] **Step 7: 文档与范围自检。** 更新中央变更日志，逐文件说明必要性；确认没有残留旧会员补洞、`isStale`、覆盖重生成、详情内嵌 Wiki 或参与者只读口径。

- [x] **Step 8: 提交授权检查。** 已检查 `git status --short`；当前未获用户提交授权，保持不提交 Git。若后续提交，仍需提交前复查 staged 文件，并按数据库/API、客户端、后台/文档拆分可审查的中文主题提交。

## 第二阶段门禁（不在本计划实施）

以下条件全部确认后，另建独立计划：

1. AI 服务商、模型、提示词版本、超时、费用预算与失败语义。
2. Worker、外部调度或后台人工触发中的唯一任务载体。
3. 当日无 Wiki 累积、历史失败补扫、重试上限和死信/人工处理规则。
4. 候选自动验证规则、人工确认权限、可用快照发布与回滚方式。
5. 生产监控、审计、成本告警和数据保留周期。

第一阶段不得为这些未知项写占位 provider、假队列或同步 AI fallback。
