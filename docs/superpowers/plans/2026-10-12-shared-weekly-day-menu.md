# 共享周刊按日菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Track steps with checkbox (`- [ ]`) syntax.

**Goal:** 把现有扁平 HomeTopic 改造成按北京时间自然周展示的共享周刊，支持七天编排、草稿/预约发布、历史浏览、朋友分享和失效菜谱运营待办。

**Architecture:** 继续使用平台所有的 `HomeTopic` 与 `HomeTopicItem`；周期开始日、发布状态、菜品星期归属和待办处理状态由 API/数据库维护。后台负责按星期编排、发布和处理待办；独立 Worker 执行预约发布；小程序按 API 返回的日期和星期展示并提供原生朋友分享。此计划不实现个人周刊、AI、会员、付费、炊火币或签到。

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
- 朋友分享使用整期路径、日期范围标题和封面图；封面为空时使用产品 Logo，不携带日期选择和用户数据。
- 保留当前工作区对 `apps/client/src/pages_home/topic/index.vue` 与 `apps/client/src/pages_home/topic-list/index.test.ts` 的未提交手动修改；实现前先审阅 diff，不得恢复或覆盖它们。

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

- [ ] 审阅当前工作区差异，特别是两份用户手动修改的 Client 文件；记录其改动边界并确认新实现如何叠加。
- [ ] 盘点现有 HomeTopic 数据，生成只读清单：专题 ID/期数/状态/发布时间、菜谱项 ID/顺序、封面路径。
- [ ] 为历史专题提供明确的周期与菜品星期映射；不得根据旧 `sortOrder` 猜测星期。发现重复周期或无法映射时，暂停 migration，先给出冲突清单。
- [ ] 冻结“无预约草稿”的周期来源。建议新建时按当前北京时间计算下一自然周；改预约时间时重算周期；取消预约保留当前已分配周期。该规则尚未在产品讨论中单独确认，写代码前需确认。
- [ ] 确认待办忽略状态的最小持久化方式。建议在 `HomeTopicItem` 保存可空的 `todoDismissedAt`；“忽略”只关闭该菜单项的待办，不改其菜谱资格或公开过滤结果。

## Task 1：同步执行单和迁移输入

**Files:**

- Modify: `docs/plans/home-weekly-topic-execution.md`
- Create/read-only output as needed: 本地临时目录中的 HomeTopic 数据盘点结果；不得把用户数据或敏感信息提交进仓库。
- Update: `docs/superpowers/specs/2026-10-12-shared-weekly-day-menu-design.md` only if the preflight reveals a product rule conflict; stop and ask before changing confirmed rules.

- [ ] **Step 1: 将按日周刊流程加入现有执行单。** 保留原专题页闭环记录，新增自然周、默认日期、七天覆盖、状态流转、分享和待办验收门禁。
- [ ] **Step 2: 执行只读数据盘点。** 找出已有 HomeTopic 和 HomeTopicItem 的周期/星期缺失情况，以及潜在唯一键冲突；不写入数据库。
- [ ] **Step 3: 审核历史映射。** 给每期分配明确的 `periodStartDate`，给每个旧菜谱项分配明确星期；不允许用全局顺序自动推断。
- [ ] **Step 4: 完成迁移前检查。** 检查每期七天覆盖和周期唯一性；将不满足条件的记录列出供运营确认，不删除或合并专题。

**Deliverable:** 业务执行单完整，迁移输入可审阅，无未处理的周期唯一冲突或旧菜单星期猜测。

## Task 2：增加周期、星期和发布状态数据模型

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261012120000_shared_weekly_day_menu/migration.sql`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Test/verification: `apps/api/src/modules/home/home-topic-history.service.test.ts` and focused HomeTopic lifecycle tests.

- [ ] **Step 1: Add HomeTopic lifecycle fields.** Add `DRAFT`, `PUBLISHED`, and `UNLISTED` semantics; add nullable `scheduledPublishAt`; make `publishedAt` nullable for drafts; add `periodStartDate` as a date-only value with a unique constraint.
- [ ] **Step 2: Add weekday to HomeTopicItem.** Use one bounded seven-value weekday enum; make per-day ordering unique with `(topicId, weekday, sortOrder)` while preserving recipe/version relations and `(topicId, recipeId)` uniqueness.
- [ ] **Step 3: Add durable todo dismissal if Step 0 approved it.** Add nullable `todoDismissedAt` on the item; do not create a general task center or a separate generic workflow table.
- [ ] **Step 4: Write the forward migration from the reviewed mapping.** Backfill dates and weekdays from explicit mapping; migrate existing visible status without exposing hidden topics; preserve recipe fixed-version IDs. Fail the migration on unmapped rows or duplicate period dates.
- [ ] **Step 5: Add database constraints and query indexes.** Enforce unique period start and per-topic weekday ordering; add the smallest index needed for due scheduled topic lookup.
- [ ] **Step 6: Generate and validate Prisma.** Run `pnpm --filter @next-meal/api exec prisma validate --schema prisma/schema.prisma` and `pnpm --filter @next-meal/api exec prisma generate --schema prisma/schema.prisma`.

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

- [ ] **Step 1: Add one Beijing-time period helper inside the HomeTopic service boundary.** For immediate publish, calculate the next Monday from current server time; for a scheduled publish, calculate the next Monday from the scheduled time; do not use Worker execution time to recalculate.
- [ ] **Step 2: Enforce one issue per period.** Apply the same calculated `periodStartDate` on create/schedule updates and translate the database unique conflict into a stable conflict response.
- [ ] **Step 3: Validate publish readiness.** Before immediate publish or scheduling, require at least one eligible configured item for each weekday; allow drafts with incomplete or empty menus. Do not re-block already published browsing if a recipe later becomes unavailable.
- [ ] **Step 4: Implement article-like transitions.** Drafts publish immediately or schedule; schedule may be changed/cancelled only on drafts; published topics can be edited or unlisted; unlisted topics must return to draft before republishing; only current drafts can be deleted.
- [ ] **Step 5: Return date and weekday fields.** Public current/detail/history responses include `periodStartDate`, server-computed `periodEndDate`, and item weekday. Current is the latest published issue by period even when its period starts next Monday; history excludes current and remains paginated.
- [ ] **Step 6: Preserve public filtering.** Omit recipes that are no longer public; retain topic and unaffected dates. Admin responses must still identify unavailable recipe items for operations.
- [ ] **Step 7: Record important state changes.** Audit schedule, cancellation, automatic publish, manual publish, unlist, draft restoration, deletion, replacement and ignore operations with actor and topic identity.
- [ ] **Step 8: Run API focused validation.** Run `pnpm --filter @next-meal/api exec tsx --test src/modules/home/home-topic-history.service.test.ts src/modules/home/home-topic-weekly.service.test.ts`, `pnpm --filter @next-meal/api type-check`, `pnpm --filter @next-meal/api verify:openapi`, and `pnpm --filter @next-meal/api verify:home-weekly-topic-flow` after updating the flow verifier for the new contract.

**Deliverable:** API is the authority for period, publication eligibility, status transitions, current/history selection and public recipe visibility.

## Task 4：执行预约周刊发布 Worker

**Files:**

- Modify: `apps/worker/src/main.ts`
- Modify: `apps/worker/.env.example`
- Modify: `apps/worker/README.md`
- Modify: `docs/plans/article-scheduled-publish-execution.md` only to cross-reference independent weekly publishing if the shared runtime documentation requires it.

- [ ] **Step 1: Add independent `HOME_TOPIC_SCHEDULED_PUBLISH_WORKER_ENABLED`.** It must not change meal-reminder or article-worker switches and must default to disabled.
- [ ] **Step 2: Claim due weekly drafts safely.** Select bounded due rows with row locks and `SKIP LOCKED`; recheck status, schedule and version/state before update.
- [ ] **Step 3: Publish atomically.** Set `PUBLISHED`, set `publishedAt` to the scheduled time (not the delayed execution time), clear `scheduledPublishAt`, increment version and write an audit event in the same transaction.
- [ ] **Step 4: Keep retry behavior bounded.** On transient database errors, log and retry on the existing worker retry interval; do not consume Outbox events or add unrelated worker jobs.
- [ ] **Step 5: Verify independent configuration.** Run `pnpm --filter @next-meal/worker type-check` and `pnpm --filter @next-meal/worker build`; inspect startup behavior with all three worker switches disabled and with only the weekly switch enabled.

**Deliverable:** a separately enabled, idempotent scheduled-publish loop that preserves the requested weekly period despite execution delay.

## Task 5：改造 Admin 周刊编排和运营待办

**Files:**

- Modify: `apps/admin/src/apis/home-topics.ts`
- Modify: `apps/admin/src/pages/HomeTopicsPage.vue`
- Modify: `apps/admin/src/pages/HomeTopicEditorPage.vue`
- Modify: `apps/admin/src/apis/dashboard.ts`
- Modify: `apps/admin/src/pages/DashboardPage.vue`
- Modify: `apps/api/src/modules/auth/admin.controller.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Add/modify corresponding DTO/OpenAPI models and focused Admin/API checks.

- [ ] **Step 1: Group the editor by Monday through Sunday.** Each selected recipe has a weekday and an order within that weekday; allow variable counts and edits after publish.
- [ ] **Step 2: Add draft and publication controls.** Support incomplete draft save/delete, seven-day validation on publish/schedule, schedule display/edit/cancel, unlist, and unlisted-to-draft restoration before republish/delete.
- [ ] **Step 3: Add affected-menu todo query.** Return affected topic, week/date, unavailable recipe identity and current handling state; do not expose unrelated user data.
- [ ] **Step 4: Add replace and ignore operations.** Replacing updates the original topic with a substitute or no substitute; ignoring dismisses that exact item’s todo and leaves public recipe filtering unchanged.
- [ ] **Step 5: Add dashboard count and navigation.** Add a pending weekly-menu todo count to the existing dashboard summary and link it to the existing HomeTopics page in todo-filter mode; avoid a new generic task center.
- [ ] **Step 6: Verify Admin behavior.** Run `pnpm --filter @next-meal/admin type-check` and `pnpm --filter @next-meal/admin build`; confirm version conflicts, invalid recipes, ignore, replacement, no-replacement and zero-todo states.

**Deliverable:** editors can maintain a seven-day issue and operations can resolve or dismiss unavailable-menu todos from the dashboard path.

## Task 6：改造小程序周刊展示和朋友分享

**Files:**

- Modify: `apps/client/src/apis/home.ts`
- Modify: `apps/client/src/pages_home/topic/index.vue`
- Modify: `apps/client/src/pages_home/topic-list/index.vue`
- Modify: `apps/client/src/pages_home/topic/index.test.js`
- Modify: `apps/client/src/pages_home/topic-list/index.test.ts`
- Read-only reference: `apps/client/src/pages_me/knowledge-detail/index.vue` for native `onShareAppMessage` handling.
- Read-only fallback asset: `apps/client/src/assets/logo.png`.

- [ ] **Step 1: Render the Monday–Sunday date selector.** Use server period dates and item weekdays; select today for current issue when today is in range, otherwise Monday; select Monday for all historical issues.
- [ ] **Step 2: Group recipe cards by selected day.** Preserve recipe detail and existing add-to-plan sheet behavior; individual and current-day batch actions pass `items[]` to the same sheet, and no whole-week add action is introduced.
- [ ] **Step 3: Update weekly metadata.** Show “周一～周日” at `topic-section__meta` and `MM.DD ～ MM.DD` at `topic-summary__stats`; remove dish count and last-updated text from those slots.
- [ ] **Step 4: Preserve and extend existing CSS edits.** Review the current worktree diff before editing, keep the user's manual styles, and update matching test assertions without restoring the page or test file.
- [ ] **Step 5: Add WeChat friend sharing.** Add a share affordance and `onShareAppMessage` callback using the existing page/topic ID; title is `日期范围｜周刊标题`; image is the topic cover or `/assets/logo.png`; do not include selected weekday or user-specific data.
- [ ] **Step 6: Keep history browsing consistent.** History cards display each issue's date range; opening a history issue continues using its existing `topicId` path and defaults to Monday.
- [ ] **Step 7: Verify Client behavior.** Run `pnpm --filter @next-meal/client type-check`, `pnpm --filter @next-meal/client build:mp-weixin`, `pnpm --filter @next-meal/client exec tsx src/pages_home/topic-list/index.test.ts`, and `node --check apps/client/src/pages_home/topic/index.test.js`; then run the existing WeChat page automation with `/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages_home/topic/index.test.js`.

**Deliverable:** current and historical weeks show correct day menus and dates; sharing opens the full issue with the agreed title/cover behavior.

## Task 7：同步契约文档并完成集成验收

**Files:**

- Modify: `docs/api-contract.md`
- Modify: `docs/api-index.md`
- Modify: `docs/client-api.md`
- Modify: `docs/plans/home-weekly-topic-execution.md`
- Modify: `docs/plans/minor_change_log.md`

- [ ] **Step 1: Synchronize endpoint and DTO contracts.** Document public current/detail/history dates and weekday fields, Admin day assignment, status/schedule operations, todo list/ignore behavior and error cases.
- [ ] **Step 2: Run cross-package checks.** Run `pnpm type-check`, `pnpm --filter @next-meal/api verify:openapi`, API Prisma validate/generate, and `git diff --check`.
- [ ] **Step 3: Exercise the real API flow in a non-production target.** Create a draft with variable day counts; reject publish with a missing day; schedule a complete issue; publish it through the Worker; verify delay preserves `periodStartDate`; verify current/history ordering, unlist/draft/delete, recipe filtering, replacement and ignore.
- [ ] **Step 4: Exercise Admin and Client paths.** Use an Admin session to edit/reorder all seven days, schedule/cancel, replace/ignore an unavailable recipe, and open the dashboard todo. In WeChat DevTools, verify current/history defaults, date range, share title/image, and single/day-batch add behavior.
- [ ] **Step 5: Update the central change log with actual validation.** Keep automated checks, authenticated Admin acceptance, Worker acceptance and DevTools/device acceptance separate; do not claim production acceptance from local checks.

**Deliverable:** synchronized contracts and evidence for API, Admin, Worker and mini-program acceptance; no deployment or production migration is included in this plan.

## Scope Self-Review

- Confirmed scope: shared weekly menus only; personal weekly generation, membership, payment, coins, attendance and personal-week sharing are excluded.
- Existing HomeTopic storage and fixed recipe-version references remain the foundation; no daily-menu parent table is added.
- User-owned dirty Client changes must be preserved; no unrelated recipe, meal-plan or sharing refactor is included.
- Main pre-implementation blockers are explicit legacy date/weekday mapping, unscheduled draft period source, and the approved persistence shape for ignored todos.
- Do not deploy migrations, enable the Worker in production, create weekly content, or commit until separately requested.
