# 菜谱 JSON 导入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让后台严格按 `recipe.import.v1` JSON 将菜谱导入待审核系统项，审核通过后再生成正式菜谱、派生营养、助理、标签和灵感用户归属。

**Architecture:** 保留现有导入任务/条目工作台作为审核层，将来源解析替换为严格 JSON（批量选择一个或多个 JSON 文件）。导入草稿保存原始 JSON 和后台匹配结果；正式发布时才创建 Recipe，并从灵感来源用户池随机选择 owner。工具、导入标签和助理动作分别落入正文版本、版本标签和助理快照，不写入导入 JSON 的内部 ID 或审核状态。

**Tech Stack:** NestJS、Prisma/PostgreSQL、Vue 3、Element Plus、TypeScript、Vitest/Node test。

**Spec:** `docs/plans/recipe-admin-json-conversion.md`

## Global Constraints

- 所有导入内容先进入待审核系统项，审核通过后才创建正式菜谱。
- 食材和单位只允许严格匹配当前系统主数据；不匹配时保留来源值并阻塞发布。
- `recipe.coverImageUrl` 可省略；其他规范字段必须出现，不能用默认值掩盖缺失。
- 营养值不从 JSON 导入，发布后按结构化食材、数量和单位派生。
- JSON 不包含菜谱 ID、版本号、内部食材/单位 ID、用户 UID、昵称、炊火号或审核状态。
- 保护工作区已有修改；不回退无关文件，不保留模糊用量进入正式菜谱。

### Task 1: 严格 JSON 解析与导入草稿契约

**Files:**
- Create: `apps/api/src/modules/admin/recipe-import-json.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_recipe_import_json_and_tools/migration.sql`
- Test: `apps/api/src/modules/admin/recipe-import-json.test.ts`

**Interfaces:**
- Produces `readJsonSources(fileName, buffer)`, `parseJsonSource(source, refs)`, `rebuildJsonItemState(body, refs)`.
- Produces internal `RecipeImportRecipeBody` with `tools`, `tags`, `assistantSteps`, source image URLs and matched ingredient/unit IDs.
- The public import contract exposes only `JSON`; any legacy database enum values are not accepted by new routes and are not exposed as supported import options.

- [x] **Step 1: Write failing parser tests** for valid `recipe.import.v1`, missing required fields, invalid enums, duplicate/unknown tags, invalid assistant phase/action, unmatched ingredients/units, fuzzy quantities, and JSON arrays.
- [x] **Step 2: Run the focused test** and confirm the new parser contract is not implemented.
- [x] **Step 3: Implement strict source reading** for one or more `.json` files; reject non-JSON files and arrays, and preserve exact source JSON text.
- [x] **Step 4: Implement strict schema validation** without guessing defaults; validate required recipe fields, five required tag codes, tools array, assistant steps, image URL shape, and phase/action combinations.
- [x] **Step 5: Implement exact ingredient/unit matching** against normalized names only, allowing only documented deterministic unit aliases (`g/kg/ml/L`); unmatched rows remain in the draft and create `NEEDS_FIX` errors.
- [x] **Step 6: Add `JSON` source type, `toolsJson`, and import draft fields** to Prisma/types/DTO/OpenAPI; use an additive migration with an empty tools default for existing versions.
- [x] **Step 7: Run parser tests, Prisma validation/generate, and API type-check.**

### Task 2: API import job and publish contract

**Files:**
- Modify: `apps/api/src/modules/auth/admin.controller.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/modules/admin/recipe-import-markdown.ts` only where shared image/state helpers must be separated
- Modify: `apps/api/src/modules/recipe/recipe-content.ts`
- Modify: `apps/api/src/modules/recipe/recipe-version-tags.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Test: `apps/api/src/modules/admin/admin.service.test.ts`

**Interfaces:**
- Consumes Task 1 JSON parser and draft types.
- Produces `/admin/recipe-import-jobs/json`, strict JSON job summaries, and publish behavior that never creates `Recipe` before publish.
- Produces imported tools in `RecipeContentSnapshot`, imported tags as confirmed `OPS` tags, and imported assistant actions in `RecipeAssistantSnapshot`.

- [x] **Step 1: Add failing service tests** proving JSON jobs enter `NEEDS_FIX` for unmatched data, do not accept imported nutrition, cannot publish fuzzy/unmatched ingredients, and do not create a Recipe before publish.
- [x] **Step 2: Run the focused service tests** and confirm the old Markdown-only behavior fails the new cases.
- [x] **Step 3: Switch controller/service upload handling** to batch JSON files and save raw source text, parsed source view, and strict draft state.
- [x] **Step 4: Remove `estimatedCalories` from import DTO/UI payloads** and always write `null` into the formal content version for this path.
- [x] **Step 5: Persist tools and imported assistant snapshot**; add action inference for generated assistant steps while preserving imported `action`, title, detail, images, and `durationText`.
- [x] **Step 6: Persist imported tags** after formal version creation with `source = OPS`, `status = CONFIRMED`, and stable order; do not map `COLD_DISH` to `VEGETABLE`.
- [x] **Step 7: Preserve and validate source image URLs** without downloading or silently replacing them; uploaded review images may override the source URL.
- [x] **Step 8: Run focused import-contract tests, API type-check, OpenAPI verification, and Prisma generate.**

### Task 3: Inspiration owner pool and public recipe predicate

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_recipe_inspiration_owner_pool/migration.sql`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/modules/recipe/recipe.service.ts`
- Modify: `apps/api/src/modules/home/home.service.ts`
- Modify: `apps/api/src/modules/home/home-topic.service.ts`
- Modify: `apps/api/src/modules/pantry/pantry.service.ts`
- Modify: `apps/api/src/modules/meal/meal.service.ts` only where the public inspiration predicate is used
- Modify: `apps/api/prisma/seed.ts` or add `apps/api/scripts/ensure-recipe-inspiration-owner-pool.ts`
- Test: `apps/api/src/modules/recipe/recipe-inspiration-owner.test.ts`

**Interfaces:**
- Produces a dedicated `RecipeInspirationOwner` membership table for the 100 approved source users; no fixed UID is required by the import contract.
- Produces a transaction-safe `pickRecipeInspirationOwner(tx)` function that selects only pool members and never falls back to a real user.
- Produces one shared public-inspiration predicate so pool-owned imported recipes remain public inspiration and are not treated as the current user’s private recipe.

- [x] **Step 1: Write failing owner-pool tests** for exactly 100 members, random selection limited to the pool, empty/short pool failure, and public-vs-private classification.
- [x] **Step 2: Add the pool relation and migration** without exposing pool identity in import JSON or client payloads.
- [x] **Step 3: Add deterministic pool seeding/verification** that validates UID uniqueness, nickname restrictions, nullable phone, and minimum 8-digit generated UIDs for the 99 additional users; do not recreate existing users.
- [x] **Step 4: Use the pool picker when publishing imported recipes** and store the selected user as `Recipe.ownerId`.
- [x] **Step 5: Update public/admin/inspiration predicates** to recognize pool-owned inspiration recipes while keeping normal user recipes private.
- [x] **Step 6: Run owner-pool tests and affected API tests.**

### Task 4: Backend workbench contract and UI

**Files:**
- Modify: `apps/admin/src/apis/recipe.ts`
- Modify: `apps/admin/src/pages/RecipeImportJobsPage.vue`
- Modify: `apps/admin/src/pages/RecipeImportItemPage.vue`
- Modify: `apps/admin/src/pages/RecipeImportJobDetailPage.vue`
- Modify: `apps/admin/src/utils/status.ts` only if new JSON/import messages need it
- Test: `apps/admin/src/pages/recipe-import-json.test.js` or the repository’s existing admin test location

**Interfaces:**
- Consumes Task 1/2 API contracts.
- Produces batch JSON upload, strict source messaging, tool editing, tag editing, assistant phase/action editing, and removal of imported nutrition editing.

- [x] **Step 1: Add failing admin assertions** for batch `.json` acceptance, no calorie input, required tools/tags/assistant sections, and publish disabled while errors remain.
- [x] **Step 2: Update API types and upload endpoint** from Markdown-only to JSON import.
- [x] **Step 3: Update the import center copy and file picker** to describe batch JSON and the待审核系统项 flow.
- [x] **Step 4: Add workbench editors** for tools, tags, assistant phase/action/title/detail/durationText, while preserving source values and strict matching errors.
- [x] **Step 5: Remove estimated-calorie controls and prevent client-side defaulting of story/tips/base servings/difficulty/duration.**
- [x] **Step 6: Run admin focused tests and admin type-check.**

### Task 5: End-to-end verification and documentation log

**Files:**
- Modify: `docs/plans/minor_change_log.md`
- Modify: `docs/api-contract.md` only if the current concrete import endpoint/owner predicate needs synchronization
- Modify: `docs/plans/recipe-admin-json-conversion.md` only for verified contract corrections

- [x] **Step 1: Run parser, service/import-contract, owner-pool, and admin focused tests.**
- [x] **Step 2: Run `pnpm --filter @next-meal/api prisma:generate`.**
- [x] **Step 3: Run `pnpm --filter @next-meal/api type-check`, `pnpm --filter @next-meal/admin type-check`, and `pnpm --filter @next-meal/api verify:openapi`.**
- [x] **Step 4: Run the smallest real API import path with a valid JSON fixture and an invalid-match fixture; verify database state before and after publish.**
- [x] **Step 5: Run `git diff --check` and inspect the full diff for scope drift and preservation of existing work.**
- [x] **Step 6: Record exact commands, results, and remaining runtime/migration gates in `minor_change_log.md`.**

## Self-review

- The JSON document’s required content, labels, tools, assistant actions, strict matching, derived nutrition, pending-review gate, and omitted internal IDs each have a task.
- Existing import jobs are preserved as historical rows; only new imports use the strict JSON source.
- No task adds UID/nickname/cookNo to the JSON document.
- No task allows fuzzy amounts into a formal recipe version.
- Public predicate updates are included because random owner assignment would otherwise hide imported inspiration recipes or misclassify them as private recipes.
