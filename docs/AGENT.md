# AI Coding Guide

## Purpose

This is the short guide for AI-assisted vibe coding in this repository.

Read this file first. Use `project.md` for the full developer overview, `dining-group.md` for the current lifecycle and data rules, `configuration.md` for Free/Plus and storage rules, `api-contract.md` before API/client/admin integration work, and `uniapp.md` plus `uniapp-architecture.md` before mini program work. Use `docs/cook/*` only as historical product, schema, and SQL source material.

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
5. For uni-app mini program engineering rules, read `docs/uniapp.md` instead of duplicating those rules here.
6. For the `apps/client` scaffold, main package, subpackages, login component, request layer, platform adapter, and Pinia boundaries, read `docs/uniapp-architecture.md`.
7. For shared API response, error codes, auth schemes, DTO boundaries, and the first Auth/User/DiningGroup vertical slice, read `docs/api-contract.md`.

## Flat Shape Rules

Keep folders, routes, and API paths flat across client, API, and admin.

Rules:

1. Do not mirror domain model depth in folders or routes.
2. Mini program routes should be `package/page`, not `package/domain/action/page`.
3. API paths should be short resource paths. Prefer query/body fields over deep URLs.
4. Admin routes should follow feature pages, not menu nesting depth.
5. Backend modules should stay one module per domain area, not nested domain trees.
6. If a path needs more than two semantic levels, add a short comment or doc note explaining why.
7. Use DTOs, types, guards, services, and comments to carry complexity. Do not encode complexity in paths.

## V1 Scope

Build the confirmed meal loop and lifecycle:

1. Registration creates one solo dining group; a user has one active long-term dining group.
2. A long-term invite freezes the invitee's original space; import is explicit, and exit restores the original space plus a temporary carry-back snapshot.
3. Dining-group recipes, public browsing and direct collection, immutable technical snapshots, copy-on-write edits, Plus recipe variants, recipe count, media storage, and deletion rules.
4. Shared fridge, meal plans, participation, shopping ownership, and the core next-meal loop.
5. Temporary meal guests (`饭局`) and user-owned taste/allergy profiles without granting shared-space access.
6. Personal Free/Plus and Dining Group Free/Plus, upgrade proration, expiry, over-quota read-only behavior, and cleanup.
7. Admin system recipes, ingredient aliases, configuration, entitlement inspection, and basic audit.

V1 does not implement receipt scanning, OCR, AI, fridge-item photos, Pro, multi-family collaboration, ordinary multi-group switching, owner transfer, chat, comments, follows, delivery, price comparison, or fine-grained inventory accounting.

## Module State

- Current implemented: Auth, User, unique current DiningGroup, original-space freeze/restore, carry-back snapshot header, minimum Plus grants, effective entitlement resolution, and Admin read-only queries.
- Next implementation: original-space imports, snapshot item carry-back, recipes and storage ledger, meal guests, taste, and the minimum upgrade/expiry payment path.
- Disabled: Public user submissions and Worker/Outbox runtime behavior.
- Reserved: Points, receipt scanning, OCR, AI, Pro, multi-family, and multi-dining-group switching. Do not add placeholder services or client entry points.

## Domain Rules

1. Recipe content uses `RecipeContentVersion`.
2. `RecipeContentVersion` is immutable after creation.
3. `MealPlanItem`, public recipe versions, and share snapshots must reference a fixed content version.
4. Collecting a system or public recipe creates a light dining-group recipe entry that points to a fixed source version.
5. Editing ingredients, amounts, or steps creates a new technical content snapshot and atomically switches `currentVersionId`; it is not user-visible edit history.
6. Editing local name, note, category, or display metadata does not create a new content version.
7. Private dining-group recipes must not leak through global search, public similarity, or adoption statistics.
8. The old `RestaurantRecipe` name in source material must not be copied into the current schema; use the confirmed `Recipe` boundary.

## Lifecycle And Entitlement Rules

1. Solo and shared spaces use one DiningGroup model; shared membership changes access, not data ownership by copying.
2. Personal entitlements do not add together into dining-group entitlements.
3. Free/Plus numeric defaults, image parameters, storage accounting, recipe variants, recycle bin, snapshot retention, and downgrade behavior come only from `configuration.md` and server policy resolution.
4. Over-storage spaces are read-only except viewing, permanent cleanup, export, exit/carry-back, renewal, and user-owned safety actions.
5. Allergies and strict restrictions are user-owned, always free, and never exposed to unrelated participants.
6. Carry-back recipes may include any recipe the departing member was authorized to see; fridge, plans, and shopping use the narrower rules in `dining-group.md`.
7. Free deletion is permanent; Plus has a 7-day recycle bin. Free/Plus do not expose edit history.
8. Personal Plus or Dining Group Plus can create at most two direct variants from one root recipe; variants cannot create more variants.
9. Personal Plus to Dining Group Plus uses 100% of the remaining cash-paid value; member exit never triggers reverse proration.

## Write Rules

1. All retryable writes carry `operationId`.
2. Shared mutable objects carry `version`.
3. Server-side permission checks are mandatory for dining-group, original-space, role, membership, storage state, fridge, shopping, plan, guest, and recipe writes.
4. Do not rely on hidden client buttons for security.
5. Cross-object changes such as confirming a meal, closing a poll, ending shopping, batch fridge updates, invite acceptance, exit/restore, snapshot creation, and entitlement upgrades must be transactional.
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
