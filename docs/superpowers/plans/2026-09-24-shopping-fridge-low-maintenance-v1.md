# 购物清单与冰箱低维护 V1 Implementation Plan

> For agentic workers: use the subagent-driven-development or executing-plans skill to implement this plan task by task.

Goal: 将购物清单收敛为完整需求加已买勾选，将冰箱收敛为带 7/15 天展示衰减的轻量行为痕迹。

Architecture: 菜单确认只展示采购提示；用户点击后生成完整菜谱需求，不做库存差额。购物清单保存来源和购买状态；购买和做饭只产生无数量的痕迹；冰箱只展示近期痕迹，不参与业务计算。

Spec: docs/superpowers/specs/2026-09-24-shopping-fridge-low-maintenance-v1-design.md

## Global constraints

- 菜谱、计划、饭局继续引用确认时的固定菜谱版本。
- 个人冰箱和购物清单仍归当前用户所有。
- 无库存记录不等于缺少，购买痕迹不等于精确入库。
- 不新增精确库存、批次和预占兼容分支、fallback 或旧入口；需要清理历史数据或字段时，先在前向 migration 中定义风险、顺序和失败处理。
- API、DTO、Prisma、迁移或 OpenAPI 变更前必须应用 docs/api-database-rules.md。
- 实现完成后更新 docs/plans/minor_change_log.md。

## Task 1: 固化产品边界

Files:

- Create the new product baseline and this plan.
- Add history banners to the 2026-09-21 low-friction spec, shopping reservation execution record, and fridge batch execution record.
- Add the confirmed documentation-only change to docs/plans/minor_change_log.md.

Steps:

- [ ] Record menu confirmation, complete demand list, purchase trace, cooking trace, and 7/15-day display rules.
- [ ] Mark exact inventory, FEFO, reservation, and automatic deduction as historical or compatibility-only.
- [ ] Run git diff --check on changed documents.

## Task 2: Menu confirmation purchase prompt

Files:

- apps/client/src/pages_meal/detail/index.vue
- apps/client/src/pages_meal/plan/index.vue
- apps/client/src/pages_recipe/detail/index.vue
- Existing affected menu summary contract files and focused tests

Steps:

- [ ] Show 本顿需要准备 X 样食材 and 去采购 after menu confirmation.
- [ ] Do not write a shopping list until the user taps 去采购.
- [ ] Do not use inventory-gap wording or exact stock controls.
- [ ] Preserve fixed recipe version and plan/event ownership checks.

## Task 3: Complete demand list and purchase checks

Files:

- apps/api/src/modules/pantry/pantry.service.ts
- apps/api/src/modules/pantry/pantry.controller.ts
- apps/api/src/contracts/dtos.ts
- apps/api/src/contracts/types.ts
- apps/api/src/contracts/openapi.ts
- apps/client/src/apis/shopping.ts
- apps/client/src/pages_pantry/list-detail/index.vue
- Affected focused API and client tests

Steps:

- [ ] Generate all recipe requirements after 去采购 without subtracting fridge data.
- [ ] Keep same-ingredient and same-unit requirement aggregation and source details.
- [ ] Preserve 待买, 已买, 不买了, item check/uncheck, and 全部买到.
- [ ] Remove quantity, expiry, inventory entry, reservation, and 用库存 forms from the V1 main path.
- [ ] Verify check and uncheck are idempotent and do not change recipe demand text.

## Task 4: Lightweight purchase and cooking traces

Files:

- Minimal API and service contract files for purchase and cooking trace writes
- apps/client/src/apis/shopping.ts
- The accepted cooking-completion entry point, after locating it
- Focused idempotency and trace-state tests

Steps:

- [ ] Mark 已买 with a trace containing no quantity, unit, batch, expiry, or stock deduction.
- [ ] Undo only the current purchase trace when the same check is cancelled.
- [ ] Mark 这顿做完了 with 用过，余量未知 and no deduction.
- [ ] Keep trace writes user-owned and idempotent.
- [ ] Stop if the current cooking-completion entry point requires a new product decision.

## Task 5: Recent fridge traces and category windows

Files:

- apps/api/src/modules/pantry/pantry.service.ts
- apps/api/src/contracts/types.ts
- apps/client/src/pages_pantry/index/index.vue
- apps/client/src/pages_pantry/item-detail/index.vue
- apps/client/src/pages_pantry/apis/fridge.ts
- Focused pantry list/detail and trace-window tests

Steps:

- [ ] Display recent purchase, use, and manual traces without quantity, batch, unit, expiry, or stock totals.
- [ ] Apply 7 days to vegetables, fruit, fresh meat, fresh fish, tofu, fresh milk, and equivalent perishable categories.
- [ ] Apply 15 days to other or unknown categories.
- [ ] Hide old traces from the default list; do not label them expired or missing.
- [ ] Let 还有 reset the window and 用完 hide the trace immediately.
- [ ] Keep manual add/delete optional and outside the core shopping flow.

## Task 6: Direct switch and old-path removal

Files:

- Only the entry points identified by Tasks 2 to 5
- No Prisma migration unless the database rules review proves a non-breaking requirement

Steps:

- [ ] Inventory every reference to UNKNOWN, NEED_CONFIRM, CONFIRM_ENOUGH, reservation, FEFO, exact quantity, expiry, cooking deduction, and old completion-inventory behavior.
- [ ] Remove the old fields, endpoints, client calls, fallback branches, and compatibility reads from the new contract and implementation.
- [ ] Define any required forward migration for obsolete fields or tables before deleting them.
- [ ] Stop if historical data cleanup can break fixed recipe, shopping, audit, or user-owned records.

## Task 7: Focused verification

Files:

- docs/plans/minor_change_log.md

Steps:

- [ ] Verify menu confirmation shows the purchase prompt without writing a list.
- [ ] Verify 去采购 creates the complete demand list without inventory subtraction.
- [ ] Verify purchase checks without quantity or expiry forms.
- [ ] Verify purchase traces and 7/15-day visibility.
- [ ] Verify cooking completion creates only a use trace when the accepted entry exists.
- [ ] Run affected type-check, build, and tests only; report WeChat/device gates separately.
