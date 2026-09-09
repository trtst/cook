# 菜谱结构化理解层阶段一实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox syntax for tracking.

**目标：** 让随机一桌只消费当前活跃菜谱版本中已确认的结构标签，并在候选不足时以空菜位而非不可信推断降级。

**架构：** 在版本级标签上增加消费状态，并将既有自动标签按“可复现结构规则”与“文本猜测”重新分流。随机候选查询只读取 `CONFIRMED`，配额仅在至少生成一道菜时扣减；前端依据服务端缺失菜位渲染空卡，不读取标签来源或状态。

**技术栈：** NestJS、Prisma/PostgreSQL、uni-app + Vue 3 + TypeScript、Node `node:test`、WeChat 开发者工具。

**规则基线：** [recipe-wiki-execution.md](./recipe-wiki-execution.md)；[random-page-execution.md](./random-page-execution.md)；[api-database-rules.md](../api-database-rules.md)。

## 当前实施记录

- 已完成代码：状态模型、受控回填与按餐次/菜位报告的覆盖检查命令、随机 `CONFIRMED` 双层门禁、全空不扣配额与进程内限流、空菜位展示及对应自动测试。
- 已补充静态范围测试：回填规则只允许 `ACTIVE` 菜谱的 `currentVersion`，覆盖检查明确区分早餐、午餐和晚餐菜位。
- 已执行测试库数据操作：按顺序应用 `20260907093000_drop_recipe_like_count` 和 `20260907100000_recipe_version_tag_status`；回填扫描 269 个活跃菜谱并重建 269 个当前版本。
- 数据范围说明：上述 269 个 ACTIVE 菜谱包含个人测试菜谱，不等于系统 Wiki 菜谱数量；现有测试菜谱不作为 Wiki 完整度或候选覆盖验收样本。后续确认已清理全部系统测试菜谱，包括 `2115 海带排骨汤`，当前系统菜谱实体数量为 0；本阶段不依赖存量系统菜谱回填。
- 后台用户菜谱接口修复：用户 `1001` 的 `id=254 海带排骨汤` 缺少个人分类，后台摘要现在按契约返回 `category: null`，不再因非空断言产生 500；固定版本和测试计划快照保留，清理系统菜谱时仅移除对应来源购物明细并置空计划中的可选 `recipeId`。
- 覆盖检查已执行但未通过：11 个餐次/菜位候选数均为 0。数据库当前有 518 条 `CONFIRMED` 标签，但 552 条 `MEAL_TYPE` 标签全部为 `CANDIDATE`，缺少可消费的确认餐次事实；未通过前不得宣称随机候选覆盖完成。
- 未完成运行时验收：真实 API 的完整/部分/全空/第 11 次全空路径，以及微信开发者工具的页面手工验收。

## 全局约束

- 只改 `ACTIVE` 菜谱的 `currentVersion`；旧固定版本、已保存计划、分享、收藏及行为历史不回写。
- `AUTO` 只有明确结构化输入与可复现规则时可写 `CONFIRMED`；标题、正文与自由文本推断一律不可进入随机候选。
- `AI` 首发不生成；`CANDIDATE / UNMAPPED / NEEDS_REVIEW` 不进入随机响应或前端。
- 安全限制继续按用户明确设置与结构化食材硬过滤，候选不足不得放宽。
- 全空生成不扣周配额；同一用户全空生成限流为 10 次 / 60 秒。
- 阶段一限流复用进程内计数器，只允许单 API 实例部署；多实例上线前必须改为共享存储限流。
- 阶段一代码不新增完整标签审核后台、AI 补全、运营补录页面、行为事实表或公共接口字段；后续 Wiki 治理规则允许运营补充用户菜谱的标签、营养和分析等派生数据，但不得修改用户正文。
- JSON 导入发布的灵感菜谱从 100 个灵感用户池中随机分配归属；用户菜谱发布后由服务端按当前正文版本生成派生数据，新版本派生数据从 `PENDING` 开始，旧版本和客观业务事实不回写。

---

### Task 1：状态模型与可信标签编译

**文件：**

- 修改：`apps/api/prisma/schema.prisma`
- 修改：`apps/api/src/modules/recipe/recipe-version-tags.ts`
- 新增：`apps/api/src/modules/recipe/recipe-version-tags.test.ts`
- 修改：`apps/api/package.json`

**接口：**

- 产生：`RecipeVersionTagStatus` 枚举及 `RecipeVersionTag.status`。
- 产生：结构化事实可验证时的 `AUTO + CONFIRMED` 标签；文本推断的 `AUTO + CANDIDATE` 标签。
- 保持：`replaceAutoRecipeVersionTags(tx, recipeVersionId, content)` 仍是版本创建后的唯一自动标签写入口。

- [x] **Step 1：写失败测试**

为标题不含蛋白关键词、但含已映射鸡蛋食材的内容断言：结构化蛋白标签可确认；为“豆浆”标题但没有对应食材事实断言：不能产生可消费早餐蛋白标签。

- [x] **Step 2：运行失败测试**

运行：`pnpm --filter @next-meal/api exec tsx --test src/modules/recipe/recipe-version-tags.test.ts`

预期：因标签行尚无 `status` 或仍将文本推断视为可用而失败。

- [x] **Step 3：实现最小编译规则和 Prisma 状态列**

新增四态枚举与非空 `status` 列；自动编译只把 `PRIMARY_INGREDIENT`、已映射主蛋白、已映射主食等能由结构化食材与食材主数据复现的结果写为 `CONFIRMED`。文本规则生成的餐次、菜位、风味、辣度保留为 `CANDIDATE`，不得作为确认事实。早餐蛋白只认可明确食材蛋白类型，禁止名称正则兜底。

- [x] **Step 4：生成 Prisma 客户端并验证测试**

运行：`pnpm --filter @next-meal/api prisma:generate && pnpm --filter @next-meal/api exec tsx --test src/modules/recipe/recipe-version-tags.test.ts`

预期：测试通过。

### Task 2：受控回填与候选覆盖检查

**文件：**

- 新增：`apps/api/scripts/backfill-confirmed-recipe-version-tags.ts`
- 新增：`apps/api/scripts/verify-random-candidate-coverage.ts`
- 新增：`apps/api/src/modules/recipe/recipe-version-tag-backfill.ts`
- 新增：`apps/api/src/modules/recipe/recipe-version-tag-backfill.test.ts`
- 新增：`apps/api/src/modules/recipe/random-candidate-coverage.ts`
- 新增：`apps/api/src/modules/recipe/random-candidate-coverage.test.ts`
- 修改：`apps/api/package.json`
- 新增：Prisma migration

**接口：**

- 产生：`pnpm --filter @next-meal/api backfill:confirmed-recipe-version-tags`，只重算活跃菜谱当前版本。
- 产生：`pnpm --filter @next-meal/api verify:random-candidate-coverage`，按早餐/午餐/晚餐及其菜位报告可信候选数，非零退出代表存在完全空的必要菜位。

- [x] **Step 1：写失败测试或脚本夹具**

增加回填范围纯逻辑测试，断言只有 `ACTIVE` 菜谱的 `currentVersion` 可进入回填，历史版本和非活跃菜谱排除；增加按早餐、午餐、晚餐分组的候选覆盖夹具，断言缺失报告点名餐次和菜位。

- [x] **Step 2：运行失败测试**

运行：`pnpm --filter @next-meal/api exec tsx --test src/modules/recipe/random-candidate-coverage.test.ts src/modules/recipe/recipe-version-tag-backfill.test.ts`

预期：先因范围选择器和按餐次覆盖输出尚未实现而失败，再由最小实现通过。

- [x] **Step 3：实现迁移、回填和检查脚本**

迁移为存量标签写入不可消费的初始状态；回填只查询 `Recipe.status = ACTIVE` 的 `currentVersionId`，在事务中使用 Task 1 的编译器重写该版本 `AUTO` 标签。覆盖检查只读取 `CONFIRMED` 标签，不以来源排序、标题或 AI 补位；发现空菜位时输出可修复的数据缺口，绝不将候选临时升为 `CONFIRMED`。

- [ ] **Step 4：验证迁移与脚本**

运行：`pnpm --filter @next-meal/api prisma:migrate -- --name recipe-version-tag-status && pnpm --filter @next-meal/api backfill:confirmed-recipe-version-tags -- --apply && pnpm --filter @next-meal/api verify:random-candidate-coverage`

预期：迁移和回填成功；覆盖检查结果作为上线门槛记录，若有空菜位则停止上线而不修改门禁。

实际结果：migration 与回填成功；覆盖检查以非零退出，原因是当前没有 `CONFIRMED` 餐次标签。需要先确定可信餐次来源，再重新回填并执行覆盖检查。

### Task 3：随机候选严格门禁与配额语义

**文件：**

- 修改：`apps/api/src/modules/meal/meal.service.ts`
- 新增：`apps/api/src/modules/meal/meal.service.test.ts`
- 修改：`apps/api/src/common/rate-limit.service.ts`（仅在需要提供当前计数或日志上下文时）

**接口：**

- 保持：`POST /random-menus/generate`、既有 DTO 与 `RandomMenuWarning`。
- 变化：仅 `items.length > 0` 时调用 `consumeRandomMenuQuota()`；全空返回未扣配额。
- 变化：当前用户在 60 秒内第 11 次全空生成返回 `code=429` 与 `retryAfterSeconds`。

- [x] **Step 1：写失败测试**

为随机标签读取和配额判断的纯函数建立最小夹具，分别断言：`CANDIDATE`、`AI` 不能作为确认标签被读取；冲突的确认单值不按来源静默选择；全空不触发配额扣减；全空限流键固定为当前用户、10 次/60 秒。

- [x] **Step 2：运行失败测试**

运行：`pnpm --filter @next-meal/api exec tsx --test src/modules/meal/meal.service.test.ts`

预期：现有来源优先逻辑会接受 AI/无状态标签，且全空仍扣额度，因此测试失败。

- [x] **Step 3：实现门禁与防刷**

候选查询和标签快照解析双重过滤 `status = CONFIRMED`；删除“来源决定可用性”的逻辑。单值确认标签冲突时保守排除该菜谱，不按来源挑选。全空响应使用当前额度快照而不扣减；在写入幂等结果前对全空结果按 `random-menu:empty:{userId}` 执行 10 次 / 60 秒进程内限流，并记录触发限流的最小运维日志。重复相同幂等键返回既有结果，不重复扣额或限流。

- [x] **Step 4：验证服务测试**

运行：`pnpm --filter @next-meal/api exec tsx --test src/modules/meal/meal.service.test.ts && pnpm --filter @next-meal/api type-check`

预期：测试和 API 类型检查通过。

### Task 4：随机页空菜位与部分菜单保存

**文件：**

- 修改：`apps/client/src/pages_meal/random/index.vue`
- 新增或修改：`apps/client/src/pages_meal/components/RandomEmptySlotCard.vue`
- 修改：`apps/client/src/pages_meal/random/index.test.js`
- 修改：`apps/client/src/pages_meal/random/style.test.ts`
- 新增：`apps/client/src/pages_meal/random/empty-slot.test.ts`

**接口：**

- 消费：既有 `slotPlan` 推导缺失菜位；服务端 `warnings` 保持既有响应语义，不新增标签状态或治理字段。
- 保持：有至少一道未移除菜时的 `planReady` 和保存计划流程。
- 产生：缺失菜位的只读空卡，文案固定为“暂无符合当前条件的可用菜谱”。

- [x] **Step 1：写失败测试**

为菜位展示模型注入一个有菜位计划、仅含部分菜谱项的结果；断言菜位列表同时保留真实菜卡和对应空菜位。页面静态测试同时断言空卡文案和全空时没有计划入口的模板门禁。

- [x] **Step 2：运行失败测试**

运行：`pnpm --filter @next-meal/client exec tsx src/pages_meal/random/empty-slot.test.ts`

预期：当前页面只遍历真实 `state.slots`，没有空菜位组件和基于 `slotPlan` 的展示模型，因此失败。

- [x] **Step 3：实现空卡与保存门禁**

按 `slotPlan` 生成预期菜位顺序，将未返回或已由服务端警告标记的菜位渲染为空卡。空卡不提供锁定、划掉、换一道或标签治理解释。全空时保持生成面板并禁止打开计划 Sheet；部分菜单保持现有至少一道菜的保存行为。替换接口返回空候选时继续保留原菜并显示既定提示。

- [x] **Step 4：验证客户端**

运行：`pnpm --filter @next-meal/client type-check && pnpm --filter @next-meal/client build:mp-weixin`

预期：类型检查与构建通过；随后在开发者工具中手动验证完整、部分、全空、替换耗尽和限流提示。

### Task 5：契约、变更记录与上线验收

**文件：**

- 修改：`docs/api-contract.md`（仅记录全空不扣配额和限流业务错误语义）
- 修改：`docs/plans/minor_change_log.md`
- 修改：`docs/plans/recipe-wiki-phase-one-execution.md`

- [x] **Step 1：更新文档为实际实现状态**

记录状态模型、回填命令、覆盖检查命令、单实例限流限制、真实验证结果和未完成的阶段二治理项。

- [ ] **Step 2：运行完整静态与真实验收**

运行：`pnpm --filter @next-meal/api type-check && pnpm --filter @next-meal/client type-check && pnpm --filter @next-meal/api verify:openapi && pnpm --filter @next-meal/api verify:random-page-flow && pnpm --filter @next-meal/client build:mp-weixin`

在真实 API 与微信开发者工具中验证：完整菜单扣一次、部分菜单扣一次并可保存、全空不扣、连续第 11 次全空被限制、候选不足不泄露状态、历史计划版本不变。

- [x] **Step 3：提交前范围检查**

运行：`git diff --check && git diff --stat && git status --short`

确认只包含阶段一文档、模型、随机服务、回填/检查脚本、随机页与对应测试；不包含阶段二后台、AI、偏好或美食助理改造。
