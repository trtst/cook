# System Ingredient Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an audited admin soft-merge that preserves a source ingredient as a `MERGED` lookup entry and routes future mutable references to one `ACTIVE` target ingredient.

**Architecture:** Reuse `Ingredient.status` and `mergedToId`, enforce row invariants with a forward migration, and keep the merge command in the existing Admin ingredient boundary. Extend exact import matching to resolve a merged source to its active target, migrate only mutable fridge/shopping/unpublished-import references, and leave fixed recipe versions and historical nutrition/review facts unchanged.

**Tech Stack:** PostgreSQL 15+, Prisma 5.22.0, NestJS 11, TypeScript 5.9, Vue 3, Element Plus, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-15-system-ingredient-merge-design.md`

## Global Constraints

- Source must be a system `ACTIVE` or `DISABLED` ingredient; target must be another system `ACTIVE` ingredient.
- Merge relationships stay one level deep; existing `mergedFrom` rows are repointed to the final active target.
- Do not add a candidate table, alias table, fuzzy matching, bulk merge, or unmerge.
- Do not mutate published `RecipeContentVersion`, published import items, review history, source nutrition mappings, or source unit conversions.
- Preserve fridge/shopping name, quantity, unit, note, status, and row identity while changing only `ingredientId`.
- Use numeric-string `Idempotency-Key`, source `expectedVersion`, one transaction, and an admin audit event.
- Keep current user changes and staged/unstaged boundaries; do not commit or push.

---

### Task 1: Database invariants and admin contract

**Files:**
- Create: `apps/api/prisma/migrations/20260915233000_system_ingredient_merge/migration.sql`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/modules/auth/admin.controller.ts`
- Test: `apps/api/src/modules/admin/admin.system-ingredient.service.test.ts`
- Modify: `apps/api/src/contracts/ingredient-openapi.test.ts`

**Interfaces:**
- Consumes: existing `IngredientStatus.MERGED`, `Ingredient.mergedToId`, `VersionedOperationDto`, `ApiIdempotencyKey`, and JSON `ok(...)` envelope.
- Produces: `MergeAdminIngredientDto { expectedVersion; targetIngredientId }`, `AdminIngredientMergeResult`, `POST /admin/ingredients/:ingredientId/merge`, and `AdminIngredientSummary.mergedTo`.

- [x] **Step 1: Add failing schema and contract tests**

Add assertions that the migration contains a preflight exception plus these checks:

```sql
CHECK (("status" = 'MERGED') = ("merged_to_id" IS NOT NULL))
CHECK ("merged_to_id" IS NULL OR "merged_to_id" <> "id")
```

Add contract assertions for:

```ts
type AdminIngredientStatus = "PENDING" | "ACTIVE" | "DISABLED" | "MERGED";
type AdminIngredientMergeResult = {
  sourceIngredientId: UUID;
  targetIngredientId: UUID;
  mergedAt: IsoDateTime;
};
```

The OpenAPI route must require `Idempotency-Key`, `expectedVersion`, and `targetIngredientId`, and return the standard JSON envelope.

- [x] **Step 2: Run tests and confirm RED**

Run:

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
pnpm --filter @next-meal/api exec tsx src/contracts/ingredient-openapi.test.ts
```

Expected: FAIL because the merge migration, DTO, response type, and route do not exist and `MERGED` is not in the admin summary/list query contract.

- [x] **Step 3: Implement the migration and contract**

The migration must abort on malformed current rows before adding checks:

```sql
IF EXISTS (
  SELECT 1 FROM "ingredients" i
  LEFT JOIN "ingredients" target ON target."id" = i."merged_to_id"
  WHERE (i."status" = 'MERGED') <> (i."merged_to_id" IS NOT NULL)
     OR i."merged_to_id" = i."id"
     OR (i."status" = 'MERGED' AND (
       target."id" IS NULL OR target."owner_id" IS NOT NULL OR target."status" <> 'ACTIVE'
     ))
) THEN
  RAISE EXCEPTION 'Invalid ingredient merge relationship';
END IF;
```

Add `MergeAdminIngredientDto extends VersionedOperationDto` with a positive integer `targetIngredientId`, an OpenAPI result model, and the controller method:

```ts
@Post("ingredients/:ingredientId/merge")
@UseGuards(AdminAuthGuard)
@ApiBearerAuth("AdminBearerAuth")
@ApiIdempotencyKey()
mergeIngredient(...) {
  return this.adminService.mergeIngredient(
    ingredientId,
    { ...body, operationId },
    request.admin.adminId
  ).then(result => ok(result));
}
```

- [x] **Step 4: Run tests and Prisma validation for GREEN**

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
pnpm --filter @next-meal/api exec tsx src/contracts/ingredient-openapi.test.ts
pnpm --filter @next-meal/api exec prisma validate --schema prisma/schema.prisma
```

Expected: PASS.

---

### Task 2: Transactional merge command and mutable reference migration

**Files:**
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Test: `apps/api/src/modules/admin/admin.system-ingredient.service.test.ts`
- Test: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`

**Interfaces:**
- Consumes: `MergeAdminIngredientRequest`, admin idempotency helpers, `Ingredient.version`, fridge/shopping foreign keys, and `RecipeImportItem.recipeBodyJson`.
- Produces: `AdminService.mergeIngredient(sourceIngredientId, body, adminId): Promise<AdminIngredientMergeResult>`.

- [x] **Step 1: Add failing service tests**

Cover these independent behaviors with literal fixtures:

```ts
await service.mergeIngredient(10000024, {
  operationId: "92001",
  expectedVersion: 3,
  targetIngredientId: 10000001
}, 1);
```

Assert that:

- `ACTIVE` and `DISABLED` sources become `MERGED` with `mergedToId=10000001` and incremented version.
- Existing rows whose `mergedToId=10000024` are repointed to `10000001`.
- Fridge and shopping updates change only `ingredientId`.
- Unpublished JSON import ingredients become `{ ingredientId: 10000001, name: "茄子", categoryCode: "PRODUCE" }`, with validation and job counts recalculated.
- Published import items, `RecipeContentVersion`, recommendation/feedback records, nutrition mappings, and conversions receive no update call.
- stale version, same source/target, personal source/target, `PENDING` source, and non-`ACTIVE` target reject before writes.
- same idempotency key returns its stored result without repeated updates.

- [x] **Step 2: Run the focused tests and confirm RED**

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts
```

Expected: FAIL because `mergeIngredient` and its mutable-reference rewrite do not exist.

- [x] **Step 3: Implement the minimal transaction**

Use the existing idempotency pattern with scope `admin-ingredient:merge` and a request hash containing source ID, expected version, and target ID. Inside one transaction:

```ts
const source = await tx.ingredient.findFirst({
  where: { id: sourceIngredientId, ownerId: null },
  include: { category: true, defaultUnit: true }
});
const target = await tx.ingredient.findFirst({
  where: { id: body.targetIngredientId, ownerId: null, status: "ACTIVE" },
  include: { category: true, defaultUnit: true }
});
```

Validate source state/version, conditionally update source using `id + version + status`, repoint current children, update `FridgeItem` and `ShoppingItem`, rewrite only non-published import items, recalculate touched jobs, then create:

```ts
{
  action: "INGREDIENT_MERGED",
  objectType: "INGREDIENT",
  objectId: sourceIngredientId,
  payload: { sourceStatus, targetIngredientId, repointedCount, fridgeCount, shoppingCount, importItemCount }
}
```

Complete the idempotency record with `{ sourceIngredientId, targetIngredientId, mergedAt }`. Do not write any target profile field or historical/fixed content.

- [x] **Step 4: Run focused tests for GREEN**

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts
```

Expected: PASS.

---

### Task 3: Admin listing and exact import resolution

**Files:**
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/modules/recipe/recipe.service.ts`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Test: `apps/api/src/modules/admin/admin.system-ingredient.service.test.ts`
- Test: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`

**Interfaces:**
- Consumes: exact normalized `searchKey` matching and `AdminIngredientSummary`.
- Produces: list status `MERGED`, `mergedTo: { id; name } | null`, and import precedence `ACTIVE > MERGED(target) > PENDING > DISABLED`.

- [x] **Step 1: Add failing behavior tests**

Add a list test that requests `status=MERGED` and expects the query to include `mergedTo`, plus an `ALL` test expecting all four statuses. Assert category governance counts include `ACTIVE / DISABLED / MERGED` and add `PENDING` only for `UNCLASSIFIED`. Add import fixtures with the same `searchKey` in different states and assert these literal final IDs:

```ts
ACTIVE   -> 10000001
MERGED   -> mergedTo.id === 10000001
PENDING  -> its own pending id
DISABLED -> its own disabled id
```

For a merged match, assert the saved import name and category come from the active target, not the source or JSON suggestion.

- [x] **Step 2: Run tests and confirm RED**

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts
```

Expected: FAIL because list mapping collapses `MERGED` to `ACTIVE` and import matching ignores merged rows.

- [x] **Step 3: Implement list mapping and exact target resolution**

Change summary mapping to preserve all four statuses and expose only the target minimum:

```ts
mergedTo: ingredient.mergedTo
  ? { id: ingredient.mergedTo.id, name: ingredient.mergedTo.name }
  : null
```

List `ALL` with `in: ["PENDING", "ACTIVE", "DISABLED", "MERGED"]`, and include `MERGED` in category governance counts. For import matching, rank exact `searchKey` rows, validate a merged row has an active system target, and return the target as the matched ingredient. Do not follow more than one hop or fall back to fuzzy/alias guessing.

- [x] **Step 4: Run focused tests for GREEN**

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts
```

Expected: PASS.

---

### Task 4: Admin merge interface

**Files:**
- Modify: `apps/admin/src/apis/ingredient.ts`
- Modify: `apps/admin/src/pages/IngredientItemsPage.vue`
- Test: `apps/admin/src/pages/ingredient-items.test.js`

**Interfaces:**
- Consumes: `POST /admin/ingredients/:sourceId/merge`, `AdminIngredientSummary.mergedTo`, and paged active ingredient search.
- Produces: “已归并” filter, merge dialog, active-target selection, confirmation, and refresh.

- [x] **Step 1: Add failing page tests**

Assert user-observable behavior:

- Status selector includes `value="MERGED"` labeled “已归并”.
- `ACTIVE` and `DISABLED` cards show “合并”; `PENDING` and `MERGED` do not.
- Merged card renders `归并至：{{ row.mergedTo.name }}` and does not render edit/status/delete actions.
- Merge dialog searches active targets, excludes the source ID, and sends `{ operationId, expectedVersion, targetIngredientId }`.
- Confirmation includes “不会覆盖主食材资料” and “已发布菜谱不会改写”.

- [x] **Step 2: Run the page test and confirm RED**

```bash
node --test apps/admin/src/pages/ingredient-items.test.js
```

Expected: FAIL because the filter, dialog, API method, and merged target display do not exist.

- [x] **Step 3: Implement the API type and page interaction**

Add:

```ts
export interface MergeIngredientPayload {
  operationId: OperationId;
  expectedVersion: number;
  targetIngredientId: UUID;
}
```

and `ingredientApi.mergeIngredient(sourceId, body)`. In the page, keep dialog state local, request only `status: "ACTIVE"`, filter out the source, require one target, show the confirmed warning, call the API, close the dialog, and refresh categories/list. Merged rows show only the target relation.

- [x] **Step 4: Run Admin test and type-check for GREEN**

```bash
node --test apps/admin/src/pages/ingredient-items.test.js
pnpm --filter @next-meal/admin type-check
```

Expected: PASS.

---

### Task 5: Documentation and complete verification

**Files:**
- Modify: `docs/ingredient.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/plans/minor_change_log.md`
- Modify: `docs/superpowers/plans/2026-09-15-system-ingredient-merge.md`

**Interfaces:**
- Consumes: implemented behavior and actual command output.
- Produces: synchronized product/API documentation and final evidence.

- [x] **Step 1: Synchronize authoritative docs**

Update exact import precedence to `ACTIVE > MERGED（取目标） > PENDING > DISABLED`; document source/target states, one-level relation, immutable fixed versions, mutable reference migration, endpoint request/response, and the `MERGED` list summary. Remove any wording that still says the admin list has only three states.

- [x] **Step 2: Run all targeted verification**

```bash
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.system-ingredient.service.test.ts
pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.recipe-import.service.test.ts
pnpm --filter @next-meal/api exec tsx src/contracts/ingredient-openapi.test.ts
node --test apps/admin/src/pages/ingredient-items.test.js
pnpm --filter @next-meal/api exec prisma validate --schema prisma/schema.prisma
pnpm --filter @next-meal/api type-check
pnpm --filter @next-meal/admin type-check
pnpm --filter @next-meal/api verify:openapi
pnpm --filter @next-meal/api build
pnpm --filter @next-meal/admin build
git diff --check
```

Expected: all targeted tests, Prisma validation, type checks, builds, and diff check pass. If the repository-wide OpenAPI gate remains blocked by an unrelated pre-existing Blob response, report the exact existing failure separately and keep the ingredient-specific contract test as evidence.

- [x] **Step 3: Apply and inspect the local migration only after preflight**

```bash
pnpm --filter @next-meal/api exec prisma migrate status --schema prisma/schema.prisma
pnpm --filter @next-meal/api exec prisma migrate deploy --schema prisma/schema.prisma
```

Before deploy, run a read-only audit for malformed merge rows and record the count. Do not merge real ingredient records automatically; the first real `长茄子 → 茄子` operation remains an explicit admin browser acceptance action.

- [x] **Step 4: Update the central log and perform scope self-check**

Record actual files, commands, passes/failures, migration status, and remaining browser/production gates. Confirm the diff contains no candidate/alias table, fixed-version rewrite, nutrition migration, unmerge, bulk merge, fuzzy matching, unrelated refactor, commit, or push.
