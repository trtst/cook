# Incomplete Import Ingredient Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every unmatched JSON-import ingredient as an auditable `PENDING` system ingredient even when its default unit is missing, then let Admin complete governance without guessing data.

**Architecture:** Keep the existing `Ingredient(PENDING)` lifecycle and make `defaultUnitId` nullable outside the `ACTIVE` state. Materialization, Admin summaries, and a targeted idempotent backfill will carry incomplete candidates through the existing review transaction and import-reference rewrite path.

**Tech Stack:** NestJS, TypeScript, Prisma 5.22, PostgreSQL 15, Vue 3, Element Plus, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-15-incomplete-import-ingredient-review-design.md`

## Global Constraints

- Do not add a candidate table or placeholder unit.
- Do not infer a missing default unit or category.
- `ACTIVE` ingredients must have a system default unit; `PENDING`, `DISABLED`, and `MERGED` may have `defaultUnitId=null`.
- Fuzzy recipe amounts remain invalid for publication.
- Preserve existing staged and unstaged work in every overlapping file.
- Use only forward migrations and update `docs/plans/minor_change_log.md` when implementation is complete.

---

### Task 1: Persist incomplete imported ingredients

**Files:**
- Modify: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260915193000_incomplete_import_ingredient_review/migration.sql`

**Interfaces:**
- Consumes: `materializeImportIngredients(tx, ingredients)` and existing `IngredientStatus`.
- Produces: `Ingredient.defaultUnitId: number | null`, optional `defaultUnit`, and a `PENDING` row for an unmatched non-placeholder name regardless of `unitId`.

- [ ] **Step 1: Add a failing materialization test**

Add a test that passes `ingredientName: "白胡椒粉"`, `ingredientId: null`, `unitId: null`, `quantity: null`, and asserts one created ingredient with `{ status: "PENDING", categoryId: 777, defaultUnitId: null }` and a returned non-null `ingredientId`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts`

Expected: FAIL because the current `!item.unitId` guard skips creation.

- [ ] **Step 3: Implement nullable pending materialization**

Remove the unit requirement from the early return. Resolve a system unit only when `item.unitId` is present and create the row with `defaultUnitId: unit?.id ?? null`. Preserve placeholders, reuse names with explicit `ACTIVE > PENDING > DISABLED` priority, normalize the draft to the system category, and keep DISABLED references without reviving them.

- [ ] **Step 4: Add the forward schema migration**

Change Prisma to `defaultUnitId Int?` and `defaultUnit Unit?`. The SQL migration must:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ingredients
    WHERE owner_id IS NULL AND status = 'PENDING'
    GROUP BY search_key HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate pending system ingredient search_key';
  END IF;
END $$;

ALTER TABLE ingredients ALTER COLUMN default_unit_id DROP NOT NULL;
ALTER TABLE ingredients ADD CONSTRAINT ingredients_active_default_unit_check
CHECK (status <> 'ACTIVE' OR default_unit_id IS NOT NULL);
CREATE UNIQUE INDEX ingredients_system_search_key_pending_key
ON ingredients(search_key)
WHERE owner_id IS NULL AND status = 'PENDING';
```

- [ ] **Step 5: Generate Prisma and verify GREEN**

Run:

```bash
pnpm --filter @next-meal/api exec prisma validate
pnpm --filter @next-meal/api exec prisma generate
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts
```

Expected: Prisma validation passes and the focused test passes.

### Task 2: Expose nullable governance data safely

**Files:**
- Modify: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`
- Modify: `apps/api/src/modules/admin/admin.system-ingredient.service.test.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/admin/src/apis/ingredient.ts`

**Interfaces:**
- Produces: `AdminIngredientSummary.defaultUnit: UnitSummary | null`; pending summaries continue returning nullable `defaultUnitId/defaultUnitName`.
- Preserves: user-facing active ingredient summaries with non-null `defaultUnit`.

- [ ] **Step 1: Add failing service tests for null-unit list rows**

Cover `listPendingIngredients()` returning a JSON-import row with `defaultUnitId/defaultUnitName=null`, and `listIngredients(status=ALL, categoryId=UNCLASSIFIED)` returning a PENDING card with `defaultUnit=null`.

- [ ] **Step 2: Run both focused tests and verify RED**

Run:

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
```

Expected: FAIL at the non-null pending row type or `toUnitSummary(null)`.

- [ ] **Step 3: Implement nullable Admin mapping and contracts**

Make the pending internal row `defaultUnitId` nullable, map Admin ingredient `defaultUnit` only when present, and update API/OpenAPI/Admin local types. Do not change client `IngredientSummary`.

- [ ] **Step 4: Run focused tests and type boundaries**

Run:

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
pnpm --filter @next-meal/api type-check
pnpm --filter @next-meal/admin type-check
pnpm --filter @next-meal/api verify:openapi
```

Expected: all pass with no non-null assertion added to user-facing reads.

### Task 3: Make Admin display and review incomplete candidates honestly

**Files:**
- Modify: `apps/admin/src/pages/IngredientPendingPage.vue`
- Modify: `apps/admin/src/pages/IngredientItemsPage.vue`
- Modify: `apps/admin/src/pages/RecipeImportItemPage.vue`
- Modify: `apps/admin/src/pages/ingredient-items.test.js`
- Modify: `apps/admin/src/pages/recipe-import-json.test.js`
- Create: `apps/admin/src/pages/ingredient-pending.test.js`

**Interfaces:**
- Consumes: nullable `AdminIngredientSummary.defaultUnit` and nullable pending-unit fields.
- Produces: “待补充” for absent review facts, blank approval fields, and separate “待归类” versus “未匹配” labels.

- [ ] **Step 1: Add failing Admin regression tests**

Cover these observable rules: pending rows render “待补充”; `openReview()` leaves missing category/unit blank; pending system cards tolerate `defaultUnit=null`; import rows with a real PENDING id display “待归类”, while empty ids display “未匹配”.

- [ ] **Step 2: Run Admin focused tests and verify RED**

Run:

```bash
pnpm --filter @next-meal/admin exec node --test src/pages/ingredient-pending.test.js
pnpm --filter @next-meal/admin exec node --test src/pages/ingredient-items.test.js
pnpm --filter @next-meal/admin exec node --test src/pages/recipe-import-json.test.js
```

Expected: at least the automatic first-option defaults and empty-id “待归类” assertions fail.

- [ ] **Step 3: Implement the minimal page behavior**

Use `row.defaultUnit?.name || "默认单位待补充"` in the system card. In the review dialog, set category/unit only from real selectable values and otherwise use `""`. Return only the current import body's `ACTIVE / PENDING / DISABLED` ingredient references from the detail API instead of paging through the whole PENDING collection; format PENDING as “待归类”, DISABLED as “已下架”, and an empty id as “未匹配”.

- [ ] **Step 4: Run focused tests and Admin checks**

Run the three focused tests, `pnpm --filter @next-meal/admin type-check`, and `pnpm --filter @next-meal/admin build`.

Expected: all pass.

### Task 4: Repair existing unpublished JSON import drafts

**Files:**
- Create: `apps/api/scripts/backfill-import-pending-ingredients.ts`
- Create: `apps/api/scripts/backfill-import-pending-ingredients.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Produces: `pnpm --filter @next-meal/api backfill:import-pending-ingredients -- [--apply]`.
- Output fields: `scannedItems`, `repairedReferences`, `createdPending`, `disabledConflicts`, `versionConflicts`, `errors`.

- [ ] **Step 1: Write failing backfill behavior tests**

Use a focused repository double to run the exported backfill function and assert literal outcomes for dry-run zero writes, apply with null unit, ACTIVE/PENDING reuse, DISABLED reference preservation without revival, repeated apply, and optimistic-version conflict.

- [ ] **Step 2: Run the script test and verify RED**

Run: `pnpm --filter @next-meal/api exec tsx scripts/backfill-import-pending-ingredients.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the idempotent backfill and package command**

Scan only non-PUBLISHED JSON items. Normalize names with the existing search-key rule, preserve valid `unitId`, create null-unit PENDING rows when absent, rebuild item errors/status, and update with `{ id, version }`. Default to dry-run and require exact `--apply` for writes.

- [ ] **Step 4: Run the focused backfill tests**

Run the script test twice. Expected: all cases pass and repeated apply reports no additional creation.

### Task 5: Apply locally, verify real behavior, and document delivery

**Files:**
- Modify: `docs/ingredient.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/plans/minor_change_log.md`

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: migrated local database, repaired task `38`, current documentation, and verification evidence.

- [ ] **Step 1: Update current rules and contract**

State that unmatched JSON names create PENDING rows even without a default unit; nullable means “待管理员补充”; ACTIVE remains non-null by database Check. Record the exact change and completed validations in the central minor change log.

- [ ] **Step 2: Run complete targeted static verification**

Run:

```bash
pnpm --filter @next-meal/api exec prisma validate
pnpm --filter @next-meal/api type-check
pnpm --filter @next-meal/admin type-check
pnpm --filter @next-meal/api verify:openapi
pnpm --filter @next-meal/api build
pnpm --filter @next-meal/admin build
git diff --check
```

- [ ] **Step 3: Apply the forward migration to the configured local database**

Run: `pnpm --filter @next-meal/api exec prisma migrate deploy`

Expected: migration `20260915193000_incomplete_import_ingredient_review` applies successfully.

- [ ] **Step 4: Dry-run and apply the existing-draft repair**

Run:

```bash
pnpm --filter @next-meal/api backfill:import-pending-ingredients
pnpm --filter @next-meal/api backfill:import-pending-ingredients -- --apply
pnpm --filter @next-meal/api backfill:import-pending-ingredients
```

Confirm task `38` creates or reuses a PENDING “白胡椒粉”, the final dry-run reports no remaining eligible repairs, and no default unit was inferred.

- [ ] **Step 5: Verify the real API and Admin UI**

Authenticate through the existing local Admin flow and confirm “白胡椒粉” is returned by both `/admin/pending-ingredients` and `/admin/ingredients?categoryId=5009&status=ALL`. In the browser, confirm its review dialog starts with blank category/default unit and the pending card does not crash.

- [ ] **Step 6: Walk the final diff**

Answer the repository scope self-check: requirement satisfied, necessity of every file, intentionally omitted follow-ups, rejected abstractions, and whether the patch can be smaller.
