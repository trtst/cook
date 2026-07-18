# AI Coding Guide

## Purpose

This is the short guide for AI-assisted vibe coding in this repository.

Read this file first. Use `project.md` for the full developer overview and use `docs/cook/*` only when you need the frozen product, schema, or SQL details.

## Product

The product is **Next Meal**.

It is a family meal planning mini program. The core loop is not recipe browsing. The core loop is:

`want to eat -> choose together -> confirm next meal -> check fridge -> build shopping list -> shop -> cook -> save and share the memory`

Keep every feature tied to meals, recipes, fridge state, shopping, sharing, or household decisions.

## Frozen Stack

- Client: uni-app + Vue 3 + TypeScript + Pinia, targeting WeChat mini program.
- API: NestJS + TypeScript on Node.js 20+.
- Database: PostgreSQL 15+.
- ORM: Prisma 5.22.0.
- Cache and queue: Redis + BullMQ.
- Reliable async delivery: PostgreSQL Outbox. V1 creates tables but does not run the worker.
- Admin: Vue 3 + Element Plus.
- API contract: OpenAPI 3.0.

Do not use the old generic Python or PC-web stack as the default for this project.

## Repository Shape

Expected structure:

```text
apps/
  client/
  admin/
  api/
  worker/

packages/
  api-client/
  domain/
  platform/
  shared/

infra/
  docker-compose/
  scripts/
```

Rules:

1. Business code must not call `wx.*` directly. Use `packages/platform`.
2. Shared domain types belong in `packages/domain`.
3. The admin app is independent from the mini program client.
4. Keep product source material in `docs/cook/*`; keep current project rules in top-level `docs/*.md`.

## V1 Scope

Build the family meal loop:

1. WeChat login, user account, restaurant creation, invite, members, roles.
2. Restaurant recipes, system recommendation plaza, fixed-version import, copy-on-write edits.
3. Next meal, meal poll, unified "want to eat", wish pool, random dish/table.
4. Restaurant fridge with `HAVE / LOW / EMPTY`, ingredient gap check, shopping list, supermarket mode.
5. Share snapshots, read-only preview, import, meal memory card.
6. Admin import, system recipes, ingredient aliases, basic audit.

V1 does not open user public submissions, excellent recommendation ranking, formal payment, AI recipe generation, chat, comments, follows, private messages, delivery, price comparison, or fine-grained inventory accounting.

## Module State

- `Active`: Auth, User, Restaurant, Recipe, Meal, Poll, Fridge, Shopping, RecipeImport, Admin, Share.
- `Disabled`: Public recipe endpoints and Worker/Outbox behavior. Keep table and endpoint skeletons; return 503 for disabled client-facing behavior. V1 only uses the system recommendation plaza.
- `Reserved`: Payment, membership, points, entitlement, quota services. Keep tables only.

## Domain Rules

1. Recipe content uses `RecipeContentVersion`.
2. `RecipeContentVersion` is immutable after creation.
3. `MealPlanItem`, public recipe versions, and share snapshots must reference a fixed content version.
4. Importing a system or public recipe creates a light `RestaurantRecipe` entry that points to the source version.
5. Editing ingredients, amounts, or steps creates a new content version and atomically switches `currentVersionId`.
6. Editing local name, note, category, or display metadata does not create a new content version.
7. Private restaurant recipes must not leak through global search, public similarity, or adoption statistics.

## Write Rules

1. All retryable writes carry `operationId`.
2. Shared mutable objects carry `version`.
3. Server-side permission checks are mandatory for restaurant, role, membership, fridge, shopping, plan, and recipe writes.
4. Do not rely on hidden client buttons for security.
5. Cross-object changes such as confirming a meal, closing a poll, ending shopping, batch fridge updates, invite acceptance, and ownership transfer must be transactional.
6. Write audit records for important state changes.

## Naming Rules

Use short camelCase names. Maximum three words.

Forbidden naming style:

- `normalizedX`
- `formattedX`
- `processedX`
- `dataManager`
- `serviceAdapter`
- `handlerCenter`
- `commonBaseX`

Prefer names that describe the role or result:

- `searchKey`
- `dishName`
- `currentDish`
- `buildMeal`
- `resolveQuota`
- `createPlan`

If a short name needs context, add a comment. Do not make the name longer to carry the whole explanation.

## Code Style

1. Use TypeScript for new code.
2. Use `script setup` and Composition API in Vue files.
3. Keep page-level orchestration in pages.
4. Components handle one UI responsibility and expose explicit props and events.
5. Shared state goes to Pinia only when it has real cross-page lifetime.
6. Request code goes through the API layer.
7. Do not introduce abstractions before real reuse or clear boundary pressure exists.

## API Rules

All APIs return JSON:

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "serverTime": "2026-07-18 12:00:00"
}
```

Disabled features return:

```json
{
  "code": 503,
  "message": "功能开发中，敬请期待",
  "data": null
}
```

## Before Coding

Start directly when the task is local and the target is clear.

Pause for confirmation when the change affects:

1. V1 scope.
2. module state.
3. API contract.
4. recipe version semantics.
5. permission or quota rules.
6. database constraints.
7. payment, points, membership, public UGC, or compliance gates.

## Validation

For every change, verify the smallest real path:

1. visible result or API result,
2. main success path,
3. relevant failure path,
4. idempotency or version behavior when touched,
5. no obvious adjacent regression.
