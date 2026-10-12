# 共享周刊按日菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Track steps with checkbox (`- [ ]`) syntax.

**Goal:** 把现有扁平 HomeTopic 改造成按北京时间自然周展示的共享周刊，支持七天编排、草稿/预约发布、历史浏览、朋友分享和失效菜谱运营待办。

**Architecture:** 继续使用平台所有的 `HomeTopic` 与 `HomeTopicItem`；周期开始日、发布状态、菜品星期归属和待办处理状态由 API/数据库维护。后台负责按星期编排、发布和处理待办；独立 Worker 执行预约发布；小程序按 API 返回的日期和星期展示并提供原生朋友分享。本计划主体不实现个人周刊、服务端模型集成、会员、付费、炊火币或签到；文末单列已确认并实现的 Codex 批量选题补充阶段，其真实认证线上验收仍待完成。

**Tech Stack:** uni-app + Vue 3 + TypeScript、NestJS、Prisma 5.22、PostgreSQL、Vue 3 + Element Plus、OpenAPI 3.0、现有 Node/PostgreSQL Worker。

**Spec:** `docs/superpowers/specs/2026-10-12-shared-weekly-day-menu-design.md`

## Global Constraints

- 周期使用北京时间自然周，周一至周日；服务端计算并返回周期日期，Client 不按设备时区推算。
- 每个周期最多一条周刊记录；保存 `periodStartDate` 并由数据库唯一约束兜底。
- 发布或预约发布前必须覆盖七天；每天菜品数量不设固定上限或下限。
- 状态遵循文章生命周期：`DRAFT / PUBLISHED / UNLISTED`；预约附着于草稿；草稿可删除，包括由下架转回草稿的期数。
- 共享周刊本阶段全部免费；不增加用户所有者、会员、付费、锁定日或炊火币字段。
- 每个 HomeTopicItem 保存星期和日内顺序；不新增每日菜单父表。
- 所有可重试写操作带数字字符串 `Idempotency-Key`；共享可变对象写入带 `expectedVersion`。
- 保持菜谱固定版本和现有公开资格过滤；不可公开菜谱不出现在小程序周刊中。
- 朋友分享使用整期路径、日期范围标题和封面图；封面为空时使用 `/static/assets/logo.png` 产品 Logo，不携带日期选择和用户数据。
- 实现开始时工作区干净；当前 Client 改动直接叠加在现有版本上，没有覆盖先前未提交修改。

---

## 文件与模块边界

| 模块 | 主要文件 | 职责 |
| --- | --- | --- |
| 执行契约 | `docs/plans/home-weekly-topic-execution.md`、本计划 | 同步业务流程、页面行为、状态、数据和验收顺序 |
| 数据与 API | `apps/api/prisma/schema.prisma`、新 migration、`apps/api/src/modules/home/home-topic.service.ts`、HomeTopic controllers、`apps/api/src/contracts/{dtos,openapi,types}.ts` | 周期、星期、状态、发布资格、待办和公开响应 |
| 定时发布 | `apps/worker/src/main.ts`、`apps/worker/.env.example`、`apps/worker/README.md` | 独立开关的预约周刊发布循环和运维说明 |
| Admin | `apps/admin/src/apis/home-topics.ts`、`HomeTopicsPage.vue`、`HomeTopicEditorPage.vue`、`DashboardPage.vue`；API Admin dashboard controller/service | 按周编排、草稿/预约操作、失效菜谱待办 |
| Client | `apps/client/src/apis/home.ts`、`pages_home/topic/index.vue`、`pages_home/topic-list/index.vue` 及对应测试 | 七天浏览、日期展示、历史浏览和朋友分享 |
| 契约文档 | `docs/api-contract.md`、`docs/api-index.md`、`docs/client-api.md`、`docs/plans/minor_change_log.md` | 同步 API、跨端调用和验证范围 |

## 实施前置门禁

- [x] 审阅当前工作区差异；开始时干净，Client 页面和测试直接按当前 HEAD 增量实现。
- [ ] 盘点现有 HomeTopic 数据，生成只读清单：专题 ID/期数/状态/发布时间、菜谱项 ID/顺序、封面路径。
- [x] 为历史专题提供明确的周期与菜品星期映射：旧菜谱项统一映射到周一；周期周一按既有 `publishedAt` 之后的下一个北京时间完整自然周回填；不得根据旧 `sortOrder` 猜测星期。用户确认同周期已下架旧专题合并到 ID 较小者并保留菜谱项；合并后按原专题 ID、原排序重新编号。含未下架专题或重复菜谱的冲突仍停止迁移并报告。
- [x] 冻结“无预约草稿”的周期来源：新建时按当前北京时间分配下周；改预约时间时重算周期；取消预约保留当前已分配周期。
- [x] 确认待办忽略状态：在 `HomeTopicItem` 保存可空的 `todoDismissedAt`，并写入包含操作者与专题菜谱项身份的审计事件；忽略只关闭该菜单项的待办，不改其菜谱资格或公开过滤结果。

## Task 1：同步执行单和迁移输入

**Files:**

- Modify: `docs/plans/home-weekly-topic-execution.md`
- Create/read-only output as needed: 本地临时目录中的 HomeTopic 数据盘点结果；不得把用户数据或敏感信息提交进仓库。
- Update: `docs/superpowers/specs/2026-10-12-shared-weekly-day-menu-design.md` only if the preflight reveals a product rule conflict; stop and ask before changing confirmed rules.

- [x] **Step 1: 将按日周刊流程加入现有执行单。** 保留原专题页闭环记录，新增自然周、默认日期、七天覆盖、状态流转、分享和待办验收门禁。
- [ ] **Step 2: 执行只读数据盘点。** 找出已有 HomeTopic 和 HomeTopicItem 的周期/星期缺失情况，以及潜在唯一键冲突；不写入数据库。
- [ ] **Step 3: 审核历史映射。** 给每期按 `publishedAt` 之后的下一个北京时间自然周分配 `periodStartDate`，并将所有旧菜谱项显式映射到周一；不允许用全局顺序自动推断。
- [x] **Step 4: 完成迁移前检查。** 检查每期七天覆盖和周期唯一性；同周期全为已下架的历史专题按已确认规则合并，其他冲突列出并停止迁移，不静默删除菜谱项。

**Deliverable:** 业务执行单完整，迁移输入可审阅，无未处理的周期唯一冲突或旧菜单星期猜测。

## Task 2：增加周期、星期和发布状态数据模型

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261012120000_shared_weekly_day_menu/migration.sql`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Test/verification: `apps/api/src/modules/home/home-topic-history.service.test.ts` and focused HomeTopic lifecycle tests.

- [x] **Step 1: Add HomeTopic lifecycle fields.** Add `DRAFT`, `PUBLISHED`, and `UNLISTED` semantics; add nullable `scheduledPublishAt`; make `publishedAt` nullable for drafts; add `periodStartDate` as a date-only value with a unique constraint.
- [x] **Step 2: Add weekday to HomeTopicItem.** Use one bounded seven-value weekday enum; make per-day ordering unique with `(topicId, weekday, sortOrder)` while preserving recipe/version relations and `(topicId, recipeId)` uniqueness.
- [x] **Step 3: Add durable todo dismissal if Step 0 approved it.** Add nullable `todoDismissedAt` on the item; do not create a general task center or a separate generic workflow table.
- [x] **Step 4: Write the forward migration from the reviewed mapping.** Backfill dates and weekdays from explicit mapping; migrate existing visible status without exposing hidden topics; preserve recipe fixed-version IDs. Fail the migration on unmapped rows or duplicate period dates.
- [x] **Step 5: Add database constraints and query indexes.** Enforce unique period start and per-topic weekday ordering; add the smallest index needed for due scheduled topic lookup.
- [x] **Step 6: Generate and validate Prisma.** Run `pnpm --filter @next-meal/api exec prisma validate --schema prisma/schema.prisma` and `pnpm --filter @next-meal/api exec prisma generate --schema prisma/schema.prisma`.

**Deliverable:** schema and forward migration represent the approved lifecycle and seven-day item organization; historical rows are preserved with explicit mappings.

## Task 3：实现 HomeTopic 写入、周期计算和公开查询

**Files:**

- Modify: `apps/api/src/modules/home/home-topic.service.ts`
- Modify: `apps/api/src/modules/home/admin-home-topic.controller.ts`
- Modify: `apps/api/src/modules/home/home-topic.controller.ts` only for changed response/query contracts.
- Modify: `apps/api/src/contracts/dtos.ts`, `openapi.ts`, `types.ts`
- Modify: `apps/api/src/modules/home/home-topic-history.service.test.ts`
- Add focused tests under `apps/api/src/modules/home/` for period, status, validation and unavailable-recipe behavior.
- Modify: `apps/api/scripts/verify-home-weekly-topic-flow.ts`

- [x] **Step 1: Add one Beijing-time period helper inside the HomeTopic service boundary.** For immediate publish, calculate the next Monday from current server time; for a scheduled publish, calculate the next Monday from the scheduled time; do not use Worker execution time to recalculate.
- [x] **Step 2: Enforce one issue per period.** Apply the same calculated `periodStartDate` on create/schedule updates and translate the database unique conflict into a stable conflict response.
- [x] **Step 3: Validate publish readiness.** Before immediate publish or scheduling, require at least one eligible configured item for each weekday; allow drafts with incomplete or empty menus. Do not re-block already published browsing if a recipe later becomes unavailable.
- [x] **Step 4: Implement article-like transitions.** Drafts publish immediately or schedule; schedule may be changed/cancelled only on drafts; published topics can be edited or unlisted; unlisted topics must return to draft before republishing; only current drafts can be deleted.
- [x] **Step 5: Return date and weekday fields.** Public current/detail/history responses include `periodStartDate`, server-computed `periodEndDate`, and item weekday. Current is the latest published issue by period even when its period starts next Monday; history excludes current and remains paginated.
- [x] **Step 6: Preserve public filtering.** Omit recipes that are no longer public; retain topic and unaffected dates. Admin responses must still identify unavailable recipe items for operations.
- [x] **Step 7: Record important state changes.** Audit schedule, cancellation, automatic publish, manual publish, unlist, draft restoration, deletion, replacement and ignore operations with actor and topic identity.
- [x] **Step 8: Run API focused validation.** API type-check, focused history/period tests and OpenAPI verification pass. `verify:home-weekly-topic-flow` requires a migrated, reachable database and remains a runtime acceptance gate.

**Deliverable:** API is the authority for period, publication eligibility, status transitions, current/history selection and public recipe visibility.

## Task 4：执行预约周刊发布 Worker

**Files:**

- Modify: `apps/worker/src/main.ts`
- Modify: `apps/worker/.env.example`
- Modify: `apps/worker/README.md`
- Modify: `docs/plans/article-scheduled-publish-execution.md` only to cross-reference independent weekly publishing if the shared runtime documentation requires it.

- [x] **Step 1: Add independent `HOME_TOPIC_SCHEDULED_PUBLISH_WORKER_ENABLED`.** It must not change meal-reminder or article-worker switches and must default to disabled.
- [x] **Step 2: Claim due weekly drafts safely.** Select bounded due rows with row locks and `SKIP LOCKED`; recheck status, schedule and version/state before update.
- [x] **Step 3: Publish atomically.** Set `PUBLISHED`, set `publishedAt` to the scheduled time (not the delayed execution time), clear `scheduledPublishAt`, increment version and write an audit event in the same transaction.
- [x] **Step 4: Keep retry behavior bounded.** On transient database errors, log and retry on the existing worker retry interval; do not consume Outbox events or add unrelated worker jobs.
- [x] **Step 5: Verify independent configuration.** Worker type-check/build pass, and startup with all three switches disabled exits without a database connection. Weekly-only runtime remains a database acceptance gate.

**Deliverable:** a separately enabled, idempotent scheduled-publish loop that preserves the requested weekly period despite execution delay.

## Task 5：改造 Admin 周刊编排和运营待办

**Files:**

- Modify: `apps/admin/src/apis/home-topics.ts`
- Modify: `apps/admin/src/pages/HomeTopicsPage.vue`
- Modify: `apps/admin/src/pages/HomeTopicEditorPage.vue`
- Modify: `apps/admin/src/pages/DashboardPage.vue`

- [x] **Step 1: Group the editor by Monday through Sunday.** Each selected recipe has a weekday and an order within that weekday; allow variable counts and edits after publish.
- [x] **Step 2: Add draft and publication controls.** Support incomplete draft save/delete, seven-day validation on publish/schedule, schedule display/edit/cancel, unlist, and unlisted-to-draft restoration before republish/delete.
- [x] **Step 3: Add affected-menu todo query.** Return affected topic, week/date, unavailable recipe identity and current handling state; do not expose unrelated user data.
- [x] **Step 4: Add replace and ignore operations.** Replacing updates the original topic with a substitute or no substitute; ignoring dismisses that exact item’s todo and leaves public recipe filtering unchanged.
- [x] **Step 5: Add dashboard count and navigation.** The dashboard displays the pending weekly-menu todo count and links to the existing HomeTopics page, where the todo panel is directly available.
- [x] **Step 6: Verify Admin build contracts.** Admin type-check and production build pass.

**Deliverable:** editors can maintain a seven-day issue and operations can resolve or dismiss unavailable-menu todos from the dashboard path.

**Runtime acceptance pending:** database-backed Admin replacement/ignore/version-conflict scenarios and authenticated UI review require the local database to be restored.

## Task 6：改造小程序周刊展示和朋友分享

**Files:**

- Modify: `apps/client/src/apis/home.ts`
- Modify: `apps/client/src/pages_home/topic/index.vue`
- Modify: `apps/client/src/pages_home/topic-list/index.vue`
- Modify: `apps/client/src/pages_home/topic/index.test.js`
- Modify: `apps/client/src/pages_home/topic-list/index.test.ts`
- Read-only reference: `apps/client/src/pages_me/knowledge-detail/index.vue` for native `onShareAppMessage` handling.
- Read-only fallback asset: `apps/client/src/assets/logo.png`.

- [x] **Step 1: Render the Monday–Sunday date selector.** Use server period dates and item weekdays; select today for current issue when today is in range, otherwise Monday; select Monday for all historical issues.
- [x] **Step 2: Group recipe cards by selected day.** Preserve recipe detail and existing add-to-plan sheet behavior; individual and current-day batch actions pass `items[]` to the same sheet, and no whole-week add action is introduced.
- [x] **Step 3: Update weekly metadata.** Show “周一～周日” at `topic-section__meta` and `MM.DD ～ MM.DD` at `topic-summary__stats`; remove dish count and last-updated text from those slots.
- [x] **Step 4: Preserve and extend existing CSS edits.** Review the current worktree diff before editing, keep the user's manual styles, and align page-test assertions with the confirmed labels and the single selected day's visible recipes.
- [x] **Step 5: Add WeChat friend sharing.** Add a share affordance and `onShareAppMessage` callback using the existing page/topic ID; title is `日期范围｜周刊标题`; image is the topic cover or `/static/assets/logo.png`; do not include selected weekday or user-specific data.
- [x] **Step 6: Keep history browsing consistent.** History cards display each issue's date range; opening a history issue continues using its existing `topicId` path and defaults to Monday.
- [x] **Step 7: Verify Client build contracts.** Client type-check, WeChat Mini Program production build, and page-test syntax checks pass. The topic-page runtime test checks “本期菜单”, the selected day's recipes, and history only when history exists; HBuilderX page automation remains a live API/DevTools acceptance gate.

**Deliverable:** current and historical weeks show correct day menus and dates; sharing opens the full issue with the agreed title/cover behavior.

## Task 7：同步契约文档并完成集成验收

**Files:**

- Modify: `docs/api-contract.md`
- Modify: `docs/api-index.md`
- Modify: `docs/client-api.md`
- Modify: `docs/plans/home-weekly-topic-execution.md`
- Modify: `docs/plans/minor_change_log.md`

- [x] **Step 1: Synchronize endpoint and DTO contracts.** Document public current/detail/history dates and weekday fields, Admin day assignment, status/schedule operations, todo list/ignore behavior and error cases.
- [x] **Step 2: Run cross-package checks.** Run `pnpm type-check`, `pnpm --filter @next-meal/api verify:openapi`, API Prisma validate/generate, and `git diff --check`.
- [ ] **Step 3: Exercise the real API flow in a non-production target.** Create a draft with variable day counts; reject publish with a missing day; schedule a complete issue; publish it through the Worker; verify delay preserves `periodStartDate`; verify current/history ordering, unlist/draft/delete, recipe filtering, replacement and ignore.
- [ ] **Step 4: Exercise Admin and Client paths.** Use an Admin session to edit/reorder all seven days, schedule/cancel, replace/ignore an unavailable recipe, and open the dashboard todo. In WeChat DevTools, verify current/history defaults, date range, share title/image, and single/day-batch add behavior.
- [x] **Step 5: Update the central change log with actual validation.** Keep automated checks, authenticated Admin acceptance, Worker acceptance and DevTools/device acceptance separate; do not claim production acceptance from local checks.

**Deliverable:** synchronized contracts and evidence for API, Admin, Worker and mini-program acceptance; no deployment or production migration is included in this plan.

## 补充任务：Codex 批量选题与周刊 JSON 导入

此任务承接设计稿的“Codex 批量选题与周刊 JSON 导入”补充阶段，不改变前述已完成任务的状态。用户已确认 API 与 Bearer/SUPER_ADMIN 权限契约；统计、分页候选搜索、JSON 逐期预览/草稿导入和 Admin 操作已实现。测试环境已完成真实登录态 API 流程、匿名拒绝验证；首个测试周刊已准备并经用户完成内容审核，当前仍保留为未预约、未上架的草稿。

### Task 8：确认统计快照、候选搜索与批次 JSON 契约（已完成）

**预期涉及文件（契约审阅后再确认）：**

- `docs/superpowers/specs/2026-10-12-shared-weekly-day-menu-design.md`
- `docs/api-contract.md`、`docs/api-index.md`、`docs/client-api.md`
- `apps/api/src/modules/home/` 及 Admin API 类型/页面
- 必要时的 Prisma schema、migration 和后台周刊导入页面

- [x] 定义共享统计快照字段、主要/全部食材统计、标签覆盖率、生成时间和快照 ID。
- [x] 定义后台手动重建、失败保留旧快照的语义。
- [x] 定义严格 Admin Bearer + SUPER_ADMIN 认证的统计、候选搜索及导入接口；搜索带分页且仅返回当前公开系统灵感菜谱。
- [x] 明确候选固定 `sourceVersionId`、已确认标签、食材、难度和时长字段。
- [x] 定义周期周一、上个周日 15:00（Asia/Shanghai）、最多 12 期的批次 JSON Schema。
- [x] 定义批内去重、逐期失败、冲突不覆盖和候选数据变化后重新校验规则。
- [x] 定义后台 JSON 文本导入、逐期预览/校验、有效期导入为草稿且不自动发布，以及幂等规则。
- [x] 明确 token 只用于认证请求，不进入日志、JSON 文件或导入内容；授权与公开资格均由服务端校验。
- [x] 契约审阅已由用户确认；契约及实现清单同步到 API、Admin 和本计划。

**当前交付：** 契约已确认，实现已落地。API/Admin type-check、Prisma validate、API/Admin build 和 `git diff --check` 已通过；Admin Bearer/SUPER_ADMIN 守卫及 401/403 响应聚焦测试 7/7 通过。`verify:openapi` 仍受本机 tsx IPC sandbox 限制，已从编译后的 Nest 应用生成并检查路由文档。测试环境已通过真实 SUPER_ADMIN 后台会话完成统计读取、候选搜索、JSON 逐期预览和首期草稿导入；另用无 Authorization 的真实 GET 验证 API 返回业务 `code=401`。未使用聊天中粘贴的 Bearer token，未访问或写入生产环境。

### Task 9：线上认证验收与首个测试周刊预发布

- [x] TEST API 无 Authorization 的统计 GET 返回 HTTP 200、业务 `code=401`；普通管理员 `403` 由 Admin 守卫测试覆盖，SUPER_ADMIN 的真实登录态读取由后台会话覆盖。
- [x] 测试环境已登录 SUPER_ADMIN 会话读取统计并搜索候选；通过逐期预览后完成草稿导入。
- [x] 根据测试环境候选数据生成首期共享周刊 JSON，并在后台逐期预览通过。
- [x] 导入为 DRAFT；测试后台显示 2026-10-26 至 2026-11-01、16 道菜、状态“草稿”，未预约、未上架。专题 ID 为 6，现已打开编辑页供人工审核。
- [x] 内容复核后调整 3 道菜：周一以洋葱孜然牛肉片替换芦笋牛肉粒，周五以清炒菠菜替换重复的南瓜菜，周六以凉拌藕片替换藕带；保持 7 天、16 道菜和各日内 `01..n` 排序，未调整其他菜品。
- [x] 根据用户“基本 OK，细节需要优化”的反馈，保留菜单与日期，仅润色副标题、专题寄语及 16 道菜的推荐说明；删除泛化的“适合周中/调节口味”等句式，改为具体呈现风味、口感和搭配。再次精简寄语并让副标题更贴合秋日家常，TEST 后台提示保存成功，草稿升至版本 4。
- [x] 修复测试菜谱封面：此前已通过 TEST 清单迁移 153 条快照封面及本期原 9 道菜封面；此次发现替换菜谱 10002373 仍引用快照对象，按单条迁移清单只修复该菜谱当前版本，目标为 `dev/uploads/recipe-images/10002373/10002373_10001524.jpg`。迁移脚本校验对象 SHA-256；刷新后台后 16/16 张封面均 `naturalWidth > 0`。仅写入 TEST，保留源对象和旧版本。
- [x] 未部署、未执行线上 migration、未预约发布；2026-10-19 至 2026-10-25 已有一篇已发布测试周刊，因此本草稿顺延到下一个空档周。
- [x] 用户完成内容人工审核并通过版本 4；草稿编辑页已打开并保留在测试后台，未预约、未上架。

## Scope Self-Review

- Confirmed scope: shared weekly menus only; personal weekly generation, membership, payment, coins, attendance and personal-week sharing are excluded.
- Existing HomeTopic storage and fixed recipe-version references remain the foundation; no daily-menu parent table is added.
- The starting worktree was clean. No unrelated recipe, meal-plan or sharing refactor is included.
- The only outstanding preflight dependency is a reachable local PostgreSQL database for the read-only legacy-period collision audit and migration/runtime acceptance.
- Do not deploy migrations, enable the Worker in production, create weekly content, or commit until separately requested.
