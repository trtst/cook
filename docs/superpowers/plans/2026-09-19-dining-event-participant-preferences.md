# 饭局参与人偏好与备注 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现饭局成员最多 3 道带菜/想吃的一次多选提交、成员饭局备注与个人口味快捷回填，并隐藏成员采购准备区域。

**Architecture:** 保留现有饭局想吃池和公共提醒，新增参与人备注字段；用独立关系表表达一位参与人可带多道固定菜谱，避免把多值业务事实塞入 JSON。客户端在现有饭局详情页中增加多选状态和一个专用备注 Sheet，口味标签只作为本次备注草稿来源。

**Tech Stack:** NestJS 11 + Prisma 5 + PostgreSQL；uni-app + Vue 3 + TypeScript；Node test runner；mp-weixin build。

**Spec:** `docs/superpowers/specs/2026-09-19-dining-event-participant-preferences-design.md`

## Global Constraints

- 不回退 `apps/client/src/pages_share/preview/index.vue` 的已有脏改动。
- 不猜测 API 字段；服务端 DTO、OpenAPI、客户端本地类型和 `docs/client-api.md` 一起变更。
- 所有可重试写入继续使用数字字符串 `Idempotency-Key`。
- “我带菜”和“我想吃”分别最多 3 道；数组必须非空、唯一且服务端校验。
- 成员不可读取或操作主家采购清单、食材缺口和采购准备区域。
- 先写并运行失败测试，再写对应生产代码。
- 完成后更新 `docs/plans/minor_change_log.md`。

## 文件地图

- Modify `apps/api/prisma/schema.prisma`：参与人备注和多道带菜关系。
- Create `apps/api/prisma/migrations/20260919120000_dining_event_participant_preferences/migration.sql`：安全迁移旧单值带菜到新关系表。
- Modify `apps/api/src/contracts/dtos.ts`、`apps/api/src/contracts/types.ts`、`apps/api/src/contracts/openapi.ts`：请求/响应契约。
- Modify `apps/api/src/modules/meal/meal.controller.ts`、`apps/api/src/modules/meal/meal.service.ts`：成员备注、带菜/想吃批量写入、最小返回。
- Modify `apps/api/src/modules/meal/meal.service.test.ts`：服务端行为测试。
- Modify `apps/client/src/pages_meal/apis/meal.ts`、`apps/client/src/apis/user.ts`：客户端契约和请求入口。
- Modify `apps/client/src/pages_meal/detail/index.vue`：多选 Sheet、成员可见性、备注入口与口味加载。
- Create `apps/client/src/components/Meal/DiningEventParticipantNoteSheet.vue`：固定备注输入框和分类口味标签。
- Modify `apps/client/src/components/Meal/ParticipantManageSheet.vue`：主家查看成员备注。
- Modify `apps/client/src/pages_meal/detail/index.test.js`：页面静态契约和真实路径覆盖。
- Create `apps/client/src/components/Meal/dining-event-participant-note-sheet.test.ts`：口味标签和备注回填的纯逻辑测试（若组件测试运行时限制则测试导出的纯函数文件）。
- Modify `docs/client-api.md`、`docs/plans/minor_change_log.md`：现行接口和时间线。

### Task 1: API/数据库 red tests

**Files:**
- Modify: `apps/api/src/modules/meal/meal.service.test.ts`
- Modify: `apps/api/src/contracts/dtos.test.ts` or create the nearest existing DTO contract test file if present
- Modify: `apps/client/src/pages_meal/detail/index.test.js`

- [x] **Step 1: Write failing API behavior tests** for `recipeIds` max 3, multi-bring replacement, member note write, and participant response `bringRecipes`/`note`.
- [x] **Step 2: Write failing client source tests** asserting `recipeIds`, max-3 guard, taste profile request, tag insertion, `showShoppingPanel` member guard, and no member shopping action.
- [x] **Step 3: Run only these tests** and confirm failures are missing behavior rather than test setup errors.

### Task 2: Database and DTO contract

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260919120000_dining_event_participant_preferences/migration.sql`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`

- [x] **Step 1:** Add `DiningEventParticipant.note`, `DiningEventParticipantBringRecipe`, relation fields, unique/index constraints, and remove single-value bring relation fields.
- [x] **Step 2:** Add migration that creates the relation table, copies non-null legacy bring rows, adds participant note, then removes legacy columns/foreign keys.
- [x] **Step 3:** Change DTOs to strict unique `recipeIds` arrays with 1–3 items and add `UpdateDiningEventParticipantNoteDto` with nullable 255-char note.
- [x] **Step 4:** Change public types and OpenAPI models to `bringRecipes` and `note`; regenerate Prisma client and run schema validation.

### Task 3: API service/controller implementation

**Files:**
- Modify: `apps/api/src/modules/meal/meal.service.ts`
- Modify: `apps/api/src/modules/meal/meal.controller.ts`

- [x] **Step 1:** Load participant `bringRecipes` and `note` in the event query and return only public response fields.
- [x] **Step 2:** Implement batch wish selection in one transaction, prevalidate all owned recipes and the resulting per-user count before writes, then reuse existing wish support semantics.
- [x] **Step 3:** Implement batch bring replacement in one transaction: verify participant/status and all owned fixed versions, delete current rows, create new relation rows in selection order, and update acceptance state.
- [x] **Step 4:** Implement `POST /dining-events/:eventId/my-note` with participant-only authorization, normalization, idempotency, and the existing event summary response.
- [x] **Step 5:** Make member summaries omit shopping list fields by returning `null` for non-organizers, while preserving organizer behavior.
- [x] **Step 6:** Run API red tests, then focused meal service tests and API type-check.

### Task 4: Client multi-select and member visibility

**Files:**
- Modify: `apps/client/src/pages_meal/apis/meal.ts`
- Modify: `apps/client/src/pages_meal/detail/index.vue`

- [x] **Step 1:** Change request/response types and API bodies to arrays.
- [x] **Step 2:** Make bring and wish selections toggle in the existing recipe Sheet, cap at three, show selected status and count, and submit all selected IDs once.
- [x] **Step 3:** Return the current member’s bring ID set from `bringRecipes` and update bring list rendering to show all dishes.
- [x] **Step 4:** Add organizer-only guards to the shopping panel, gap rendering, footer shopping action, and shopping copy.
- [x] **Step 5:** Run client static tests and type-check.

### Task 5: Participant note Sheet and taste quick-fill

**Files:**
- Create: `apps/client/src/components/Meal/DiningEventParticipantNoteSheet.vue`
- Modify: `apps/client/src/pages_meal/detail/index.vue`
- Modify: `apps/client/src/components/Meal/ParticipantManageSheet.vue`
- Create/modify: `apps/client/src/components/Meal/dining-event-participant-note-sheet.test.ts`

- [x] **Step 1:** Add pure helpers to flatten the four taste arrays into labeled groups; do not expose or split the profile note.
- [x] **Step 2:** Build the Sheet with a fixed multiline note field above scrollable category tags; selected tags append to the draft using `；` and remain toggleable.
- [x] **Step 3:** Fetch `userApi.getTasteProfile()` on member Sheet open, expose loading/error/empty states, and submit only `note` to `my-note`.
- [x] **Step 4:** Show the participant note in the organizer’s participant sheet; do not mutate the personal taste profile.
- [x] **Step 5:** Run component/static tests and client type-check.

### Task 6: Contract docs and verification

**Files:**
- Modify: `docs/client-api.md`
- Modify: `docs/plans/minor_change_log.md`

- [x] **Step 1:** Update the wishes/bring/note request and response docs and the member data boundary.
- [x] **Step 2:** Add a dated minor-change entry naming the files and validation results.
- [x] **Step 3:** Run `pnpm --filter @next-meal/api exec prisma validate`, focused API tests, `pnpm --filter @next-meal/api type-check`, client focused tests, `pnpm --filter @next-meal/client type-check`, and `pnpm --filter @next-meal/client build:mp-weixin`.
- [x] **Step 4:** Inspect the final diff for scope self-check and explicitly report static/build versus real-device acceptance.
