# 菜谱正文关键词与导入标签 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `recipe.import.v1` 的正文关键词、待确认分类与固定结构化标签在导入、审核、发布和前台详情中使用同一契约。

**Architecture:** 关键词是 `RecipeContentVersion` 的不可变正文快照字段，并同步纳入 `Recipe.searchText`，供已有关键词查询复用；不新增 Wiki 透传或关键词词库。导入分类为 `null` 时保留草稿并进入 `NEEDS_FIX`，由后台选择有效分类后发布。`CUISINE` 与 `DISH_STYLE` 扩展现有版本标签枚举，不增加数字标签 ID。

**Tech Stack:** NestJS、Prisma/PostgreSQL、Vue 3、Element Plus、uni-app、TypeScript、Node test。

**Spec:** `docs/plans/recipe-admin-json-conversion.md`

## Global Constraints

- 当前仓库未上线，不保留旧 JSON 契约 fallback。
- `content.keywords` 必须出现，允许空数组；建议 3～6 个，最多 8 个，缺少可靠依据不得编造。
- `inspirationCategoryId: null` 表示待人工选择分类，不能发布。
- Wiki 是后台资料层；前台详情只消费正文关键词，不透传 Wiki。
- 仅修改关键词与导入标签链路，不新增关键词词库、独立关键词管理页或新的前台筛选页面。
- 保留当前工作区无关的暂存和未暂存改动，不提交、不重置、不清理。

---

### Task 1: 收口 JSON 解析与导入草稿

**Files:**
- Modify: `apps/api/src/modules/admin/recipe-import-json.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/modules/admin/recipe-import-json.test.ts`

**Interfaces:**
- `RecipeImportRecipeBody.keywords: string[]` 保存已清理的正文关键词。
- `parseJsonSource` 接受 `recipe.inspirationCategoryId: null`，并将其保存为 `null` 与待修正错误。
- JSON 支持 `CUISINE`、`DISH_STYLE`、既有五类标签；关键词最多 8 条且去重。

- [x] **Step 1: Write failing parser tests** for `keywords` parsing, empty keyword array, over-limit keywords, nullable classification, `CUISINE`, and `DISH_STYLE`.
- [x] **Step 2: Run the parser test file** and verify the new cases fail because the fields or tag codes are unsupported.
- [x] **Step 3: Implement the minimal parser/type changes**: permit only `null` or positive integer classification, normalize keywords, retain `null` as draft state, and validate the two new tag codes and their documented values.
- [x] **Step 4: Re-run the parser test file** and confirm all parser cases pass.

### Task 2: 持久化正文关键词与检索

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260909130000_recipe_content_keywords/migration.sql`
- Modify: `apps/api/src/modules/recipe/recipe-content.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Test: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`

**Interfaces:**
- `RecipeContentVersion.keywordsJson` is a JSON array defaulting to `[]`.
- `RecipeContentSnapshot.keywords` is always a `string[]`.
- `buildRecipeSearchText` includes the snapshot keywords so the existing `keyword` query finds them.

- [x] **Step 1: Write failing publication/content tests** asserting imported keywords are written to the new version field, returned by `versionToContent`, and present in recipe search text.
- [x] **Step 2: Run the focused tests** and verify they fail before adding `keywordsJson` and snapshot mapping.
- [x] **Step 3: Add the additive migration and schema field**, then wire `keywords` through version serialization, import publication and search-text construction.
- [x] **Step 4: Run focused service tests and Prisma schema validation** to confirm the persistence path passes.

### Task 3: 同步审核工作台和公开详情契约

**Files:**
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/modules/auth/admin.controller.ts`
- Modify: `apps/admin/src/apis/recipe.ts`
- Modify: `apps/admin/src/pages/RecipeImportItemPage.vue`
- Modify: `apps/admin/src/pages/recipe-import-json.test.js`
- Modify: `apps/client/src/apis/recipe.ts`
- Modify: `apps/client/src/pages_recipe/detail/index.vue`
- Test: `apps/client/src/pages_recipe/detail/style.test.ts`

**Interfaces:**
- Import-item PUT body accepts `keywords: string[]` and nullable `inspirationCategoryId`.
- The workbench edits keywords and displays an explicit “待选择分类” state for null.
- Public recipe detail exposes `content.keywords`; the detail page renders keywords only when non-empty.

- [x] **Step 1: Write failing admin/client contract assertions** for the keyword editor, both new structured tag options, nullable category state, public content keywords, and no Wiki object use in the client page.
- [x] **Step 2: Run the focused admin/client tests** and verify the new assertions fail on the current forms/types/page.
- [x] **Step 3: Implement the DTO, OpenAPI, admin form, client API type, and detail rendering changes** without adding a Wiki response field or an independent keyword-management route.
- [x] **Step 4: Run focused admin/client tests** and confirm they pass.

### Task 4: 规范收口与验证

**Files:**
- Modify: `docs/plans/recipe-admin-json-conversion.md`
- Modify: `docs/plans/minor_change_log.md`

- [x] **Step 1: Update the import specification** to use only `null` for unknown classification, make keyword count a 3～6 recommendation with an 8-item maximum, state text tag identifiers explicitly, and define keyword/tag responsibilities.
- [x] **Step 2: Run parser, import-service, admin, client focused tests; Prisma validation; API/Admin/Client type-check; OpenAPI verification; and scoped `git diff --check`.**
- [x] **Step 3: Record actual validation and any pre-existing unrelated blockers** in `minor_change_log.md`.
