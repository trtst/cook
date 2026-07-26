# AI Coding Guide

## Purpose

This is the short guide for AI-assisted vibe coding in this repository.

Read this file first. Use `project.md` for the full developer overview, `dining-group.md` for relationship and collaboration rules, `recipe.md` for recipe product and version rules, `ingredient.md` for ingredient and unit rules, `configuration.md` for membership and personal storage rules, `api-database-rules.md` before designing APIs or database changes, `api-contract.md` before API/client/admin integration work, and `uniapp.md` plus `uniapp-architecture.md` before mini program work. Use `docs/cook/*` only as historical product, schema, and SQL source material.

## Product

The product is **炊火记**.

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

infra/
  docker-compose/
  scripts/
```

Rules:

1. Business code must not call `wx.*` directly. Use `apps/client/src/platform/uni.ts`.
2. Client, admin, and API each own their API types and request implementation.
3. The admin app is independent from the mini program client.
4. Keep product source material in `docs/cook/*`; keep current project rules in top-level `docs/*.md`.
5. For uni-app mini program engineering rules, read `docs/uniapp.md` instead of duplicating those rules here.
6. For the `apps/client` scaffold, main package, subpackages, login component, request layer, platform adapter, and Pinia boundaries, read `docs/uniapp-architecture.md`.
7. For API response, error codes, auth schemes, DTO boundaries, and the first Auth/User/DiningGroup vertical slice, read `docs/api-contract.md`.

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

Build the confirmed personal-data meal loop:

1. A user may own one dining group and join additional dining groups within the personal plan limit.
2. Dining-group membership never freezes, switches, merges, or migrates personal data.
3. Recipes use My / Inspiration / Collections: editable personal recipes, reviewed inspiration versions, and read-only saved fixed versions. Imports use a fixed base version plus user overrides.
4. Fridge and shopping data are user-owned and never become long-term shared objects.
5. Sparse weekly plans remain personal; dining events handle invitations, participants, menus, and bring-a-dish coordination.
6. Personal Free/Plus/Pro/Ultra plans control recipes, storage, images, variants, recycle bin, dining-group growth, and personalization.
7. Admin supports user management, entitlement inspection, relationship inspection, configuration, basic audit, ingredient review, and the content-safety and manual-review surface required by Inspiration recipes.

V1 does not implement receipt scanning, OCR, AI, fridge-item photos, owner transfer, chat, comments, follows, delivery, price comparison, fine-grained inventory accounting, shared fridge, shared shopping, or a generic permission center.

## Module State

- Engineering foundation: authentication, request boundaries, platform adapter, personal membership resolution, idempotency, audit, Outbox tables, and candidate implementations for dining groups, recipes, meals, pantry, shopping, storage, sharing, and Admin. Existing code is not evidence that those business modules are accepted.
- In development: DiningGroup, Recipe, Inspiration review, Ingredient/Unit, Meal, Fridge, Shopping, Share, Entitlement, Storage, and Admin governance. Each feature must return to the business-flow and page-behavior gates before its contract or database constraints are treated as frozen.
- User profile and home background image upload remain deferred. User responses keep nullable URL fields and capability flags, and those user-background fields currently return `null` and `false`. The admin-managed login popup image is a separate `app-config` surface, not a generic asset-management reopening.
- Deferred business decisions and known risks are tracked in `plans/business-development-todo.md`. That list prevents omissions but does not confirm a contract.
- Disabled until a separate contract is confirmed: generic public-user discovery outside the reviewed Inspiration flow and Worker/Outbox runtime behavior.
- Target but not contracted: non-monetary activities, achievements, and medal wall. The client may show a Me-page entry placeholder, but no API, DTO, schema, reward, or admin surface may be added until completion facts and contracts are frozen.
- Reserved: Points, meal tickets, receipt scanning, OCR, AI, owner transfer, and generic fine-grained permission management. Do not add placeholder services or client entry points.

## Domain Rules

1. Recipe content uses `RecipeContentVersion`.
2. `RecipeContentVersion` is immutable after creation.
3. `MealPlanItem`, public recipe versions, and share snapshots must reference a fixed content version.
4. Importing a recipe creates a user-owned light entry that points to a fixed base version.
5. Text edits use structured user overrides; services return the merged effective recipe.
6. Recipe image upload and mutation are deferred. Existing system images remain readable; future image writes follow the independent-version rules in `recipe.md`.
7. Recipe visibility has no per-recipe permission, but editing remains owner-only and broad discovery requires content-safety controls.
8. The old `RestaurantRecipe` name in source material must not be copied into the current schema; use the confirmed `Recipe` boundary.
9. Saved recipes in Collections are read-only fixed versions, count toward personal recipe and storage quotas, and may be promoted into My without a second recipe count.
10. Publishing a personal recipe does not publish it to Inspiration. User recommendations submit a fixed version for manual review.
11. Ingredient and unit behavior comes from `ingredient.md`; do not split vegetables or seasonings into separate domain stores.

## Lifecycle And Entitlement Rules

1. DiningGroup is a relationship object, never a data space.
2. All entitlements are user-scoped Free/Plus/Pro/Ultra; there is no dining-group grant.
3. Numeric defaults, image parameters, storage accounting, variants, recycle bin, personalization, and downgrade behavior come only from `configuration.md` and server policy resolution.
4. Over-storage users retain viewing, permanent cleanup, export, renewal, and user-owned safety actions.
5. Allergies and strict restrictions are user-owned, always free, and never exposed to unrelated participants.
6. Fridge and shopping are always user-owned; membership never grants read or write access.
7. Dining-group overage preserves reads and relationship-reduction actions but blocks growth and relationship edits.
8. Variant limits are resolved only from the acting user's current personal tier; variants cannot create more variants.
9. Membership activation, upgrade, and renewal are direct-payment only. Points or meal tickets cannot buy, offset, or join a mixed membership payment.
10. Paid personalization is a continuous non-AI entitlement that affects only the user's own recommendations and never changes safety filters, shared votes, or global ranking.
11. Activities and achievements are non-monetary meal-loop records. Medals have no cash value, cannot be exchanged, transferred, withdrawn, or used for membership payment, and must be derived from server-confirmed meal or dining-event facts.
12. Free users can earn baseline medals. Paid plans may improve history depth, display, templates, and summaries, but must not change shared voting weight, safety filters, or baseline medal eligibility.

## Write Rules

1. All retryable writes carry `operationId`.
2. Shared mutable objects carry `version`.
3. Server-side ownership, membership, entitlement, storage, fridge, shopping, plan, dining-event, and recipe checks are mandatory for writes.
4. Do not rely on hidden client buttons for security.
5. Cross-object changes such as confirming a meal, closing a poll, ending shopping, batch fridge updates, invite acceptance, member exit/removal, recipe independent-version promotion, and entitlement upgrades must be transactional.
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

Before changing APIs, DTOs, Prisma models, SQL constraints, indexes, caches, or migrations, read and apply `docs/api-database-rules.md`. Its ownership, least-data, least-privilege, database-constraint, predictable-cost, migration, and pre-commit rules are mandatory.

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

Business features must follow this order:

```text
business flow -> page behavior -> permissions and states -> minimal API -> minimal tables and constraints -> implementation -> real acceptance
```

Do not treat existing routes, DTOs, OpenAPI schemas, Prisma models, migrations, or pages as proof that the business contract is confirmed. For business work, create or update the feature execution sheet and complete the business-flow and page-behavior gates before designing APIs or tables. Apply the mandatory details in `docs/api-database-rules.md`.

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

Before delivery, update `plans/minor_change_log.md`. Small changes are recorded directly. Large changes also use an independent execution document, but still require a dated central-log summary with the actual validation and remaining gaps.
