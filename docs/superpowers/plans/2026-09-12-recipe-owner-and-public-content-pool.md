# Recipe Owner And Public Content Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every recipe have a stable owner and owner-nickname snapshot, replace recipe-only inspiration owners with the reusable 100-user public-content pool, and remove `curatedByName` end to end.

**Architecture:** `Recipe.ownerId` becomes a required user relation and `Recipe.ownerNicknameSnapshot` freezes the name at recipe creation. A dedicated `PublicContentUserPoolMember` relation owns the fixed 100-user pool for platform-authored public content; the selection helper remains transaction-scoped. The API returns the immutable recipe owner summary, while only the admin user API exposes pool membership.

**Tech Stack:** NestJS, Prisma/PostgreSQL migration SQL, OpenAPI decorators, Vue 3, uni-app, Element Plus, TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-12-recipe-owner-and-public-content-pool-design.md`

## Global Constraints

- `curatedByName` must be removed from schema, SQL, DTOs, OpenAPI, services, client/admin types, UI and docs; no compatibility fallback is allowed.
- Public content pool membership must contain exactly 100 `ACTIVE` users; it is backend/admin-only and cannot be returned by mini-program APIs.
- Delete only historical rows matching `is_inspiration = true AND owner_id IS NULL`; non-inspiration null owners make the migration fail.
- A recipe owner nickname is an immutable `ownerNicknameSnapshot`; changing the User nickname must not update recipes.
- Do not transfer owners or use the pool for real participants, operators, authorization, or personal content.
- Preserve existing uncommitted UI changes and do not revert unrelated files.

---

### Task 1: Build the public-content pool and enforce recipe owner persistence

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_recipe_owner_snapshot_and_public_content_pool/migration.sql`
- Rename: `apps/api/src/modules/recipe/recipe-inspiration-owner.ts` to `apps/api/src/modules/recipe/public-content-user-pool.ts`
- Rename: `apps/api/src/modules/recipe/recipe-inspiration-owner.test.ts` to `apps/api/src/modules/recipe/public-content-user-pool.test.ts`
- Modify: `apps/api/scripts/ensure-recipe-inspiration-owner-pool.ts`, `apps/api/package.json`
- Modify consumers: `apps/api/src/modules/{recipe,meal,home,pantry,admin}/*.ts`

**Interfaces:**
- Produces `pickPublicContentOwner(tx): Promise<number>` and `publicInspirationRecipeWhere(status)`.
- Produces `Recipe.ownerId: Int`, `Recipe.ownerNicknameSnapshot: String?`, and `PublicContentUserPoolMember` with one row per user.

- [ ] **Step 1: Write failing pool invariants tests**

```ts
test("picks only an ACTIVE member from exactly 100 public-content pool users", () => {
  const ids = Array.from({ length: 100 }, (_, index) => index + 1);
  assert(ids.includes(pickPublicContentOwnerId(ids)));
});

test("rejects a pool with anything other than 100 distinct active users", () => {
  assert.throws(() => pickPublicContentOwnerId([1]), /正好包含 100 个用户/);
});
```

- [ ] **Step 2: Run the focused test and observe the old helper/name mismatch**

Run: `pnpm --filter @next-meal/api exec tsx src/modules/recipe/public-content-user-pool.test.ts`

Expected: FAIL because the public-content pool export does not exist.

- [ ] **Step 3: Implement pool rename and migration**

```prisma
model PublicContentUserPoolMember {
  userId    Int      @id @map("user_id")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("public_content_user_pool_members")
}

model Recipe {
  ownerId               Int      @map("owner_id")
  ownerNicknameSnapshot String?  @map("owner_nickname_snapshot") @db.VarChar(64)
  owner                 User     @relation("RecipeOwner", fields: [ownerId], references: [id])
}
```

The SQL migration must rename the existing membership table, delete only the confirmed old ownerless inspiration rows and all rows that directly reference them, assert no remaining `recipes.owner_id IS NULL`, drop both `recipes.curated_by_name` and `recipe_recommendations.curated_by_name`, add the snapshot column, and then set `owner_id NOT NULL`. The migration must explicitly lock/reject when non-inspiration null owners remain.

- [ ] **Step 4: Update all public-inspiration predicates/imports and pool bootstrap script**

```ts
export async function pickPublicContentOwner(tx: Prisma.TransactionClient) {
  const rows = await tx.publicContentUserPoolMember.findMany({
    where: { user: { status: "ACTIVE" } },
    select: { userId: true },
    orderBy: { userId: "asc" }
  });
  return pickPublicContentOwnerId(rows.map(row => row.userId));
}
```

Update the pool bootstrap script and package command to maintain exactly 100 active pool members; no user-side response gains this field.

- [ ] **Step 5: Run focused tests and Prisma validation**

Run: `pnpm --filter @next-meal/api exec tsx src/modules/recipe/public-content-user-pool.test.ts && pnpm --filter @next-meal/api prisma:validate`

Expected: PASS, and the generated Prisma schema accepts required recipe ownership.

### Task 2: Freeze owner snapshots across every recipe creation flow

**Files:**
- Modify: `apps/api/src/modules/recipe/recipe.service.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/modules/recipe/recipe.service.test.ts` (create if absent)
- Modify: `apps/api/src/modules/admin/admin.service.test.ts`

**Interfaces:**
- Consumes `Recipe.ownerNicknameSnapshot` and `pickPublicContentOwner` from Task 1.
- Produces owner/snapshot writes for draft publication, creating from inspiration, recommendation approval, direct admin creation and JSON import publication.

- [ ] **Step 1: Write failing tests for snapshot behavior**

```ts
test("recommendation approval preserves the source recipe owner and nickname snapshot", async () => {
  const result = await approveRecommendation(fixture);
  assert.equal(result.ownerId, fixture.source.ownerId);
  assert.equal(result.ownerNicknameSnapshot, fixture.source.ownerNicknameSnapshot);
});

test("platform publication snapshots the selected pool user's current nickname", async () => {
  const recipe = await publishImportedRecipe(fixture);
  assert.equal(recipe.ownerNicknameSnapshot, fixture.selectedPoolUser.nickname);
});
```

- [ ] **Step 2: Run focused tests and observe expected missing snapshot assertions**

Run: `pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.service.test.ts`

Expected: FAIL because creation inputs do not write `ownerNicknameSnapshot` and recommendation approval currently creates an ownerless recipe.

- [ ] **Step 3: Add a single snapshot normalizer and apply it only at creation**

```ts
function toOwnerNicknameSnapshot(nickname: string | null | undefined) {
  return nickname?.trim() || null;
}
```

At each create input, write an owner ID and this snapshot. Recommendation approval copies both values from the source recipe. Existing edit/update paths must not include either field.

- [ ] **Step 4: Update user update tests to prove nickname changes do not mutate a recipe**

```ts
assert.equal(recipeAfterUserRename.ownerNicknameSnapshot, "发布时昵称");
assert.equal(userAfterRename.nickname, "新昵称");
```

- [ ] **Step 5: Run focused recipe/admin tests**

Run: `pnpm --filter @next-meal/api exec tsx src/modules/recipe/recipe.service.test.ts && pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.service.test.ts && pnpm --filter @next-meal/api exec tsx src/modules/admin/recipe-import-json.test.ts`

Expected: PASS with all five creation paths writing immutable snapshots.

### Task 3: Replace the public recipe owner contract and restrict pool membership to admin

**Files:**
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/modules/recipe/recipe.service.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/modules/auth/admin.controller.ts`
- Modify: `apps/api/src/modules/auth/admin-phone-reveal.contract.test.ts`
- Modify: `docs/api-contract.md`, `docs/api-index.md`, `docs/client-api.md`

**Interfaces:**
- Produces `RecipeOwnerSummary { uid: number; nickname: string | null }`.
- `InspirationRecipeDetail.owner` maps `Recipe.owner.uid` plus `Recipe.ownerNicknameSnapshot`.
- `UserProfile.isPublicContentPoolMember` is available only through `/admin/users` and admin user detail responses.

- [ ] **Step 1: Write failing contract tests**

```ts
assert.equal(detail.owner.uid, owner.uid);
assert.equal(detail.owner.nickname, "发布时昵称");
assert.equal("curatedByName" in detail, false);
assert.equal("isPublicContentPoolMember" in publicSessionUser, false);
```

- [ ] **Step 2: Run tests and observe old detail shape**

Run: `pnpm --filter @next-meal/api exec tsx src/modules/auth/admin-phone-reveal.contract.test.ts`

Expected: FAIL until public contract mapping removes `curatedByName` and admin mapping includes the pool flag.

- [ ] **Step 3: Implement explicit owner DTO mapping**

```ts
owner: {
  uid: recipe.owner.uid,
  nickname: recipe.ownerNicknameSnapshot
}
```

Do not return `User.nickname` directly in this mapping. Add the admin-only pool flag to its existing profile mapper/select and OpenAPI schema; do not add it to `SessionUser`, `/auth/me`, or mini-program endpoints.

- [ ] **Step 4: Synchronize contract documents**

Replace the old curation snapshot wording with the owner snapshot semantics, list the admin-only flag, and remove every `curatedByName` field declaration/reference that describes a current contract.

- [ ] **Step 5: Run contract/type checks**

Run: `pnpm --filter @next-meal/api type-check && pnpm --filter @next-meal/api exec tsx src/modules/auth/admin-phone-reveal.contract.test.ts`

Expected: PASS; generated OpenAPI models and internal contract types agree.

### Task 4: Show public-content-pool membership in the admin user list

**Files:**
- Modify: `apps/admin/src/apis/user.ts`
- Modify: `apps/admin/src/pages/UsersPage.vue`
- Modify: `apps/admin/src/pages/users-page.test.js`

**Interfaces:**
- Consumes admin-only `UserProfile.isPublicContentPoolMember: boolean` from Task 3.
- Produces a read-only `公共内容池` status column/tag in the existing admin user list.

- [ ] **Step 1: Write a failing static page test**

```js
expectIncludes("isPublicContentPoolMember", userApiSource);
expectIncludes("公共内容池", usersPageSource);
```

- [ ] **Step 2: Run it and observe missing type/column**

Run: `pnpm --filter @next-meal/admin exec node src/pages/users-page.test.js`

Expected: FAIL until the admin type and list column exist.

- [ ] **Step 3: Add the read-only status column**

```vue
<el-tag v-if="row.isPublicContentPoolMember" type="success" effect="plain">公共内容池</el-tag>
<span v-else>-</span>
```

Do not add client-side pool selection, mutation controls, or member-list endpoints.

- [ ] **Step 4: Run focused admin test and type-check**

Run: `pnpm --filter @next-meal/admin exec node src/pages/users-page.test.js && pnpm --filter @next-meal/admin type-check`

Expected: PASS.

### Task 5: Consume owner snapshots in the mini-program detail UI and complete documentation

**Files:**
- Modify: `apps/client/src/apis/recipe.ts`
- Modify: `apps/client/src/pages_recipe/detail/index.vue`
- Modify: `apps/client/src/pages_recipe/detail/style.test.ts`
- Modify: `docs/recipe.md`, `docs/plans/minor_change_log.md`

**Interfaces:**
- Consumes `InspirationRecipeDetail.owner: RecipeOwnerSummary` from Task 3.
- Produces one attribution computation for all recipe detail variants using only `detail.owner.nickname`.

- [ ] **Step 1: Write a failing detail regression assertion**

```ts
assert.ok(source.includes("return detailOwner.value?.nickname?.trim() || \"\";"));
assert.equal(source.includes("curatedByName"), false);
assert.equal(source.includes("sessionStore.user?.nickname"), false);
```

- [ ] **Step 2: Run test and observe current legacy attribution sources**

Run: `pnpm --filter @next-meal/client exec tsx src/pages_recipe/detail/style.test.ts`

Expected: FAIL because the UI still reads session nickname or `curatedByName`.

- [ ] **Step 3: Update client DTO and attribution computation**

```ts
interface RecipeOwnerSummary {
  uid: number;
  nickname: string | null;
}

const attributionName = computed(() => detailOwner.value?.nickname?.trim() || "");
```

Populate `detailOwner` from the loaded recipe response and preserve the existing conditional render that hides an empty name. Do not put the owner into recipe list cards.

- [ ] **Step 4: Update product/timeline documentation**

Describe the frozen owner nickname, admin-only pool membership and deletion of old ownerless inspiration recipes. Add a central change-log entry only after all implementation verification succeeds.

- [ ] **Step 5: Run client focused checks**

Run: `pnpm --filter @next-meal/client exec tsx src/pages_recipe/detail/style.test.ts && pnpm --filter @next-meal/client type-check && pnpm --filter @next-meal/client build:mp-weixin`

Expected: PASS with no `curatedByName` remaining in client source.

### Task 6: Full integration verification and scope audit

**Files:**
- Modify: `docs/plans/minor_change_log.md` only if Task 5 has not already recorded the final verified entry.

- [ ] **Step 1: Verify removal and ownership invariants statically**

Run: `rg -n "curatedByName|curated_by_name" apps/api apps/admin apps/client docs/api-contract.md docs/recipe.md`

Expected: no current implementation/contract references; historical migration notes may state that the column is dropped.

- [ ] **Step 2: Run database and API verification**

Run: `pnpm --filter @next-meal/api prisma:validate && pnpm --filter @next-meal/api type-check && pnpm --filter @next-meal/api exec tsx src/modules/recipe/public-content-user-pool.test.ts && pnpm --filter @next-meal/api exec tsx src/modules/admin/admin.service.test.ts`

Expected: PASS.

- [ ] **Step 3: Run cross-app type/build verification**

Run: `pnpm --filter @next-meal/admin type-check && pnpm --filter @next-meal/client type-check && pnpm --filter @next-meal/client build:mp-weixin && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 4: Walk the diff against the confirmed scope**

Verify that each touched file implements owner snapshots, the reusable public-content pool, admin-only pool visibility, `curatedByName` removal, legacy ownerless inspiration cleanup, or the already-confirmed recipe-list UI work; record no unrelated cleanup.
