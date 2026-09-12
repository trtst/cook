# Stable Dining Memory Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse one public WeChat mini-program code for every memory poster belonging to the same dining event.

**Architecture:** The dining event owns the stored mini-code object key, while each memory snapshot remains a content snapshot. A signed token derived from the event ID is the public code scene and resolves to that event's newest snapshot. The client keeps a title edit local to Canvas and only creates a new snapshot for public-content changes.

**Tech Stack:** NestJS, Prisma/PostgreSQL migrations, uni-app Vue 3, TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-12-stable-dining-memory-code-design.md`

## Global Constraints

- Do not expose a raw dining-event or meal-plan ID in the public QR scene or preview response.
- Keep `pages_share/preview/index` invitation links independent from `pages_share/memory/index` memory codes.
- Generate a code only when a dining event has no stored memory-code object key.
- Preserve snapshot content white-listing and owner/time/menu checks.
- Update API contract, OpenAPI/local types, Prisma schema/migration, focused tests, and `docs/plans/minor_change_log.md` together.

---

### Task 1: Persist and resolve the stable event memory code

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260912120000_dining_event_stable_memory_code/migration.sql`
- Modify: `apps/api/src/modules/meal/meal.service.ts`
- Test: `apps/api/src/modules/meal/meal.service.test.ts`

**Interfaces:**
- Produces `createDiningMemoryShareToken(eventId: number): string`, a signed opaque token for the stable memory entry.
- Produces a nullable `DiningEvent.memoryMiniCodeStorageKey` that records the one generated code object.
- Changes `GET /memory-shares/{token}/preview` to resolve the signed event token and return the newest snapshot for that event.

- [ ] **Step 1: Write failing service tests**

Add tests that prove a stable token can be recreated from the same event ID, a tampered token is rejected, and public preview resolves the newest snapshot for the signed event token rather than a snapshot token.

- [ ] **Step 2: Run the targeted service test**

Run: `pnpm exec tsx --test src/modules/meal/meal.service.test.ts`

Expected: FAIL because there is no stable memory token parser and preview still looks up `DiningEventMemoryShare.shareTokenHash`.

- [ ] **Step 3: Implement the minimal service and schema change**

Add the nullable `memory_mini_code_storage_key` column to `dining_events`. Implement signed token creation/parsing using the existing event-share secret pattern with a distinct `dining-memory-share:` payload. Resolve public preview through the validated event ID and latest snapshot. Keep snapshot `shareTokenHash` internal and unique.

- [ ] **Step 4: Run the targeted service test**

Run: `pnpm exec tsx --test src/modules/meal/meal.service.test.ts`

Expected: PASS.

### Task 2: Generate the code only once and retain public asset access

**Files:**
- Modify: `apps/api/src/modules/meal/meal.service.ts`
- Modify: `apps/api/src/modules/upload/upload.service.ts`
- Test: `apps/api/src/modules/meal/meal.service.test.ts`
- Test: `apps/api/src/modules/upload/upload.service.test.ts`

**Interfaces:**
- Consumes `DiningEvent.memoryMiniCodeStorageKey` and `createDiningMemoryShareToken(eventId)`.
- Produces `DiningMemoryShareSnapshot.miniCodeUrl` backed by the stored event code object.

- [ ] **Step 1: Write failing tests**

Add a service test where an event already has `memoryMiniCodeStorageKey`; assert a new content snapshot uses that exact key and never calls `createMemoryShareCode` or `storeDiningMemoryMiniCode`. Add an upload test that permits the same stored code when referenced by a memory snapshot.

- [ ] **Step 2: Run focused API tests**

Run: `pnpm exec tsx --test src/modules/meal/meal.service.test.ts src/modules/upload/upload.service.test.ts`

Expected: FAIL because creation always calls WeChat and computes the object key from a new snapshot token.

- [ ] **Step 3: Implement one-time code generation**

When `memoryMiniCodeStorageKey` is absent, generate/store the code using the stable signed event token and persist the key with the new snapshot. When it is present, skip both external operations and write the existing key into the new snapshot. Maintain existing compensation for a newly written object only.

- [ ] **Step 4: Run focused API tests**

Run: `pnpm exec tsx --test src/modules/meal/meal.service.test.ts src/modules/upload/upload.service.test.ts`

Expected: PASS.

### Task 3: Align contracts and Canvas invalidation behavior

**Files:**
- Modify: `docs/api-contract.md`
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/client/src/pages_share/memory/index.vue`
- Test: `apps/client/src/pages_share/memory/memory-page-behavior.test.ts`

**Interfaces:**
- Consumes stable `sharePath` and unchanged `miniCodeUrl` from the existing memory-share response.
- Produces a Canvas-only title invalidation path that leaves the current server snapshot and code intact.

- [ ] **Step 1: Write failing client behavior tests**

Add a behavior test requiring an eligible event-memory page load to create its first snapshot/code, title edits to clear only `posterFilePath`, and caption or participant visibility changes to clear the server snapshot before the next export.

- [ ] **Step 2: Run the focused client test**

Run: `pnpm exec tsx --test src/pages_share/memory/memory-page-behavior.test.ts`

Expected: FAIL because the title watcher currently clears `shareSnapshot`.

- [ ] **Step 3: Implement the smallest UI and contract updates**

Split title image invalidation from public-content snapshot invalidation. On an eligible event-memory page load, create the first snapshot so its fixed code is ready before the user exports a poster. Update contract/OpenAPI/types to state that `sharePath` and `miniCodeUrl` are event-stable, and that public preview returns the newest snapshot at the stable token.

- [ ] **Step 4: Run the focused client test**

Run: `pnpm exec tsx --test src/pages_share/memory/memory-page-behavior.test.ts`

Expected: PASS.

### Task 4: Verify and record delivery

**Files:**
- Modify: `docs/plans/minor_change_log.md`

- [ ] **Step 1: Run focused API and client regression suites**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/meal/meal.service.test.ts src/modules/upload/upload.service.test.ts` and `pnpm --filter @next-meal/client exec tsx --test src/pages_share/memory/memory-page-behavior.test.ts src/pages_share/memory/memory-poster-renderer.test.ts`.

- [ ] **Step 2: Run type checks and builds**

Run: `pnpm type-check`, `pnpm build:api`, and `pnpm --filter @next-meal/client build:mp-weixin`.

- [ ] **Step 3: Check migration and diff**

Run: `pnpm --filter @next-meal/api prisma validate` and `git diff --check` for the owned files. Record executed checks and the outstanding real WeChat/OSS/device acceptance in the change log.
